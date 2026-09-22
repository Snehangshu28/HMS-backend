import { Router } from 'express';
import {
  createWard,
  createBed,
  getWardsAndBeds,
  admitPatient,
  dischargePatient,
  getAdmissions,
  changeBed,
  changeDoctor,
} from './ipd.controller';
import { protect, authorize } from '../../middleware/auth';

const router = Router();

router.use(protect);

router.post('/wards', authorize('Hospital Admin'), createWard);
router.post('/beds', authorize('Hospital Admin'), createBed);
router.get('/layout', getWardsAndBeds);

router.route('/admissions')
  .post(authorize('Doctor', 'Receptionist', 'Hospital Admin'), admitPatient)
  .get(getAdmissions);

router.put(
  '/admissions/:id/bed',
  authorize('Hospital Admin', 'Receptionist', 'Doctor', 'Nurse'),
  changeBed
);
router.put(
  '/admissions/:id/doctor',
  authorize('Hospital Admin', 'Receptionist', 'Doctor'),
  changeDoctor
);
router.post(
  '/admissions/:id/discharge',
  authorize('Doctor', 'Nurse', 'Hospital Admin', 'Receptionist'),
  dischargePatient
);

export default router;
