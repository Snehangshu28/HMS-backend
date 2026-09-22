import { Router } from 'express';
import {
  createDoctorProfile,
  registerDoctor,
  getDoctors,
  getDoctorProfile,
  updateDoctorProfile,
  updateDoctorSchedule,
} from './doctors.controller';
import { protect, authorize } from '../../middleware/auth';

const router = Router();

router.use(protect);

router.post('/register', authorize('Hospital Admin'), registerDoctor);

router.route('/')
  .post(authorize('Hospital Admin'), createDoctorProfile)
  .get(getDoctors);

router.route('/:id')
  .get(getDoctorProfile)
  .put(authorize('Hospital Admin', 'Doctor'), updateDoctorProfile);

router.put('/:id/schedule', authorize('Hospital Admin', 'Doctor'), updateDoctorSchedule);

export default router;
