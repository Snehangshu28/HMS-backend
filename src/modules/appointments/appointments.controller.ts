import { Request, Response } from 'express';
import { Appointment, Queue } from './models';
import { AppError, asyncHandler, sendResponse } from '../../common';
import { broadcastQueueUpdate } from '../../sockets';

// @desc    Book a new appointment and add to active doctor queue
// @route   POST /api/v1/appointments
// @access  Private (Patient, Receptionist)
export const createAppointment = asyncHandler(async (req: Request, res: Response) => {
  const { patientId, doctorId, scheduledDate, startTime, endTime, type, notes } = req.body;

  if (!patientId || !doctorId || !scheduledDate || !startTime || !endTime) {
    throw new AppError('Missing required appointment fields', 400);
  }

  const hospitalId = req.hospitalId!;
  
  const appointment = await Appointment.create({
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
  let queue = await Queue.findOne({
    hospitalId,
    doctorId,
    date: { $gte: startOfDay, $lte: endOfDay }
  });

  const queueItem = {
    appointmentId: appointment._id,
    patientId,
    tokenNumber: queue ? queue.activeQueue.length + 1 : 1,
    status: 'Waiting' as const
  };

  if (queue) {
    queue.activeQueue.push(queueItem);
    await queue.save();
  } else {
    queue = await Queue.create({
      hospitalId,
      doctorId,
      date: startOfDay,
      activeQueue: [queueItem]
    });
  }

  const populatedQueue = await Queue.findById(queue._id)
    .populate('activeQueue.patientId', 'name patientId contact.phone');

  // Broadcast real-time update
  broadcastQueueUpdate(hospitalId.toString(), doctorId.toString(), populatedQueue);

  return sendResponse(res, 201, 'Appointment booked and queued successfully', appointment);
});

// @desc    Get appointments list
// @route   GET /api/v1/appointments
// @access  Private (All staff)
export const getAppointments = asyncHandler(async (req: Request, res: Response) => {
  const { doctorId, patientId, date } = req.query;

  const query: any = { hospitalId: req.hospitalId };

  if (doctorId) query.doctorId = doctorId;
  if (patientId) query.patientId = patientId;
  if (date) {
    const start = new Date(date as string);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date as string);
    end.setHours(23, 59, 59, 999);
    query.scheduledDate = { $gte: start, $lte: end };
  }

  const appointments = await Appointment.find(query)
    .populate('patientId', 'name patientId contact.phone')
    .populate({
      path: 'doctorId',
      populate: { path: 'userId', select: 'name specialization' }
    })
    .sort({ scheduledDate: 1, startTime: 1 });

  return sendResponse(res, 200, 'Appointments retrieved successfully', appointments);
});

// @desc    Update Appointment Status
// @route   PUT /api/v1/appointments/:id
// @access  Private (Receptionist, Doctor, Nurse)
export const updateAppointmentStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, cancellationReason } = req.body;

  const appointment = await Appointment.findOneAndUpdate(
    { _id: id, hospitalId: req.hospitalId },
    { status, cancellationReason },
    { new: true, runValidators: true }
  );

  if (!appointment) {
    throw new AppError('Appointment not found', 404);
  }

  return sendResponse(res, 200, 'Appointment status updated', appointment);
});

// @desc    Update Live Queue Status
// @route   PUT /api/v1/appointments/queue/:id
// @access  Private (Receptionist, Doctor, Nurse)
export const updateQueueStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params; // Queue ID
  const { appointmentId, status } = req.body;

  const queue = await Queue.findOne({ _id: id, hospitalId: req.hospitalId });
  if (!queue) {
    throw new AppError('Queue tracker not found', 404);
  }

  const patientIndex = queue.activeQueue.findIndex(
    item => item.appointmentId.toString() === appointmentId
  );

  if (patientIndex === -1) {
    throw new AppError('Patient not found in this queue', 404);
  }

  queue.activeQueue[patientIndex].status = status;
  await queue.save();

  // Cascade status update to the underlying appointment
  if (status === 'In-Consultation') {
    await Appointment.findByIdAndUpdate(appointmentId, { status: 'In-Progress' });
  } else if (status === 'Completed') {
    await Appointment.findByIdAndUpdate(appointmentId, { status: 'Completed' });
  }

  const populatedQueue = await Queue.findById(queue._id)
    .populate('activeQueue.patientId', 'name patientId contact.phone');

  // Broadcast real-time change to all screens
  broadcastQueueUpdate(req.hospitalId!.toString(), queue.doctorId.toString(), populatedQueue);

  return sendResponse(res, 200, 'Queue status updated successfully', populatedQueue);
});

// @desc    Get Active Daily Queue for a Doctor
// @route   GET /api/v1/appointments/queue/active
// @access  Private (All staff)
export const getActiveQueue = asyncHandler(async (req: Request, res: Response) => {
  const { doctorId, date } = req.query;

  if (!doctorId || !date) {
    throw new AppError('Doctor ID and Date are required to fetch queue', 400);
  }

  const startOfDay = new Date(date as string);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date as string);
  endOfDay.setHours(23, 59, 59, 999);

  const queue = await Queue.findOne({
    hospitalId: req.hospitalId,
    doctorId,
    date: { $gte: startOfDay, $lte: endOfDay }
  }).populate('activeQueue.patientId', 'name patientId contact.phone');

  return sendResponse(res, 200, 'Active queue retrieved successfully', queue || { activeQueue: [] });
});
