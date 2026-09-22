import { Request, Response } from 'express';
import { Ward, Bed, Admission } from './models';
import { Invoice, Payment } from '../billing/models';
import { appendChargesToPatientBill } from '../billing/billing.service';
import { AppError, asyncHandler, sendResponse } from '../../common';
import {
  closeAdmissionLedger,
  createAdmissionResourceSetup,
  getBedChargeForWard,
} from '../resources/resources.service';

const populateAdmission = (q: any) =>
  q
    .populate('patientId', 'name patientId contact.phone gender bloodGroup qrCodeUrl')
    .populate({
      path: 'admittedBy',
      populate: { path: 'userId', select: 'name email' },
    })
    .populate('wardId', 'name category')
    .populate('bedId', 'bedNumber type status')
    .populate('primaryNurse', 'name');

const bedChargeForWard = async (hospitalId: any, category: string) =>
  getBedChargeForWard(hospitalId, category);

const stayDays = (from: Date, to: Date) => {
  const ms = Math.max(0, to.getTime() - from.getTime());
  return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
};

/** Auto bill on admit: admission fee + day-1 bed charge → patient bill store */
const createAdmissionInvoice = async (opts: {
  hospitalId: any;
  patientId: any;
  admissionId: any;
  wardName: string;
  wardCategory: string;
  bedNumber: string;
}) => {
  const { category, dailyRate, admissionFee } = await bedChargeForWard(
    opts.hospitalId,
    opts.wardCategory
  );
  return appendChargesToPatientBill(opts.hospitalId, opts.patientId, [
    {
      description: `IPD admission fee — ${opts.wardName} / Bed ${opts.bedNumber}`,
      category: 'Other',
      quantity: 1,
      unitPrice: admissionFee,
    },
    {
      description: `Bed charge day 1 — ${opts.wardName} (${opts.wardCategory})`,
      category,
      quantity: 1,
      unitPrice: dailyRate,
    },
  ]);
};

/** On discharge, bill any extra stay days beyond day 1 */
const createStayBalanceInvoice = async (opts: {
  hospitalId: any;
  patientId: any;
  admission: any;
  wardName: string;
  wardCategory: string;
  bedNumber: string;
  days: number;
}) => {
  if (opts.days <= 1) return null;
  const { category, dailyRate } = await bedChargeForWard(opts.hospitalId, opts.wardCategory);
  const extraDays = opts.days - 1;
  return appendChargesToPatientBill(opts.hospitalId, opts.patientId, [
    {
      description: `IPD stay days 2–${opts.days} (${extraDays} day(s)) — ${opts.wardName} / Bed ${opts.bedNumber}`,
      category,
      quantity: extraDays,
      unitPrice: dailyRate,
    },
  ]);
};

/** One active admission per patient — keep newest, release older duplicates */
const collapseDuplicateAdmissions = async (hospitalId: string) => {
  const active = await Admission.find({ hospitalId, status: 'Admitted' }).sort({ admissionDate: -1 });
  const seenPatient = new Set<string>();
  const freedBedIds: string[] = [];

  for (const admission of active) {
    const pid = String(admission.patientId);
    if (!seenPatient.has(pid)) {
      seenPatient.add(pid);
      continue;
    }
    admission.status = 'Discharged';
    admission.dischargeSummary = {
      dischargeDate: new Date(),
      conditionAtDischarge: 'Stable',
      advice: 'Auto-released: patient already had a newer active admission on another bed.',
    };
    await admission.save();
    freedBedIds.push(String(admission.bedId));
  }

  for (const bedId of freedBedIds) {
    const stillActive = await Admission.exists({ hospitalId, bedId, status: 'Admitted' });
    if (!stillActive) {
      await Bed.findOneAndUpdate(
        { _id: bedId, hospitalId, status: { $ne: 'Maintenance' } },
        { $set: { status: 'Available' } }
      );
    }
  }
};

/** Rebuild bed occupancy from active admissions (fixes stale / double-book display) */
const syncBedOccupancy = async (hospitalId: string) => {
  await collapseDuplicateAdmissions(hospitalId);

  const active = await Admission.find({ hospitalId, status: 'Admitted' }).select('bedId');
  const occupiedIds = new Set(active.map((a) => String(a.bedId)));

  const beds = await Bed.find({ hospitalId });
  for (const bed of beds) {
    if (bed.status === 'Maintenance') continue;
    const shouldOccupy = occupiedIds.has(String(bed._id));
    const next = shouldOccupy ? 'Occupied' : 'Available';
    if (bed.status !== next) {
      bed.status = next;
      await bed.save();
    }
  }
};

