import { Request, Response } from 'express';
import { User } from './user.model';
import { AppError, asyncHandler, sendResponse } from '../../common';

/** Roles Hospital Admin may assign within their tenant (never Super Admin / Patient via this API) */
const STAFF_ROLES = [
  'Hospital Admin',
  'Doctor',
  'Receptionist',
  'Nurse',
  'Lab Technician',
  'Pharmacist',
  'Accountant',
] as const;

type StaffRole = (typeof STAFF_ROLES)[number];

const requireTenantContext = (req: Request) => {
  if (!req.hospitalId) {
    throw new AppError('Tenant context required', 403);
  }
  return req.hospitalId;
};

const isStaffRole = (role: string): role is StaffRole =>
  (STAFF_ROLES as readonly string[]).includes(role);

// @desc    List hospital staff users (same tenant only)
// @route   GET /api/v1/auth/staff
// @access  Private (Hospital Admin)
export const listStaff = asyncHandler(async (req: Request, res: Response) => {
  const hospitalId = requireTenantContext(req);

  const staff = await User.find({
    hospitalId,
    isDeleted: false,
    role: { $in: STAFF_ROLES },
  })
    .select('-passwordHash')
    .sort({ role: 1, 'name.first': 1 });

  return sendResponse(res, 200, 'Staff list retrieved', staff);
});

// @desc    Create staff user in the authenticated admin's tenant
// @route   POST /api/v1/auth/staff
// @access  Private (Hospital Admin)
// NOTE: hospitalId / tenantId from body are ignored — always from JWT/DB session.
export const createStaff = asyncHandler(async (req: Request, res: Response) => {
  const hospitalId = requireTenantContext(req);
  const { email, password, role, firstName, lastName, phone } = req.body;

  if (!email || !password || !role || !firstName || !lastName) {
    throw new AppError('Email, password, role, first name, and last name are required', 400);
  }

  if (!isStaffRole(role)) {
    throw new AppError(`Invalid role. Allowed: ${STAFF_ROLES.join(', ')}`, 400);
  }

  if (String(password).length < 6) {
    throw new AppError('Password must be at least 6 characters', 400);
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const exists = await User.findOne({ email: normalizedEmail });
  if (exists) {
    throw new AppError('A user with this email already exists', 400);
  }

  const user = await User.create({
    hospitalId, // from authenticated session — never from body
    email: normalizedEmail,
    passwordHash: password,
    role,
    name: { first: String(firstName).trim(), last: String(lastName).trim() },
    phone,
    isActive: true,
  });

  return sendResponse(res, 201, 'Staff member created', {
    id: user._id,
    email: user.email,
    role: user.role,
    name: user.name,
    phone: user.phone,
    isActive: user.isActive,
    hospitalId: user.hospitalId,
  });
});

// @desc    Update staff member (same tenant only)
// @route   PUT /api/v1/auth/staff/:id
// @access  Private (Hospital Admin)
export const updateStaff = asyncHandler(async (req: Request, res: Response) => {
  const hospitalId = requireTenantContext(req);
  const { id } = req.params;
  const { firstName, lastName, phone, role, isActive, password, email } = req.body;

  // Cross-tenant IDOR blocked: must match this hospital
  const user = await User.findOne({ _id: id, hospitalId, isDeleted: false });
  if (!user) {
    throw new AppError('Staff member not found', 404);
  }

  // Prevent demoting/deactivating the last active Hospital Admin in the tenant
  const wouldChangeAdminRole =
    user.role === 'Hospital Admin' &&
    ((role !== undefined && role !== 'Hospital Admin') || isActive === false);

  if (wouldChangeAdminRole) {
    const otherAdmins = await User.countDocuments({
      hospitalId,
      role: 'Hospital Admin',
      isActive: true,
      isDeleted: false,
      _id: { $ne: user._id },
    });
    if (otherAdmins === 0) {
      throw new AppError(
        'Cannot demote or deactivate the last Hospital Admin for this hospital',
        400
      );
    }
  }

  if (firstName !== undefined) user.name.first = String(firstName).trim();
  if (lastName !== undefined) user.name.last = String(lastName).trim();
  if (phone !== undefined) user.phone = phone;
  if (typeof isActive === 'boolean') user.isActive = isActive;

  if (role !== undefined) {
    if (!isStaffRole(role)) {
      throw new AppError(`Invalid role. Allowed: ${STAFF_ROLES.join(', ')}`, 400);
    }
    user.role = role;
  }

  if (email !== undefined) {
    const normalizedEmail = String(email).toLowerCase().trim();
    const taken = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: id },
    });
    if (taken) throw new AppError('Email already in use', 400);
    user.email = normalizedEmail;
  }

  if (password) {
    if (String(password).length < 6) {
      throw new AppError('Password must be at least 6 characters', 400);
    }
    user.passwordHash = password; // pre-save hook hashes
  }

  await user.save();

  return sendResponse(res, 200, 'Staff member updated', {
    id: user._id,
    email: user.email,
    role: user.role,
    name: user.name,
    phone: user.phone,
    isActive: user.isActive,
    hospitalId: user.hospitalId,
  });
});
