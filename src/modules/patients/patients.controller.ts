import { Request, Response } from 'express';
import { Patient, PatientVitals, PatientHistory, PatientDocument } from './models';
import { AppError, asyncHandler, sendResponse } from '../../common';

// @desc    Register a new Patient
// @route   POST /api/v1/patients
// @access  Private (Receptionist, Doctor, Nurse)
export const createPatient = asyncHandler(async (req: Request, res: Response) => {
  const patientData = {
    ...req.body,
    hospitalId: req.hospitalId
  };

  const newPatient = await Patient.create(patientData);

  // Pre-initialize empty medical history
  await PatientHistory.create({
    hospitalId: req.hospitalId,
    patientId: newPatient._id,
    allergies: [],
    chronicConditions: [],
    surgicalHistory: [],
    familyHistory: []
  });

  return sendResponse(res, 201, 'Patient registered successfully', newPatient);
});

// @desc    Get all patients (paginated, filterable)
// @route   GET /api/v1/patients
// @access  Private (All staff)
export const getPatients = asyncHandler(async (req: Request, res: Response) => {
  const { search, page = 1, limit = 10 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const query: any = {
    hospitalId: req.hospitalId,
    isDeleted: false
  };

  if (search) {
    query.$or = [
      { 'name.first': { $regex: search, $options: 'i' } },
      { 'name.last': { $regex: search, $options: 'i' } },
      { patientId: { $regex: search, $options: 'i' } },
      { 'contact.phone': { $regex: search, $options: 'i' } }
    ];
  }

  const patients = await Patient.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await Patient.countDocuments(query);

  return sendResponse(res, 200, 'Patients retrieved successfully', {
    patients,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit))
  });
});

// @desc    Get single patient details
// @route   GET /api/v1/patients/:id
// @access  Private (All staff, Patient)
export const getPatientById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const patient = await Patient.findOne({ _id: id, hospitalId: req.hospitalId, isDeleted: false });
  if (!patient) {
    throw new AppError('Patient not found', 404);
  }

  const history = await PatientHistory.findOne({ patientId: id, hospitalId: req.hospitalId });
  const vitals = await PatientVitals.find({ patientId: id, hospitalId: req.hospitalId }).sort({ timestamp: -1 }).limit(10);
  const documents = await PatientDocument.find({ patientId: id, hospitalId: req.hospitalId }).sort({ createdAt: -1 });

  return sendResponse(res, 200, 'Patient details retrieved', {
    patient,
    history,
    vitals,
    documents
  });
});

// @desc    Update Patient Profile
// @route   PUT /api/v1/patients/:id
// @access  Private (Receptionist, Doctor, Nurse)
export const updatePatient = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const patient = await Patient.findOneAndUpdate(
    { _id: id, hospitalId: req.hospitalId, isDeleted: false },
    req.body,
    { new: true, runValidators: true }
  );

  if (!patient) {
    throw new AppError('Patient not found', 404);
  }

  return sendResponse(res, 200, 'Patient updated successfully', patient);
});

// @desc    Record Patient Vitals
// @route   POST /api/v1/patients/:id/vitals
// @access  Private (Nurse, Doctor)
export const recordVitals = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { temperature, bloodPressure, heartRate, respiratoryRate, oxygenSaturation } = req.body;

  const patient = await Patient.findOne({ _id: id, hospitalId: req.hospitalId, isDeleted: false });
  if (!patient) {
    throw new AppError('Patient not found', 404);
  }

  const vitals = await PatientVitals.create({
    hospitalId: req.hospitalId,
    patientId: id,
    recordedBy: req.user?.id,
    vitals: {
      temperature,
      bloodPressure,
      heartRate,
      respiratoryRate,
      oxygenSaturation
    }
  });

  return sendResponse(res, 201, 'Vitals recorded successfully', vitals);
});

// @desc    Update Patient Medical History
// @route   PUT /api/v1/patients/:id/history
// @access  Private (Doctor, Nurse)
export const updateHistory = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { allergies, chronicConditions, surgicalHistory, familyHistory } = req.body;

  const history = await PatientHistory.findOneAndUpdate(
    { patientId: id, hospitalId: req.hospitalId },
    { allergies, chronicConditions, surgicalHistory, familyHistory },
    { new: true, runValidators: true, upsert: true }
  );

  return sendResponse(res, 200, 'Patient medical history updated', history);
});