export const createWard = asyncHandler(async (req: Request, res: Response) => {
  const { name, category, capacity } = req.body;

  if (!name || !category || !capacity) {
    throw new AppError('Ward name, category, and capacity are required', 400);
  }

  const ward = await Ward.create({
    hospitalId: req.hospitalId,
    name,
    category,
    capacity,
  });

  return sendResponse(res, 201, 'Ward created successfully', ward);
});

export const createBed = asyncHandler(async (req: Request, res: Response) => {
  const { wardId, bedNumber, type } = req.body;

  if (!wardId || !bedNumber || !type) {
    throw new AppError('Ward ID, bed number, and bed type are required', 400);
  }

  const ward = await Ward.findOne({ _id: wardId, hospitalId: req.hospitalId });
  if (!ward) {
    throw new AppError('Ward not found', 404);
  }

  const bedCount = await Bed.countDocuments({ wardId });
  if (bedCount >= ward.capacity) {
    throw new AppError('Ward capacity exceeded', 400);
  }

  const exists = await Bed.findOne({ hospitalId: req.hospitalId, wardId, bedNumber });
  if (exists) {
    throw new AppError('Bed number already exists in this ward', 400);
  }

  const bed = await Bed.create({
    hospitalId: req.hospitalId,
    wardId,
    bedNumber,
    type,
    status: 'Available',
  });

  return sendResponse(res, 201, 'Bed configured successfully', bed);
});

export const getWardsAndBeds = asyncHandler(async (req: Request, res: Response) => {
  await syncBedOccupancy(String(req.hospitalId));

  const wards = await Ward.find({ hospitalId: req.hospitalId });
  const beds = await Bed.find({ hospitalId: req.hospitalId });

  const active = await populateAdmission(
    Admission.find({ hospitalId: req.hospitalId, status: 'Admitted' }).sort({ admissionDate: -1 })
  );

  const bedPatientMap: Record<string, any> = {};
  const bedAdmissionMap: Record<string, any> = {};
  active.forEach((a: any) => {
    bedPatientMap[String(a.bedId?._id || a.bedId)] = a.patientId;
    bedAdmissionMap[String(a.bedId?._id || a.bedId)] = a;
  });

  return sendResponse(res, 200, 'Wards and beds layout retrieved', {
    wards,
    beds,
    bedPatientMap,
    bedAdmissionMap,
    activeAdmissions: active,
  });
});

export const admitPatient = asyncHandler(async (req: Request, res: Response) => {
  const { patientId, admittedBy, reason, wardId, bedId, primaryNurse } = req.body;

  if (!patientId || !admittedBy || !reason || !wardId || !bedId) {
    throw new AppError('All details are required to process IPD admission', 400);
  }

  const hospitalId = req.hospitalId!;

  const alreadyIn = await Admission.findOne({ hospitalId, patientId, status: 'Admitted' });
  if (alreadyIn) {
    throw new AppError('This patient is already admitted. Change bed/doctor or discharge first.', 400);
  }

  const bedBusy = await Admission.findOne({ hospitalId, bedId, status: 'Admitted' });
  if (bedBusy) {
    throw new AppError('This bed is already assigned to another patient', 400);
  }

  // Atomic claim — prevents double booking the same bed
  const bed = await Bed.findOneAndUpdate(
    { _id: bedId, hospitalId, status: 'Available' },
    { $set: { status: 'Occupied' } },
    { new: true }
  );
  if (!bed) {
    throw new AppError('Selected bed is occupied or under maintenance', 400);
  }

  if (String(bed.wardId) !== String(wardId)) {
    bed.status = 'Available';
    await bed.save();
    throw new AppError('Bed does not belong to the selected ward', 400);
  }

  try {
    const admission = await Admission.create({
      hospitalId,
      patientId,
      admittedBy,
      reason,
      wardId,
      bedId,
      primaryNurse,
      status: 'Admitted',
    });

    const ward = await Ward.findById(wardId);
    let invoice = null;
    let resourceSetup = null;
    try {
      resourceSetup = await createAdmissionResourceSetup({
        hospitalId,
        admissionId: admission._id,
        patientId,
      });
    } catch (setupErr) {
      console.error('Failed to create wristband / resource ledger', setupErr);
    }

    try {
      invoice = await createAdmissionInvoice({
        hospitalId,
        patientId,
        admissionId: admission._id,
        wardName: ward?.name || 'Ward',
        wardCategory: ward?.category || 'General',
        bedNumber: bed.bedNumber,
      });
    } catch (billErr) {
      console.error('Failed to auto-create admission invoice', billErr);
    }

    const populated = await populateAdmission(Admission.findById(admission._id));
    return sendResponse(res, 201, 'Patient admitted to IPD ward', {
      admission: populated,
      invoice,
      wristband: resourceSetup
        ? {
            admissionNumber: resourceSetup.admissionNumber,
            wristbandToken: resourceSetup.wristbandToken,
            wristbandPayload: resourceSetup.wristbandPayload,
            ledgerId: resourceSetup.ledger._id,
          }
        : null,
    });
  } catch (err) {
    await Bed.findByIdAndUpdate(bedId, { status: 'Available' });
    throw err;
  }
});

