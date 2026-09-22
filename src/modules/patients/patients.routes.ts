import { Router } from 'express';
import { createPatient, getPatients, getPatientById, updatePatient, recordVitals, updateHistory } from './patients.controller';
import { protect, authorize } from '../../middleware/auth';

const router = Router();

router.use(protect);

router.route('/')
  .post(authorize('Receptionist', 'Doctor', 'Nurse', 'Hospital Admin'), createPatient)
  .get(getPatients);

router.route('/:id')
  .get(getPatientById)
  .put(authorize('Receptionist', 'Doctor', 'Nurse', 'Hospital Admin'), updatePatient);

router.post('/:id/vitals', authorize('Nurse', 'Doctor'), recordVitals);
router.put('/:id/history', authorize('Doctor', 'Nurse'), updateHistory);

export default router;
