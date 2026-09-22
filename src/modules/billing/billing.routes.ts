import { Router } from 'express';
import {
  createInvoice,
  getInvoices,
  recordPayment,
  fileInsuranceClaim,
  getPatientLedgers,
  getPatientLedger,
  payPatientBill,
} from './billing.controller';
import { protect, authorize } from '../../middleware/auth';

const router = Router();

router.use(protect);

router
  .route('/invoices')
  .post(authorize('Accountant', 'Hospital Admin', 'Receptionist'), createInvoice)
  .get(authorize('Accountant', 'Hospital Admin', 'Receptionist'), getInvoices);

router.get(
  '/ledgers',
  authorize('Accountant', 'Hospital Admin', 'Receptionist'),
  getPatientLedgers
);
router.get(
  '/ledgers/:patientId',
  authorize('Accountant', 'Hospital Admin', 'Receptionist', 'Nurse'),
  getPatientLedger
);
router.post(
  '/ledgers/:patientId/pay',
  authorize('Accountant', 'Hospital Admin', 'Receptionist'),
  payPatientBill
);

router.post('/payments', authorize('Accountant', 'Hospital Admin', 'Receptionist'), recordPayment);
router.post('/claims', authorize('Accountant', 'Hospital Admin'), fileInsuranceClaim);

export default router;
