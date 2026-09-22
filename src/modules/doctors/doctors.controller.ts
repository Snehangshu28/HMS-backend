import { Request, Response } from 'express';
import { Doctor, DoctorSchedule } from './models';
import { User } from '../auth/user.model';
import { AppError, asyncHandler, sendResponse } from '../../common';

const toArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
};

export const registerDoctor = asyncHandler(async (req: Request, res: Response) => {
  const {
    email,
    password,
    firstName,
    lastName,
    phone,
    licenseNumber,
    specialization,
    qualification,
    experienceYears,
    consultationFee,
  } = req.body;

  if (!email || !password || !firstName || !lastName || !licenseNumber || experienceYears === undefined || consultationFee === undefined) {
    throw new AppError('Missing required doctor registration fields', 400);
  }

  const specs = toArray(specialization);
  const quals = toArray(qualification);
  if (!specs.length || !quals.length) {
    throw new AppError('Specialization and qualification are required', 400);
  }

  const exists = await User.findOne({ email: String(email).toLowerCase() });
  if (exists) {
    throw new AppError('A user with this email already exists', 400);
  }

  const user = await User.create({
    hospitalId: req.hospitalId,
    email: String(email).toLowerCase().trim(),
    passwordHash: password,
    role: 'Doctor',
    name: { first: firstName.trim(), last: lastName.trim() },
    phone,
    isActive: true,
  });

  const doctor = await Doctor.create({
    hospitalId: req.hospitalId,
    userId: user._id,
    licenseNumber,
    specialization: specs,
    qualification: quals,
    experienceYears: Number(experienceYears),
    consultationFee: Number(consultationFee),
    isAvailable: true,
  });

  await DoctorSchedule.create({
    hospitalId: req.hospitalId,
    doctorId: doctor._id,
    weeklySlots: [
      { dayOfWeek: 'Monday', startTime: '09:00', endTime: '13:00', slotDuration: 15 },
      { dayOfWeek: 'Tuesday', startTime: '09:00', endTime: '13:00', slotDuration: 15 },
      { dayOfWeek: 'Wednesday', startTime: '09:00', endTime: '13:00', slotDuration: 15 },
      { dayOfWeek: 'Thursday', startTime: '09:00', endTime: '13:00', slotDuration: 15 },
      { dayOfWeek: 'Friday', startTime: '09:00', endTime: '13:00', slotDuration: 15 },
    ],
    exceptions: [],
  });

  const populated = await Doctor.findById(doctor._id).populate({
    path: 'userId',
    select: 'name email phone avatar isActive',
  });

  return sendResponse(res, 201, 'Doctor registered successfully', populated);
});

export const createDoctorProfile = asyncHandler(async (req: Request, res: Response) => {
  const { userId, licenseNumber, specialization, qualification, experienceYears, consultationFee } = req.body;

  if (!userId || !licenseNumber || !specialization || !qualification || experienceYears === undefined || consultationFee === undefined) {
    throw new AppError('Please provide all doctor profile fields', 400);
  }

  const user = await User.findOne({ _id: userId, hospitalId: req.hospitalId, role: 'Doctor' });
  if (!user) {
    throw new AppError('Doctor user not found', 404);
  }

  const existingProfile = await Doctor.findOne({ userId });
  if (existingProfile) {
    throw new AppError('Doctor profile already exists for this user', 400);
  }

  const doctor = await Doctor.create({
    hospitalId: req.hospitalId,
    userId,
    licenseNumber,
    specialization: toArray(specialization),
    qualification: toArray(qualification),
    experienceYears,
    consultationFee,
  });

  await DoctorSchedule.create({
    hospitalId: req.hospitalId,
    doctorId: doctor._id,
    weeklySlots: [],
  });

  return sendResponse(res, 201, 'Doctor profile created successfully', doctor);
});

export const getDoctors = asyncHandler(async (req: Request, res: Response) => {
  const doctors = await Doctor.find({ hospitalId: req.hospitalId }).populate({
    path: 'userId',
    select: 'name email phone avatar isActive',
  });

  return sendResponse(res, 200, 'Doctors retrieved successfully', doctors);
});

export const getDoctorProfile = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const doctor = await Doctor.findOne({ _id: id, hospitalId: req.hospitalId }).populate({
    path: 'userId',
    select: 'name email phone avatar isActive',
  });

  if (!doctor) {
    throw new AppError('Doctor profile not found', 404);
  }

  const schedule = await DoctorSchedule.findOne({ doctorId: id });

  return sendResponse(res, 200, 'Doctor profile retrieved', { doctor, schedule });
});

export const updateDoctorProfile = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const body = { ...req.body };

  if (body.specialization !== undefined) body.specialization = toArray(body.specialization);
  if (body.qualification !== undefined) body.qualification = toArray(body.qualification);

  const doctor = await Doctor.findOne({ _id: id, hospitalId: req.hospitalId });
  if (!doctor) {
    throw new AppError('Doctor profile not found', 404);
  }

  const shouldUpdateUser =
    body.firstName ||
    body.lastName ||
    body.phone !== undefined ||
    typeof body.isActive === 'boolean' ||
    body.email ||
    body.password;

  if (shouldUpdateUser) {
    const user = await User.findById(doctor.userId);
    if (user) {
      if (body.firstName) user.name.first = body.firstName;
      if (body.lastName) user.name.last = body.lastName;
      if (body.phone !== undefined) user.phone = body.phone;
      if (typeof body.isActive === 'boolean') user.isActive = body.isActive;
      if (body.email) user.email = String(body.email).toLowerCase().trim();
      if (body.password !== undefined && String(body.password).length > 0) {
        // Accept any password including numbers (e.g. 8765454334)
        user.passwordHash = String(body.password);
      }
      await user.save();
    }
  }

  delete body.firstName;
  delete body.lastName;
  delete body.phone;
  delete body.email;
  delete body.isActive;
  delete body.password;

  Object.assign(doctor, body);
  await doctor.save();

  const populated = await Doctor.findById(doctor._id).populate({
    path: 'userId',
    select: 'name email phone avatar isActive',
  });

  return sendResponse(res, 200, 'Doctor profile updated successfully', populated);
});

export const updateDoctorSchedule = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { weeklySlots, exceptions } = req.body;

  const schedule = await DoctorSchedule.findOneAndUpdate(
    { doctorId: id, hospitalId: req.hospitalId },
    { weeklySlots, exceptions },
    { new: true, runValidators: true, upsert: true }
  );

  return sendResponse(res, 200, 'Doctor schedule updated successfully', schedule);
});
