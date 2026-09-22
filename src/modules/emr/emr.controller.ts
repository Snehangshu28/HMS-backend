import { Request, Response } from 'express';
import { MedicalRecord, Prescription } from './models';
import { Doctor } from '../doctors/models';
import { Appointment } from '../appointments/models';
import { LabTest } from '../laboratory/models';
import { Invoice } from '../billing/models';
import { Admission } from '../ipd/models';
import { appendChargesToPatientBill } from '../billing/billing.service';
import { AppError, asyncHandler, sendResponse } from '../../common';

const resolveDoctorId = async (req: Request, bodyDoctorId?: string) => {
  if (bodyDoctorId) return bodyDoctorId;
  if (req.user?.role === 'Doctor') {
    // JWT id may be ObjectId-string; match flexibly
    let profile = await Doctor.findOne({ userId: req.user.id, hospitalId: req.hospitalId });
    if (!profile) {
      profile = await Doctor.findOne({ hospitalId: req.hospitalId }).where('userId').equals(req.user.id);
    }
    if (!profile) throw new AppError('Doctor profile not found for this user', 404);
    return profile._id.toString();
  }
  throw new AppError('Doctor ID is required', 400);
};

/** OPD appointments for the day + active IPD admissions assigned to this doctor */
export const getMyAssignedPatients = asyncHandler(async (req: Request, res: Response) => {
  const doctorId = await resolveDoctorId(req);
  const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const appointments = await Appointment.find({
    hospitalId: req.hospitalId,
    doctorId,
    scheduledDate: { $gte: start, $lte: end },
    status: { $nin: ['Cancelled'] },
  })
    .populate('patientId', 'name patientId contact.phone gender dateOfBirth bloodGroup')
    .sort({ startTime: 1 });

  const admissions = await Admission.find({
    hospitalId: req.hospitalId,
    admittedBy: doctorId,
    status: 'Admitted',
  })
    .populate('patientId', 'name patientId contact.phone gender dateOfBirth bloodGroup')
    .populate('wardId', 'name category')
    .populate('bedId', 'bedNumber type')
    .sort({ admissionDate: -1 });

  return sendResponse(res, 200, 'Assigned patients retrieved', {
    doctorId,
    date,
    appointments,
    admissions,
  });
});

export const createMedicalRecord = asyncHandler(async (req: Request, res: Response) => {
  const { patientId, appointmentId, soapNotes, diagnoses, treatments } = req.body;
  const doctorId = await resolveDoctorId(req, req.body.doctorId);

  if (!patientId || !soapNotes) {
    throw new AppError('Patient ID and SOAP Notes are required', 400);
  }

  const record = await MedicalRecord.create({
    hospitalId: req.hospitalId,
    patientId,
    doctorId,
    appointmentId,
    soapNotes: {
      subjective: soapNotes.subjective || '',
      objective: soapNotes.objective || '',
      assessment: soapNotes.assessment || '',
      plan: soapNotes.plan || '',
    },
    diagnoses,
    treatments,
  });

  return sendResponse(res, 201, 'Medical record created successfully', record);
});

export const getPatientMedicalHistory = asyncHandler(async (req: Request, res: Response) => {
  const { patientId } = req.params;

  const records = await MedicalRecord.find({ patientId, hospitalId: req.hospitalId })
    .populate({
      path: 'doctorId',
      populate: { path: 'userId', select: 'name' },
    })
    .sort({ recordDate: -1 });

  return sendResponse(res, 200, 'Medical history retrieved successfully', records);
});

export const createPrescription = asyncHandler(async (req: Request, res: Response) => {
  const { medicalRecordId, patientId, medicines, notes, padImage, uploads, appointmentId } = req.body;
  const doctorId = await resolveDoctorId(req, req.body.doctorId);

  if (!patientId) {
    throw new AppError('Patient ID is required', 400);
  }

  const hasMeds = Array.isArray(medicines) && medicines.length > 0;
  const hasPad = Boolean(padImage);
  const hasUploads = Array.isArray(uploads) && uploads.length > 0;
  const hasNotes = Boolean(notes && String(notes).trim());

  if (!hasMeds && !hasPad && !hasUploads && !hasNotes) {
    throw new AppError('Add medicines, handwritten pad, upload, or notes for the prescription', 400);
  }

  const prescription = await Prescription.create({
    hospitalId: req.hospitalId,
    medicalRecordId,
    patientId,
    doctorId,
    appointmentId,
    medicines: hasMeds
      ? medicines
      : [{ name: hasPad || hasUploads ? 'See attached prescription' : 'As noted', dosage: '-', frequency: '-', duration: '-' }],
    notes,
    padImage,
    uploads: (uploads || []).map((u: any) => ({
      name: u.name || 'prescription',
      mimeType: u.mimeType || 'image/png',
      dataUrl: u.dataUrl,
      uploadedAt: new Date(),
    })),
    status: 'Issued',
  });

  return sendResponse(res, 201, 'Prescription written successfully', prescription);
});

/** Append another upload / updated pad to existing prescription */
export const updatePrescription = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { medicines, notes, padImage, uploads } = req.body;

  const prescription = await Prescription.findOne({ _id: id, hospitalId: req.hospitalId });
  if (!prescription) throw new AppError('Prescription not found', 404);

  if (medicines) prescription.medicines = medicines;
  if (notes !== undefined) prescription.notes = notes;
  if (padImage) prescription.padImage = padImage;
  if (Array.isArray(uploads) && uploads.length) {
    prescription.uploads.push(
      ...uploads.map((u: any) => ({
        name: u.name || 'prescription',
        mimeType: u.mimeType || 'image/png',
        dataUrl: u.dataUrl,
        uploadedAt: new Date(),
      }))
    );
  }
  prescription.status = 'Updated';
  await prescription.save();

  return sendResponse(res, 200, 'Prescription updated', prescription);
});

