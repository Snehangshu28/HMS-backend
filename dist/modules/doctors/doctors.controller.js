"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDoctorSchedule = exports.updateDoctorProfile = exports.getDoctorProfile = exports.getDoctors = exports.createDoctorProfile = void 0;
const models_1 = require("./models");
const user_model_1 = require("../auth/user.model");
const common_1 = require("../../common");
// @desc    Create Doctor Profile
// @route   POST /api/v1/doctors
// @access  Private (Hospital Admin)
exports.createDoctorProfile = (0, common_1.asyncHandler)(async (req, res) => {
    const { userId, licenseNumber, specialization, qualification, experienceYears, consultationFee } = req.body;
    if (!userId || !licenseNumber || !specialization || !qualification || !experienceYears || !consultationFee) {
        throw new common_1.AppError('Please provide all doctor profile fields', 400);
    }
    const user = await user_model_1.User.findOne({ _id: userId, hospitalId: req.hospitalId, role: 'Doctor' });
    if (!user) {
        throw new common_1.AppError('Doctor user not found', 404);
    }
    const existingProfile = await models_1.Doctor.findOne({ userId });
    if (existingProfile) {
        throw new common_1.AppError('Doctor profile already exists for this user', 400);
    }
    const doctor = await models_1.Doctor.create({
        hospitalId: req.hospitalId,
        userId,
        licenseNumber,
        specialization,
        qualification,
        experienceYears,
        consultationFee
    });
    // Pre-create empty schedule
    await models_1.DoctorSchedule.create({
        hospitalId: req.hospitalId,
        doctorId: doctor._id,
        weeklySlots: []
    });
    return (0, common_1.sendResponse)(res, 201, 'Doctor profile created successfully', doctor);
});
// @desc    Get all doctors list (with profiles and user info)
// @route   GET /api/v1/doctors
// @access  Private (All staff)
exports.getDoctors = (0, common_1.asyncHandler)(async (req, res) => {
    const doctors = await models_1.Doctor.find({ hospitalId: req.hospitalId })
        .populate({
        path: 'userId',
        select: 'name email phone avatar isActive'
    });
    return (0, common_1.sendResponse)(res, 200, 'Doctors retrieved successfully', doctors);
});
// @desc    Get single doctor profile and schedule
// @route   GET /api/v1/doctors/:id
// @access  Private (All staff, Patient)
exports.getDoctorProfile = (0, common_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const doctor = await models_1.Doctor.findOne({ _id: id, hospitalId: req.hospitalId })
        .populate({
        path: 'userId',
        select: 'name email phone avatar isActive'
    });
    if (!doctor) {
        throw new common_1.AppError('Doctor profile not found', 404);
    }
    const schedule = await models_1.DoctorSchedule.findOne({ doctorId: id });
    return (0, common_1.sendResponse)(res, 200, 'Doctor profile retrieved', { doctor, schedule });
});
// @desc    Update Doctor Profile
// @route   PUT /api/v1/doctors/:id
// @access  Private (Hospital Admin, Doctor themselves)
exports.updateDoctorProfile = (0, common_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const doctor = await models_1.Doctor.findOneAndUpdate({ _id: id, hospitalId: req.hospitalId }, req.body, { new: true, runValidators: true });
    if (!doctor) {
        throw new common_1.AppError('Doctor profile not found', 404);
    }
    return (0, common_1.sendResponse)(res, 200, 'Doctor profile updated successfully', doctor);
});
// @desc    Update Doctor Schedule
// @route   PUT /api/v1/doctors/:id/schedule
// @access  Private (Hospital Admin, Doctor themselves)
exports.updateDoctorSchedule = (0, common_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { weeklySlots, exceptions } = req.body;
    const schedule = await models_1.DoctorSchedule.findOneAndUpdate({ doctorId: id, hospitalId: req.hospitalId }, { weeklySlots, exceptions }, { new: true, runValidators: true, upsert: true });
    return (0, common_1.sendResponse)(res, 200, 'Doctor schedule updated successfully', schedule);
});