/** Change bed (and optionally ward) for an active admission */
export const changeBed = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { wardId, bedId } = req.body;

  if (!wardId || !bedId) {
    throw new AppError('New ward and bed are required', 400);
  }

  const hospitalId = req.hospitalId!;
  const admission = await Admission.findOne({ _id: id, hospitalId, status: 'Admitted' });
  if (!admission) throw new AppError('Active admission not found', 404);

  if (String(admission.bedId) === String(bedId)) {
    throw new AppError('Patient is already on this bed', 400);
  }

  const bedTaken = await Admission.findOne({
    hospitalId,
    bedId,
    status: 'Admitted',
    _id: { $ne: admission._id },
  });
  if (bedTaken) throw new AppError('Target bed is already occupied', 400);

  const newBed = await Bed.findOneAndUpdate(
    { _id: bedId, hospitalId, status: 'Available' },
    { $set: { status: 'Occupied' } },
    { new: true }
  );
  if (!newBed) throw new AppError('Target bed is not available', 400);

  if (String(newBed.wardId) !== String(wardId)) {
    newBed.status = 'Available';
    await newBed.save();
    throw new AppError('Bed does not belong to the selected ward', 400);
  }

  const oldBedId = admission.bedId;
  const oldWardId = admission.wardId;
  admission.wardId = wardId;
  admission.bedId = bedId;
  admission.status = 'Admitted';
  await admission.save();

  await Bed.findByIdAndUpdate(oldBedId, { status: 'Available' });
  await syncBedOccupancy(String(hospitalId));

  // If ward category changed, note transfer on bill (pro-rate starts next day via discharge logic)
  try {
    const [oldWard, newWard] = await Promise.all([
      Ward.findById(oldWardId),
      Ward.findById(wardId),
    ]);
    if (oldWard && newWard && oldWard.category !== newWard.category) {
      const rate = await bedChargeForWard(hospitalId, newWard.category);
      await appendChargesToPatientBill(hospitalId, admission.patientId, [
        {
          description: `Bed transfer — ${oldWard.name} → ${newWard.name} / Bed ${newBed.bedNumber} (new daily rate ₹${rate.dailyRate})`,
          category: rate.category,
          quantity: 1,
          unitPrice: 0,
        },
      ]);
    }
  } catch (transferBillErr) {
    console.error('Failed to log bed transfer charge note', transferBillErr);
  }

  const populated = await populateAdmission(Admission.findById(admission._id));
  return sendResponse(res, 200, 'Bed changed successfully', populated);
});

/** Change assigned doctor for active admission */
export const changeDoctor = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { doctorId } = req.body;

  if (!doctorId) throw new AppError('Doctor ID is required', 400);

  const admission = await Admission.findOne({
    _id: id,
    hospitalId: req.hospitalId,
    status: 'Admitted',
  });
  if (!admission) throw new AppError('Active admission not found', 404);

  admission.admittedBy = doctorId;
  await admission.save();

  const populated = await populateAdmission(Admission.findById(admission._id));
  return sendResponse(res, 200, 'Doctor reassigned successfully', populated);
});