export const getPrescriptions = asyncHandler(async (req: Request, res: Response) => {
  const { patientId, doctorId } = req.query;

  const query: any = { hospitalId: req.hospitalId };
  if (patientId) query.patientId = patientId;
  if (doctorId) query.doctorId = doctorId;

  // Doctors only see their own unless admin
  if (req.user?.role === 'Doctor' && !doctorId) {
    const profile = await Doctor.findOne({ userId: req.user.id, hospitalId: req.hospitalId });
    if (profile) query.doctorId = profile._id;
  }

  const prescriptions = await Prescription.find(query)
    .populate('patientId', 'name patientId contact.phone')
    .populate({
      path: 'doctorId',
      populate: { path: 'userId', select: 'name' },
    })
    .sort({ date: -1 })
    .limit(100);

  // Strip huge dataUrls in list view for performance — return flags instead
  const lean = prescriptions.map((p) => {
    const obj = p.toObject();
    return {
      ...obj,
      padImage: obj.padImage ? '[pad]' : undefined,
      hasPad: Boolean(obj.padImage),
      uploadCount: obj.uploads?.length || 0,
      uploads: (obj.uploads || []).map((u: any) => ({
        name: u.name,
        mimeType: u.mimeType,
        uploadedAt: u.uploadedAt,
        hasData: Boolean(u.dataUrl),
      })),
    };
  });

  return sendResponse(res, 200, 'Prescriptions retrieved successfully', lean);
});

export const getPrescriptionById = asyncHandler(async (req: Request, res: Response) => {
  const prescription = await Prescription.findOne({ _id: req.params.id, hospitalId: req.hospitalId })
    .populate('patientId', 'name patientId contact.phone gender bloodGroup')
    .populate({
      path: 'doctorId',
      populate: { path: 'userId', select: 'name email' },
    });

  if (!prescription) throw new AppError('Prescription not found', 404);
  return sendResponse(res, 200, 'Prescription retrieved', prescription);
});

/**
 * Full checkup: SOAP + prescription (typed/pad/upload) + lab tests
 * Lab tests automatically create / append invoice lines
 */
export const completeCheckup = asyncHandler(async (req: Request, res: Response) => {
  const {
    patientId,
    appointmentId,
    soapNotes,
    diagnoses,
    medicines,
    notes,
    padImage,
    uploads,
    labTests,
  } = req.body;

  const doctorId = await resolveDoctorId(req, req.body.doctorId);

  if (!patientId) throw new AppError('Patient ID is required', 400);

  const record = await MedicalRecord.create({
    hospitalId: req.hospitalId,
    patientId,
    doctorId,
    appointmentId,
    soapNotes: {
      subjective: soapNotes?.subjective || '',
      objective: soapNotes?.objective || '',
      assessment: soapNotes?.assessment || 'Checkup completed',
      plan: soapNotes?.plan || '',
    },
    diagnoses: diagnoses || [],
  });

  const hasMeds = Array.isArray(medicines) && medicines.length > 0;
  const hasPad = Boolean(padImage);
  const hasUploads = Array.isArray(uploads) && uploads.length > 0;
  const hasNotes = Boolean(notes && String(notes).trim());

  let prescription = null;
  if (hasMeds || hasPad || hasUploads || hasNotes) {
    prescription = await Prescription.create({
      hospitalId: req.hospitalId,
      medicalRecordId: record._id,
      patientId,
      doctorId,
      appointmentId,
      medicines: hasMeds
        ? medicines
        : [{ name: 'See attached / handwritten prescription', dosage: '-', frequency: '-', duration: '-' }],
      notes,
      padImage,
      uploads: (uploads || []).map((u: any) => ({
        name: u.name || 'prescription',
        mimeType: u.mimeType || 'image/png',
        dataUrl: u.dataUrl,
        uploadedAt: new Date(),
      })),
      status: 'Issued',
    });
  }

  const createdLabs = [];
  const billItems: any[] = [];

  if (Array.isArray(labTests) && labTests.length) {
    for (const t of labTests) {
      if (!t.testName) continue;
      const fee = Number(t.fee) || 0;
      const code = t.code || `LAB-${Date.now().toString().slice(-6)}`;
      const lab = await LabTest.create({
        hospitalId: req.hospitalId,
        patientId,
        testName: t.testName,
        code,
        fee,
        orderedBy: doctorId,
      });
      createdLabs.push(lab);
      if (fee > 0) {
        billItems.push({
          description: `Laboratory — ${t.testName}`,
          category: 'Lab Test',
          quantity: 1,
          unitPrice: fee,
        });
      }
    }
  }

  if (req.body.addConsultationFee) {
    const fee = Number(req.body.consultationFee) || 500;
    billItems.push({
      description: 'OPD Consultation',
      category: 'Consultation',
      quantity: 1,
      unitPrice: fee,
    });
  }

  let invoice = null;
  if (billItems.length) {
    invoice = await appendChargesToPatientBill(req.hospitalId, patientId, billItems);
  }

  if (appointmentId) {
    await Appointment.findOneAndUpdate(
      { _id: appointmentId, hospitalId: req.hospitalId },
      { status: 'Completed' }
    );
  }

  return sendResponse(res, 201, 'Checkup completed', {
    record,
    prescription,
    labTests: createdLabs,
    invoice,
  });
});
