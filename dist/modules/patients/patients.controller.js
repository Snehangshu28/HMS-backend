"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateHistory = exports.recordVitals = exports.updatePatient = exports.getPatientById = exports.getPatients = exports.createPatient = void 0;
const models_1 = require("./models");
const common_1 = require("../../common");
// @desc    Register a new Patient
// @route   POST /api/v1/patients
// @access  Private (Receptionist, Doctor, Nurse)
exports.createPatient = (0, common_1.asyncHandler)(async (req, res) => {
    const patientData = {
        ...req.body,
        hospitalId: req.hospitalId
    };
    const newPatient = await models_1.Patient.create(patientData);
    // Pre-initialize empty medical history
    await models_1.PatientHistory.create({
        hospitalId: req.hospitalId,
        patientId: newPatient._id,
        allergies: [],
        chronicConditions: [],
        surgicalHistory: [],
        familyHistory: []
    });
    return (0, common_1.sendResponse)(res, 201, 'Patient registered successfully', newPatient);
});
// @desc    Get all patients (paginated, filterable)
// @route   GET /api/v1/patients
// @access  Private (All staff)
exports.getPatients = (0, common_1.asyncHandler)(async (req, res) => {
    const { search, page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const query = {
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
    const patients = await models_1.Patient.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));
    const total = await models_1.Patient.countDocuments(query);
    return (0, common_1.sendResponse)(res, 200, 'Patients retrieved successfully', {
        patients,
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit))
    });
});
// @desc    Get single patient details
// @route   GET /api/v1/patients/:id
// @access  Private (All staff, Patient)
exports.getPatientById = (0, common_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const patient = await models_1.Patient.findOne({ _id: id, hospitalId: req.hospitalId, isDeleted: false });
    if (!patient) {
        throw new common_1.AppError('Patient not found', 404);
    }
    const history = await models_1.PatientHistory.findOne({ patientId: id, hospitalId: req.hospitalId });
    const vitals = await models_1.PatientVitals.find({ patientId: id, hospitalId: req.hospitalId }).sort({ timestamp: -1 }).limit(10);
    const documents = await models_1.PatientDocument.find({ patientId: id, hospitalId: req.hospitalId }).sort({ createdAt: -1 });
    return (0, common_1.sendResponse)(res, 200, 'Patient details retrieved', {
        patient,
        history,
        vitals,
        documents
    });
});
// @desc    Update Patient Profile
// @route   PUT /api/v1/patients/:id
// @access  Private (Receptionist, Doctor, Nurse)
exports.updatePatient = (0, common_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const patient = await models_1.Patient.findOneAndUpdate({ _id: id, hospitalId: req.hospitalId, isDeleted: false }, req.body, { new: true, runValidators: true });
    if (!patient) {
        throw new common_1.AppError('Patient not found', 404);
    }
    return (0, common_1.sendResponse)(res, 200, 'Patient updated successfully', patient);
});
// @desc    Record Patient Vitals
// @route   POST /api/v1/patients/:id/vitals
// @access  Private (Nurse, Doctor)
exports.recordVitals = (0, common_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { temperature, bloodPressure, heartRate, respiratoryRate, oxygenSaturation } = req.body;
    const patient = await models_1.Patient.findOne({ _id: id, hospitalId: req.hospitalId, isDeleted: false });
    if (!patient) {
        throw new common_1.AppError('Patient not found', 404);
    }
    const vitals = await models_1.PatientVitals.create({
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
    return (0, common_1.sendResponse)(res, 201, 'Vitals recorded successfully', vitals);
});
// @desc    Update Patient Medical History
// @route   PUT /api/v1/patients/:id/history
// @access  Private (Doctor, Nurse)
exports.updateHistory = (0, common_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { allergies, chronicConditions, surgicalHistory, familyHistory } = req.body;
    const history = await models_1.PatientHistory.findOneAndUpdate({ patientId: id, hospitalId: req.hospitalId }, { allergies, chronicConditions, surgicalHistory, familyHistory }, { new: true, runValidators: true, upsert: true });
    return (0, common_1.sendResponse)(res, 200, 'Patient medical history updated', history);
});