/**
 * Discharge / release patient:
 * - frees bed
 * - optionally settles outstanding invoices (clear bill)
 */
export const dischargePatient = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    conditionAtDischarge,
    advice,
    notes,
    clearBills = false,
    paymentMethod = 'Cash',
  } = req.body;

  if (!conditionAtDischarge) {
    throw new AppError('Condition at discharge is required', 400);
  }

  const hospitalId = req.hospitalId!;
  const admission = await Admission.findOne({ _id: id, hospitalId, status: 'Admitted' })
    .populate('wardId', 'name category')
    .populate('bedId', 'bedNumber');
  if (!admission) {
    throw new AppError('Active IPD admission record not found', 404);
  }

  const ward: any = admission.wardId;
  const bed: any = admission.bedId;
  const days = stayDays(new Date(admission.admissionDate), new Date());

  // Bill remaining stay — if admit never created an invoice, bill full stay + admission fee
  try {
    const priorIpd = await Invoice.findOne({
      hospitalId,
      patientId: admission.patientId,
      createdAt: { $gte: admission.admissionDate },
      $or: [{ 'items.category': 'IPD Ward' }, { 'items.category': 'ICU Bed' }],
    });

    if (!priorIpd) {
      await createAdmissionInvoice({
        hospitalId,
        patientId: admission.patientId,
        admissionId: admission._id,
        wardName: ward?.name || 'Ward',
        wardCategory: ward?.category || 'General',
        bedNumber: bed?.bedNumber || '-',
      });
      if (days > 1) {
        await createStayBalanceInvoice({
          hospitalId,
          patientId: admission.patientId,
          admission,
          wardName: ward?.name || 'Ward',
          wardCategory: ward?.category || 'General',
          bedNumber: bed?.bedNumber || '-',
          days,
        });
      }
    } else {
      await createStayBalanceInvoice({
        hospitalId,
        patientId: admission.patientId,
        admission,
        wardName: ward?.name || 'Ward',
        wardCategory: ward?.category || 'General',
        bedNumber: bed?.bedNumber || '-',
        days,
      });
    }
  } catch (billErr) {
    console.error('Failed to create stay balance invoice', billErr);
  }

  const openInvoices = await Invoice.find({
    hospitalId,
    patientId: admission.patientId,
    paymentStatus: { $in: ['Unpaid', 'Partially-Paid'] },
  });

  let outstanding = 0;
  for (const inv of openInvoices) {
    const paidAgg = await Payment.aggregate([
      { $match: { invoiceId: inv._id, status: 'Success' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const alreadyPaid = paidAgg[0]?.total || 0;
    outstanding += Math.max(0, inv.grandTotal - alreadyPaid);
  }

  if (outstanding > 0) {
    throw new AppError(
      `Cannot discharge — outstanding bill ₹${outstanding}. Collect payment in Billing first.`,
      400
    );
  }

  const settled: any[] = [];

  admission.status = 'Discharged';
  admission.dischargeSummary = {
    dischargeDate: new Date(),
    conditionAtDischarge,
    advice,
    notes,
  };
  await admission.save();

  try {
    await closeAdmissionLedger(admission._id);
  } catch (ledgerErr) {
    console.error('Failed to close resource ledger', ledgerErr);
  }

  await Bed.findByIdAndUpdate(admission.bedId, { status: 'Available' });
  await syncBedOccupancy(String(hospitalId));

  const populated = await populateAdmission(Admission.findById(admission._id));

  return sendResponse(res, 200, 'Patient discharged and bed released', {
    admission: populated,
    stayDays: days,
    billsCleared: settled,
    outstandingBefore: outstanding,
  });
});

export const getAdmissions = asyncHandler(async (req: Request, res: Response) => {
  const { status, doctorId } = req.query;
  const query: any = { hospitalId: req.hospitalId };
  if (status) query.status = status;
  else query.status = 'Admitted';
  if (doctorId) query.admittedBy = doctorId;

  await syncBedOccupancy(String(req.hospitalId));

  const admissions = await populateAdmission(
    Admission.find(query).sort({ admissionDate: -1 })
  );

  return sendResponse(res, 200, 'IPD Admissions retrieved successfully', admissions);
});
