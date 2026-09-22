import { Request, Response } from 'express';
import { Hospital } from './hospital.model';
import { AppError, asyncHandler, sendResponse } from '../../common';

// @desc    Get current hospital profile
// @route   GET /api/v1/auth/hospital
// @access  Private
export const getHospital = asyncHandler(async (req: Request, res: Response) => {
  if (!req.hospitalId) {
    throw new AppError('No hospital linked to this account', 400);
  }

  const hospital = await Hospital.findById(req.hospitalId);
  if (!hospital) {
    throw new AppError('Hospital not found', 404);
  }

  return sendResponse(res, 200, 'Hospital profile retrieved', hospital);
});

// @desc    Update hospital profile details
// @route   PUT /api/v1/auth/hospital
// @access  Private (Hospital Admin)
export const updateHospital = asyncHandler(async (req: Request, res: Response) => {
  if (!req.hospitalId) {
    throw new AppError('No hospital linked to this account', 400);
  }

  // Do not allow client to flip isActive / subdomain via this endpoint
  const allowed = ['name', 'logo', 'address', 'contact'] as const;
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  // subscription plan display-only fields (not isActive of hospital)
  if (req.body.subscription !== undefined && typeof req.body.subscription === 'object') {
    const sub = req.body.subscription as Record<string, unknown>;
    updates.subscription = {
      plan: sub.plan,
      status: sub.status,
      expiresAt: sub.expiresAt,
    };
  }

  const hospital = await Hospital.findByIdAndUpdate(req.hospitalId, updates, {
    new: true,
    runValidators: true,
  });

  if (!hospital) {
    throw new AppError('Hospital not found', 404);
  }

  return sendResponse(res, 200, 'Hospital profile updated', hospital);
});
