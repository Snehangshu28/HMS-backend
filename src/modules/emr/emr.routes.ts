import { Router } from 'express';
import {
  createMedicalRecord,
  getPatientMedicalHistory,
  createPrescription,
  updatePrescription,
  getPrescriptions,
  getPrescriptionById,
  getMyAssignedPatients,
  completeCheckup,
} from './emr.controller';
import { protect, authorize } from '../../middleware/auth';

const router = Router();

router.use(protect);

router.get('/my-patients', authorize('Doctor'), getMyAssignedPatients);
router.post('/checkup', authorize('Doctor'), completeCheckup);

router.post('/records', authorize('Doctor'), createMedicalRecord);
router.get('/records/:patientId', getPatientMedicalHistory);

router.route('/prescriptions')
  .post(authorize('Doctor'), createPrescription)
  .get(authorize('Doctor', 'Pharmacist', 'Hospital Admin', 'Nurse', 'Patient'), getPrescriptions);

router.get('/prescriptions/:id', authorize('Doctor', 'Pharmacist', 'Hospital Admin', 'Nurse', 'Patient'), getPrescriptionById);
router.put('/prescriptions/:id', authorize('Doctor'), updatePrescription);

export default router;
