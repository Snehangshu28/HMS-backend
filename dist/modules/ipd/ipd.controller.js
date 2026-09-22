"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdmissions = exports.dischargePatient = exports.admitPatient = exports.getWardsAndBeds = exports.createBed = exports.createWard = void 0;
const models_1 = require("./models");
const common_1 = require("../../common");
// @desc    Configure a new Ward
// @route   POST /api/v1/ipd/wards
// @access  Private (Hospital Admin)
exports.createWard = (0, common_1.asyncHandler)(async (req, res) => {
    const { name, category, capacity } = req.body;
    if (!name || !category || !capacity) {
        throw new common_1.AppError('Ward name, category, and capacity are required', 400);
    }
    const ward = await models_1.Ward.create({
        hospitalId: req.hospitalId,
        name,
        category,
        capacity
    });
    return (0, common_1.sendResponse)(res, 201, 'Ward created successfully', ward);
});
// @desc    Add a Bed inside a Ward
// @route   POST /api/v1/ipd/beds
// @access  Private (Hospital Admin)
exports.createBed = (0, common_1.asyncHandler)(async (req, res) => {
    const { wardId, bedNumber, type } = req.body;
    if (!wardId || !bedNumber || !type) {
        throw new common_1.AppError('Ward ID, bed number, and bed type are required', 400);
    }
    const ward = await models_1.Ward.findOne({ _id: wardId, hospitalId: req.hospitalId });
    if (!ward) {
        throw new common_1.AppError('Ward not found', 404);
    }
    const bedCount = await models_1.Bed.countDocuments({ wardId });
    if (bedCount >= ward.capacity) {
        throw new common_1.AppError('Ward capacity exceeded', 400);
    }
    const bed = await models_1.Bed.create({
        hospitalId: req.hospitalId,
        wardId,
        bedNumber,
        type
    });
    return (0, common_1.sendResponse)(res, 201, 'Bed configured successfully', bed);
});
// @desc    Get Wards and Beds layout
// @route   GET /api/v1/ipd/layout
// @access  Private (All staff)
exports.getWardsAndBeds = (0, common_1.asyncHandler)(async (req, res) => {
    const wards = await models_1.Ward.find({ hospitalId: req.hospitalId });
    const beds = await models_1.Bed.find({ hospitalId: req.hospitalId });
    return (0, common_1.sendResponse)(res, 200, 'Wards and beds layout retrieved', { wards, beds });
});
// @desc    Process IPD Admission
// @route   POST /api/v1/ipd/admissions
// @access  Private (Doctor, Receptionist)
exports.admitPatient = (0, common_1.asyncHandler)(async (req, res) => {
    const { patientId, admittedBy, reason, wardId, bedId, primaryNurse } = req.body;
    if (!patientId || !admittedBy || !reason || !wardId || !bedId) {
        throw new common_1.AppError('All details are required to process IPD admission', 400);
    }
    const hospitalId = req.hospitalId;
    const bed = await models_1.Bed.findOne({ _id: bedId, hospitalId, status: 'Available' });
    if (!bed) {
        throw new common_1.AppError('Selected bed is occupied or under maintenance', 400);
    }
    const admission = await models_1.Admission.create({
        hospitalId,
        patientId,
        admittedBy,
        reason,
        wardId,
        bedId,
        primaryNurse,
        status: 'Admitted'
    });
    bed.status = 'Occupied';
    await bed.save();
    return (0, common_1.sendResponse)(res, 201, 'Patient admitted to IPD ward', admission);
});
// @desc    Process IPD Patient Discharge
// @route   POST /api/v1/ipd/admissions/:id/discharge
// @access  Private (Doctor, Nurse)
exports.dischargePatient = (0, common_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { conditionAtDischarge, advice, notes } = req.body;
    if (!conditionAtDischarge) {
        throw new common_1.AppError('Condition at discharge is required', 400);
    }
    const admission = await models_1.Admission.findOne({ _id: id, hospitalId: req.hospitalId, status: 'Admitted' });
    if (!admission) {
        throw new common_1.AppError('Active IPD admission record not found', 404);
    }
    admission.status = 'Discharged';
    admission.dischargeSummary = {
        dischargeDate: new Date(),
        conditionAtDischarge,
        advice,
        notes
    };
    await admission.save();
    await models_1.Bed.findByIdAndUpdate(admission.bedId, { status: 'Available' });
    return (0, common_1.sendResponse)(res, 200, 'Patient discharged successfully', admission);
});
// @desc    List IPD Admissions
// @route   GET /api/v1/ipd/admissions
// @access  Private (All staff)
exports.getAdmissions = (0, common_1.asyncHandler)(async (req, res) => {
    const admissions = await models_1.Admission.find({ hospitalId: req.hospitalId })
        .populate('patientId', 'name patientId contact.phone')
        .populate({
        path: 'admittedBy',
        populate: { path: 'userId', select: 'name' }
    })
        .populate('wardId', 'name category')
        .populate('bedId', 'bedNumber type')
        .populate('primaryNurse', 'name')
        .sort({ admissionDate: -1 });
    return (0, common_1.sendResponse)(res, 200, 'IPD Admissions retrieved successfully', admissions);
});
