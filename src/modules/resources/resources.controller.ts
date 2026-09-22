import { Request, Response } from 'express';
import { AppError, asyncHandler, sendResponse } from '../../common';
import {
  BedChargeRate,
  PatientResourceLedger,
  ProcedureTemplate,
  ReconciliationAlert,
  ResourceUsage,
} from './models';
import {
  applyProcedureTemplate,
  createAdmissionResourceSetup,
  ensureDefaultBedRates,
  ensureDefaultTemplates,
  getDefaultStoreId,
  getPatientLedgerDetail,
  resolveBarcode,
  resolveWristband,
  runReconciliation,
  scanConsume,
} from './resources.service';
import { Admission } from '../ipd/models';

export const resolveWristbandHandler = asyncHandler(async (req: Request, res: Response) => {
  const token = String(req.params.token || req.query.q || '');
  const data = await resolveWristband(req.hospitalId, decodeURIComponent(token));
  return sendResponse(res, 200, 'Wristband resolved', data);
});

export const resolveBarcodeHandler = asyncHandler(async (req: Request, res: Response) => {
  const code = String(req.params.code || req.query.q || '');
  const data = await resolveBarcode(req.hospitalId, decodeURIComponent(code));
  const storeId = (req.query.storeId as string) || (await getDefaultStoreId(req.hospitalId));
  return sendResponse(res, 200, 'Barcode resolved', { ...data, suggestedStoreId: storeId });
});

export const scanConsumeHandler = asyncHandler(async (req: Request, res: Response) => {
  const {
    wristband,
    patientId,
    admissionId,
    barcode,
    itemId,
    storeId,
    quantity = 1,
    billPatient = true,
    remarks,
  } = req.body;

  if (!storeId) throw new AppError('storeId is required', 400);
  if (!wristband && !patientId) throw new AppError('wristband or patientId is required', 400);
  if (!barcode && !itemId) throw new AppError('barcode or itemId is required', 400);

  const result = await scanConsume({
    hospitalId: req.hospitalId,
    wristband,
    patientId,
    admissionId,
    barcode,
    itemId,
    storeId,
    quantity: Number(quantity) || 1,
    billPatient,
    performedBy: req.user?.id,
    remarks,
  });

  return sendResponse(res, 200, 'Item scanned, stock deducted, and patient billed', result);
});

export const applyTemplateHandler = asyncHandler(async (req: Request, res: Response) => {
  const {
    templateId,
    storeId,
    wristband,
    patientId,
    admissionId,
    billPatient = true,
    skipOptional = false,
  } = req.body;

  if (!templateId) throw new AppError('templateId is required', 400);
  const resolvedStore = storeId || (await getDefaultStoreId(req.hospitalId));

  const result = await applyProcedureTemplate({
    hospitalId: req.hospitalId,
    templateId,
    storeId: resolvedStore,
    wristband,
    patientId,
    admissionId,
    billPatient,
    performedBy: req.user?.id,
    skipOptional,
  });

  return sendResponse(res, 200, 'Procedure template applied', result);
});

export const listTemplates = asyncHandler(async (req: Request, res: Response) => {
  const templates = await ensureDefaultTemplates(req.hospitalId, req.user?.id);
  return sendResponse(res, 200, 'Procedure templates', templates);
});

export const createTemplate = asyncHandler(async (req: Request, res: Response) => {
  const { code, name, description, category, items } = req.body;
  if (!code || !name || !items?.length) {
    throw new AppError('code, name, and items are required', 400);
  }

  const exists = await ProcedureTemplate.findOne({ hospitalId: req.hospitalId, code });
  if (exists) throw new AppError('Template code already exists', 400);

  const template = await ProcedureTemplate.create({
    hospitalId: req.hospitalId,
    code: String(code).toUpperCase(),
    name,
    description,
    category: category || 'Nursing',
    items,
    isActive: true,
    createdBy: req.user?.id,
  });

  const populated = await ProcedureTemplate.findById(template._id).populate(
    'items.itemId',
    'name itemCode barcode unit sellingPrice'
  );

  return sendResponse(res, 201, 'Procedure template created', populated);
});

export const updateTemplate = asyncHandler(async (req: Request, res: Response) => {
  const template = await ProcedureTemplate.findOneAndUpdate(
    { _id: req.params.id, hospitalId: req.hospitalId },
    { $set: req.body },
    { new: true }
  ).populate('items.itemId', 'name itemCode barcode unit sellingPrice');

  if (!template) throw new AppError('Template not found', 404);
  return sendResponse(res, 200, 'Template updated', template);
});

export const deleteTemplate = asyncHandler(async (req: Request, res: Response) => {
  const template = await ProcedureTemplate.findOneAndUpdate(
    { _id: req.params.id, hospitalId: req.hospitalId },
    { $set: { isActive: false } },
    { new: true }
  );
  if (!template) throw new AppError('Template not found', 404);
  return sendResponse(res, 200, 'Template deactivated', template);
});

export const getLedgerByAdmission = asyncHandler(async (req: Request, res: Response) => {
  const data = await getPatientLedgerDetail(req.hospitalId, req.params.admissionId);
  return sendResponse(res, 200, 'Patient resource ledger', data);
});

