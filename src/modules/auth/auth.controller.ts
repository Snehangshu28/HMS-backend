import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from './user.model';
import { Hospital } from './hospital.model';
import { AppError, asyncHandler, sendResponse } from '../../common';
import { config } from '../../config';

const generateAccessToken = (user: any): string => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      hospitalId: user.hospitalId,
    },
    config.jwtSecret,
    { expiresIn: '15m' }
  );
};

const generateRefreshToken = (user: any): string => {
  return jwt.sign(
    { id: user._id, hospitalId: user.hospitalId },
    config.jwtRefreshSecret,
    { expiresIn: '7d' }
  );
};

const assertHospitalActive = async (hospitalId: any) => {
  if (!hospitalId) return;
  const hospital = await Hospital.findById(hospitalId).select('isActive name');
  if (!hospital || !hospital.isActive) {
    throw new AppError('Hospital account is inactive', 403);
  }
};

// @desc    Register a new Hospital (tenant) and its Hospital Admin owner
// @route   POST /api/v1/auth/signup
// @access  Public
// NOTE: Any client-supplied `role` / `hospitalId` / `tenantId` is ignored.
export const signup = asyncHandler(async (req: Request, res: Response) => {
  const { hospitalName, subdomain, email, password, firstName, lastName } = req.body;

  if (!hospitalName || !subdomain || !email || !password || !firstName || !lastName) {
    throw new AppError('Please provide all required fields', 400);
  }

  if (String(password).length < 6) {
    throw new AppError('Password must be at least 6 characters', 400);
  }

  const normalizedSubdomain = String(subdomain)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-');
  const normalizedEmail = String(email).toLowerCase().trim();

  const existingHospital = await Hospital.findOne({ subdomain: normalizedSubdomain });
  if (existingHospital) {
    throw new AppError('Hospital subdomain is already registered', 400);
  }

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new AppError('User with this email is already registered', 400);
  }

  const newHospital = await Hospital.create({
    name: String(hospitalName).trim(),
    subdomain: normalizedSubdomain,
    isActive: true,
    contact: { email: normalizedEmail },
  });

  // Tenant owner is always Hospital Admin — never taken from request body
  const newAdmin = await User.create({
    hospitalId: newHospital._id,
    email: normalizedEmail,
    passwordHash: password,
    role: 'Hospital Admin',
    name: {
      first: String(firstName).trim(),
      last: String(lastName).trim(),
    },
    isActive: true,
  });

  return sendResponse(res, 201, 'Hospital and Admin registered successfully', {
    hospital: {
      id: newHospital._id,
      name: newHospital.name,
      subdomain: newHospital.subdomain,
    },
    user: {
      id: newAdmin._id,
      email: newAdmin.email,
      role: newAdmin.role,
      name: newAdmin.name,
      hospitalId: newAdmin.hospitalId,
    },
  });
});

// @desc    User Login — role/tenant always from database
// @route   POST /api/v1/auth/login
// @access  Public
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  // Intentionally ignore req.body.role / hospitalId / tenantId

  if (!email || !password) {
    throw new AppError('Please provide email and password', 400);
  }

  const normalizedEmail = String(email).toLowerCase().trim();

  const user = await User.findOne({ email: normalizedEmail });
  if (!user || user.isDeleted || !user.isActive) {
    throw new AppError('Invalid credentials', 401);
  }

  const isMatch = await user.comparePassword(String(password));
  if (!isMatch) {
    throw new AppError('Invalid credentials', 401);
  }

  if (user.role !== 'Super Admin') {
    if (!user.hospitalId) {
      throw new AppError('User is not assigned to a hospital tenant', 403);
    }
    await assertHospitalActive(user.hospitalId);
  }

  await User.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  return sendResponse(res, 200, 'Login successful', {
    user: {
      id: user._id,
      email: user.email,
      role: user.role,
      name: user.name,
      hospitalId: user.hospitalId,
    },
    accessToken,
    refreshToken,
  });
});

// @desc    Refresh Access Token
// @route   POST /api/v1/auth/refresh
// @access  Public
export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AppError('Refresh token is required', 400);
  }

  try {
    const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret) as any;
    const user = await User.findById(decoded.id);

    if (!user || user.isDeleted || !user.isActive) {
      throw new AppError('Invalid refresh token session', 401);
    }

    if (user.role !== 'Super Admin') {
      if (!user.hospitalId) {
        throw new AppError('User is not assigned to a hospital tenant', 403);
      }
      await assertHospitalActive(user.hospitalId);
    }

    const accessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    return sendResponse(res, 200, 'Token refreshed successfully', {
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
        hospitalId: user.hospitalId,
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError('Invalid or expired refresh token', 401);
  }
});
