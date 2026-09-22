import { Router, Request, Response } from 'express';
import { signup, login, refresh } from './auth.controller';
import { getHospital, updateHospital } from './hospital.controller';
import { listStaff, createStaff, updateStaff } from './staff.controller';
import { protect, authorize } from '../../middleware/auth';
import { User } from './user.model';
import { AppError, sendResponse, asyncHandler } from '../../common';

const router = Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/refresh', refresh);

router.get(
  '/me',
  protect,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findById(req.user?.id)
      .select('-passwordHash')
      .populate('hospitalId', 'name subdomain isActive');

    if (!user || user.isDeleted || !user.isActive) {
      throw new AppError('Not authorized', 401);
    }

    return sendResponse(res, 200, 'User profile fetched successfully', {
      id: user._id,
      email: user.email,
      role: user.role,
      name: user.name,
      phone: user.phone,
      hospitalId: user.hospitalId,
      isActive: user.isActive,
    });
  })
);

router.get('/hospital', protect, getHospital);
router.put('/hospital', protect, authorize('Hospital Admin', 'Super Admin'), updateHospital);

router
  .route('/staff')
  .get(protect, authorize('Hospital Admin', 'Super Admin'), listStaff)
  .post(protect, authorize('Hospital Admin', 'Super Admin'), createStaff);

router.put('/staff/:id', protect, authorize('Hospital Admin', 'Super Admin'), updateStaff);

export default router;
