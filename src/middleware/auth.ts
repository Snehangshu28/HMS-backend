import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError, asyncHandler } from '../common';
import { config } from '../config';
import { IUserPayload } from '../types';
import { User } from '../modules/auth/user.model';
import { Hospital } from '../modules/auth/hospital.model';

/**
 * Authenticate JWT, then re-load user from DB.
 * Role + hospitalId always come from the database — never from request body.
 */
export const protect = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  let token: string | undefined;

  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    throw new AppError('Not authorized to access this route', 401);
  }

  let decoded: IUserPayload;
  try {
    decoded = jwt.verify(token, config.jwtSecret) as IUserPayload;
  } catch {
    throw new AppError('Not authorized to access this route', 401);
  }

  const user = await User.findById(decoded.id).select(
    '_id email role hospitalId isActive isDeleted name'
  );

  if (!user || user.isDeleted) {
    throw new AppError('Not authorized to access this route', 401);
  }

  if (!user.isActive) {
    throw new AppError('Account is inactive. Contact your Hospital Admin.', 403);
  }

  // Super Admin may have no hospital; all other roles must belong to a tenant
  if (user.role !== 'Super Admin') {
    if (!user.hospitalId) {
      throw new AppError('User is not assigned to a hospital tenant', 403);
    }

    const hospital = await Hospital.findById(user.hospitalId).select('isActive');
    if (!hospital || !hospital.isActive) {
      throw new AppError('Hospital account is inactive', 403);
    }
  }

  // Source of truth: database (ignore any role/hospitalId spoofing in JWT if user changed)
  req.user = {
    id: String(user._id),
    email: user.email,
    role: user.role,
    hospitalId: user.hospitalId ? String(user.hospitalId) : '',
  };
  req.hospitalId = user.hospitalId ? String(user.hospitalId) : undefined;

  next();
});

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Not authorized to access this route', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(`User role '${req.user.role}' is not authorized to access this route`, 403)
      );
    }

    next();
  };
};

/** Ensures the authenticated user has a tenant hospitalId (blocks Super Admin on tenant-only routes if needed) */
export const requireTenant = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.hospitalId) {
    return next(new AppError('Tenant context required', 403));
  }
  next();
};
