import { Router } from 'express';
import { createAppointment, getAppointments, updateAppointmentStatus, updateQueueStatus, getActiveQueue } from './appointments.controller';
import { protect, authorize } from '../../middleware/auth';

const router = Router();

router.use(protect);

router.route('/')
  .post(authorize('Receptionist', 'Patient', 'Hospital Admin'), createAppointment)
  .get(getAppointments);

router.route('/:id')
  .put(authorize('Receptionist', 'Doctor', 'Nurse', 'Hospital Admin'), updateAppointmentStatus);

router.get('/queue/active', getActiveQueue);
router.put('/queue/:id', authorize('Receptionist', 'Doctor', 'Nurse', 'Hospital Admin'), updateQueueStatus);

export default router;
