"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActiveQueue = exports.updateQueueStatus = exports.updateAppointmentStatus = exports.getAppointments = exports.createAppointment = void 0;
const models_1 = require("./models");
const common_1 = require("../../common");
const sockets_1 = require("../../sockets");
// @desc    Book a new appointment and add to active doctor queue
// @route   POST /api/v1/appointments
// @access  Private (Patient, Receptionist)
exports.createAppointment = (0, common_1.asyncHandler)(async (req, res) => {
    const { patientId, doctorId, scheduledDate, startTime, endTime, type, notes } = req.body;
    if (!patientId || !doctorId || !scheduledDate || !startTime || !endTime) {
        throw new common_1.AppError('Missing required appointment fields', 400);
    }
    const hospitalId = req.hospitalId;
    const appointment = await models_1.Appointment.create({
        hospitalId,
        patientId,
        doctorId,
        scheduledDate: new Date(scheduledDate),
        startTime,
        endTime,
        type,
        notes
    });
    const startOfDay = new Date(scheduledDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(scheduledDate);
    endOfDay.setHours(23, 59, 59, 999);
    // Manage Live Queue
    let queue = await models_1.Queue.findOne({
        hospitalId,
        doctorId,
        date: { $gte: startOfDay, $lte: endOfDay }
    });
    const queueItem = {
        appointmentId: appointment._id,
        patientId,
        tokenNumber: queue ? queue.activeQueue.length + 1 : 1,
        status: 'Waiting'
    };
    if (queue) {
        queue.activeQueue.push(queueItem);
        await queue.save();
    }
    else {
        queue = await models_1.Queue.create({
            hospitalId,
            doctorId,
            date: startOfDay,
            activeQueue: [queueItem]
        });
    }
    const populatedQueue = await models_1.Queue.findById(queue._id)
        .populate('activeQueue.patientId', 'name patientId contact.phone');
    // Broadcast real-time update
    (0, sockets_1.broadcastQueueUpdate)(hospitalId.toString(), doctorId.toString(), populatedQueue);
    return (0, common_1.sendResponse)(res, 201, 'Appointment booked and queued successfully', appointment);
});
// @desc    Get appointments list
// @route   GET /api/v1/appointments
// @access  Private (All staff)
exports.getAppointments = (0, common_1.asyncHandler)(async (req, res) => {
    const { doctorId, patientId, date } = req.query;
    const query = { hospitalId: req.hospitalId };
    if (doctorId)
        query.doctorId = doctorId;
    if (patientId)
        query.patientId = patientId;
    if (date) {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        query.scheduledDate = { $gte: start, $lte: end };
    }
    const appointments = await models_1.Appointment.find(query)
        .populate('patientId', 'name patientId contact.phone')
        .populate({
        path: 'doctorId',
        populate: { path: 'userId', select: 'name specialization' }
    })
        .sort({ scheduledDate: 1, startTime: 1 });
    return (0, common_1.sendResponse)(res, 200, 'Appointments retrieved successfully', appointments);
});
// @desc    Update Appointment Status
// @route   PUT /api/v1/appointments/:id
// @access  Private (Receptionist, Doctor, Nurse)
exports.updateAppointmentStatus = (0, common_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { status, cancellationReason } = req.body;
    const appointment = await models_1.Appointment.findOneAndUpdate({ _id: id, hospitalId: req.hospitalId }, { status, cancellationReason }, { new: true, runValidators: true });
    if (!appointment) {
        throw new common_1.AppError('Appointment not found', 404);
    }
    return (0, common_1.sendResponse)(res, 200, 'Appointment status updated', appointment);
});
// @desc    Update Live Queue Status
// @route   PUT /api/v1/appointments/queue/:id
// @access  Private (Receptionist, Doctor, Nurse)
exports.updateQueueStatus = (0, common_1.asyncHandler)(async (req, res) => {
    const { id } = req.params; // Queue ID
    const { appointmentId, status } = req.body;
    const queue = await models_1.Queue.findOne({ _id: id, hospitalId: req.hospitalId });
    if (!queue) {
        throw new common_1.AppError('Queue tracker not found', 404);
    }
    const patientIndex = queue.activeQueue.findIndex(item => item.appointmentId.toString() === appointmentId);
    if (patientIndex === -1) {
        throw new common_1.AppError('Patient not found in this queue', 404);
    }
    queue.activeQueue[patientIndex].status = status;
    await queue.save();
    // Cascade status update to the underlying appointment
    if (status === 'In-Consultation') {
        await models_1.Appointment.findByIdAndUpdate(appointmentId, { status: 'In-Progress' });
    }
    else if (status === 'Completed') {
        await models_1.Appointment.findByIdAndUpdate(appointmentId, { status: 'Completed' });
    }
    const populatedQueue = await models_1.Queue.findById(queue._id)
        .populate('activeQueue.patientId', 'name patientId contact.phone');
    // Broadcast real-time change to all screens
    (0, sockets_1.broadcastQueueUpdate)(req.hospitalId.toString(), queue.doctorId.toString(), populatedQueue);
    return (0, common_1.sendResponse)(res, 200, 'Queue status updated successfully', populatedQueue);
});
// @desc    Get Active Daily Queue for a Doctor
// @route   GET /api/v1/appointments/queue/active
// @access  Private (All staff)
exports.getActiveQueue = (0, common_1.asyncHandler)(async (req, res) => {
    const { doctorId, date } = req.query;
    if (!doctorId || !date) {
        throw new common_1.AppError('Doctor ID and Date are required to fetch queue', 400);
    }
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    const queue = await models_1.Queue.findOne({
        hospitalId: req.hospitalId,
        doctorId,
        date: { $gte: startOfDay, $lte: endOfDay }
    }).populate('activeQueue.patientId', 'name patientId contact.phone');
    return (0, common_1.sendResponse)(res, 200, 'Active queue retrieved successfully', queue || { activeQueue: [] });
});