export const getLedgerByPatient = asyncHandler(async (req: Request, res: Response) => {
  const admission = await Admission.findOne({
    hospitalId: req.hospitalId,
    patientId: req.params.patientId,
    status: 'Admitted',
  }).sort({ admissionDate: -1 });

  if (!admission) {
    const usages = await ResourceUsage.find({
      hospitalId: req.hospitalId,
      patientId: req.params.patientId,
    })
      .sort({ createdAt: -1 })
      .limit(100);
    return sendResponse(res, 200, 'Patient resource history', { admission: null, usages });
  }

  const data = await getPatientLedgerDetail(req.hospitalId, String(admission._id));
  return sendResponse(res, 200, 'Patient resource ledger', data);
});

export const listOpenLedgers = asyncHandler(async (req: Request, res: Response) => {
  const ledgers = await PatientResourceLedger.find({
    hospitalId: req.hospitalId,
    status: 'Open',
  })
    .populate('patientId', 'name patientId')
    .populate({
      path: 'admissionId',
      populate: [
        { path: 'wardId', select: 'name category' },
        { path: 'bedId', select: 'bedNumber' },
      ],
    })
    .sort({ updatedAt: -1 });

  return sendResponse(res, 200, 'Open resource ledgers', ledgers);
});

export const getWristband = asyncHandler(async (req: Request, res: Response) => {
  let admission = await Admission.findOne({
    _id: req.params.admissionId,
    hospitalId: req.hospitalId,
  }).populate('patientId', 'name patientId gender bloodGroup dateOfBirth contact.phone');

  if (!admission) throw new AppError('Admission not found', 404);

  if (!(admission as any).wristbandPayload) {
    const setup = await createAdmissionResourceSetup({
      hospitalId: req.hospitalId,
      admissionId: admission._id,
      patientId: (admission as any).patientId?._id || admission.patientId,
    });
    admission = await Admission.findById(admission._id).populate(
      'patientId',
      'name patientId gender bloodGroup dateOfBirth contact.phone'
    );
    return sendResponse(res, 200, 'Wristband generated', {
      admissionId: admission!._id,
      admissionNumber: setup.admissionNumber,
      wristbandToken: setup.wristbandToken,
      wristbandPayload: setup.wristbandPayload,
      patient: admission!.patientId,
      status: admission!.status,
    });
  }

  return sendResponse(res, 200, 'Wristband data', {
    admissionId: admission._id,
    admissionNumber: (admission as any).admissionNumber,
    wristbandToken: (admission as any).wristbandToken,
    wristbandPayload: (admission as any).wristbandPayload,
    patient: admission.patientId,
    status: admission.status,
  });
});

export const listBedRates = asyncHandler(async (req: Request, res: Response) => {
  const rates = await ensureDefaultBedRates(req.hospitalId);
  return sendResponse(res, 200, 'Bed charge rates', rates);
});

export const upsertBedRate = asyncHandler(async (req: Request, res: Response) => {
  const { wardCategory, bedType, dailyRate, admissionFee, billCategory } = req.body;
  if (!wardCategory || dailyRate == null || admissionFee == null) {
    throw new AppError('wardCategory, dailyRate, and admissionFee are required', 400);
  }

  const rate = await BedChargeRate.findOneAndUpdate(
    {
      hospitalId: req.hospitalId,
      wardCategory,
      bedType: bedType || null,
    },
    {
      $set: {
        dailyRate: Number(dailyRate),
        admissionFee: Number(admissionFee),
        billCategory: billCategory || (wardCategory === 'ICU' ? 'ICU Bed' : 'IPD Ward'),
        isActive: true,
      },
    },
    { upsert: true, new: true }
  );

  return sendResponse(res, 200, 'Bed charge rate saved', rate);
});

export const reconcileHandler = asyncHandler(async (req: Request, res: Response) => {
  const days = Number(req.query.days) || 7;
  const data = await runReconciliation(req.hospitalId, days);
  return sendResponse(res, 200, 'Reconciliation complete', data);
});

export const listAlerts = asyncHandler(async (req: Request, res: Response) => {
  const filter: any = { hospitalId: req.hospitalId };
  if (req.query.status) filter.status = req.query.status;
  else filter.status = 'Open';

  const alerts = await ReconciliationAlert.find(filter)
    .populate('patientId', 'name patientId')
    .populate('itemId', 'name itemCode')
    .sort({ createdAt: -1 })
    .limit(100);

  return sendResponse(res, 200, 'Reconciliation alerts', alerts);
});

export const resolveAlert = asyncHandler(async (req: Request, res: Response) => {
  const { status = 'Resolved' } = req.body;
  const alert = await ReconciliationAlert.findOneAndUpdate(
    { _id: req.params.id, hospitalId: req.hospitalId },
    {
      $set: {
        status,
        resolvedBy: req.user?.id,
        resolvedAt: new Date(),
      },
    },
    { new: true }
  );
  if (!alert) throw new AppError('Alert not found', 404);
  return sendResponse(res, 200, 'Alert updated', alert);
});

export const recentUsages = asyncHandler(async (req: Request, res: Response) => {
  const filter: any = { hospitalId: req.hospitalId };
  if (req.query.patientId) filter.patientId = req.query.patientId;
  if (req.query.source) filter.source = req.query.source;

  const usages = await ResourceUsage.find(filter)
    .populate('patientId', 'name patientId')
    .populate('itemId', 'name itemCode')
    .populate('performedBy', 'name')
    .sort({ createdAt: -1 })
    .limit(100);

  return sendResponse(res, 200, 'Recent resource usages', usages);
});
