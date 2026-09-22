"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrescriptions = exports.createPrescription = exports.getPatientMedicalHistory = exports.createMedicalRecord = void 0;
const models_1 = require("./models");
const common_1 = require("../../common");
// @desc    Create new medical record (SOAP note)
// @route   POST /api/v1/emr/records
// @access  Private (Doctor)
exports.createMedicalRecord = (0, common_1.asyncHandler)(async (req, res) => {
    const { patientId, doctorId, appointmentId, soapNotes, diagnoses, treatments } = req.body;
    if (!patientId || !doctorId || !soapNotes) {
        throw new common_1.AppError('Patient ID, Doctor ID, and SOAP Notes are required', 400);
    }
    const record = await models_1.MedicalRecord.create({
        hospitalId: req.hospitalId,
        patientId,
        doctorId,
        appointmentId,
        soapNotes,
        diagnoses,
        treatments
    });
    return (0, common_1.sendResponse)(res, 201, 'Medical record created successfully', record);
});
// @desc    Get patient EMR history list
// @route   GET /api/v1/emr/records/:patientId
// @access  Private (Doctor, Nurse, Patient)
exports.getPatientMedicalHistory = (0, common_1.asyncHandler)(async (req, res) => {
    const { patientId } = req.params;
    const records = await models_1.MedicalRecord.find({ patientId, hospitalId: req.hospitalId })
        .populate({
        path: 'doctorId',
        populate: { path: 'userId', select: 'name' }
    })
        .sort({ recordDate: -1 });
    return (0, common_1.sendResponse)(res, 200, 'Medical history retrieved successfully', records);
});
// @desc    Write a new prescription
// @route   POST /api/v1/emr/prescriptions
// @access  Private (Doctor)
exports.createPrescription = (0, common_1.asyncHandler)(async (req, res) => {
    const { medicalRecordId, patientId, doctorId, medicines, notes } = req.body;
    if (!patientId || !doctorId || !medicines || !medicines.length) {
        throw new common_1.AppError('Patient ID, Doctor ID, and at least one medicine are required', 400);
    }
    const prescription = await models_1.Prescription.create({
        hospitalId: req.hospitalId,
        medicalRecordId,
        patientId,
        doctorId,
        medicines,
        notes
    });
    return (0, common_1.sendResponse)(res, 201, 'Prescription written successfully', prescription);
});
// @desc    Get prescriptions
// @route   GET /api/v1/emr/prescriptions
// @access  Private (Doctor, Pharmacist, Patient)
exports.getPrescriptions = (0, common_1.asyncHandler)(async (req, res) => {
    const { patientId, doctorId } = req.query;
    const query = { hospitalId: req.hospitalId };
    if (patientId)
        query.patientId = patientId;
    if (doctorId)
        query.doctorId = doctorId;
    const prescriptions = await models_1.Prescription.find(query)
        .populate('patientId', 'name patientId')
        .populate({
        path: 'doctorId',
        populate: { path: 'userId', select: 'name' }
    })
        .sort({ date: -1 });
    return (0, common_1.sendResponse)(res, 200, 'Prescriptions retrieved successfully', prescriptions);
});
