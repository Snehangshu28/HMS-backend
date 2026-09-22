import { Router } from 'express';
import { addMedicine, getMedicines, sellMedicines, getSalesLog } from './pharmacy.controller';
import { protect, authorize } from '../../middleware/auth';

const router = Router();

router.use(protect);

router.route('/inventory')
  .post(authorize('Pharmacist', 'Hospital Admin'), addMedicine)
  .get(getMedicines);

router.route('/sales')
  .post(authorize('Pharmacist'), sellMedicines)
  .get(authorize('Pharmacist', 'Accountant', 'Hospital Admin'), getSalesLog);

export default router;
