import { Router } from 'express';
import { protect, authorize } from '../../middleware/auth';
import {
  applyTemplateHandler,
  createTemplate,
  deleteTemplate,
  getLedgerByAdmission,
  getLedgerByPatient,
  getWristband,
  listAlerts,
  listBedRates,
  listOpenLedgers,
  listTemplates,
  recentUsages,
  reconcileHandler,
  resolveAlert,
  resolveBarcodeHandler,
  resolveWristbandHandler,
  scanConsumeHandler,
  updateTemplate,
  upsertBedRate,
} from './resources.controller';

const router = Router();

const scanRoles = authorize('Hospital Admin', 'Nurse', 'Pharmacist', 'Doctor', 'Receptionist');
const adminRoles = authorize('Hospital Admin', 'Pharmacist');
const financeRoles = authorize('Hospital Admin', 'Accountant', 'Pharmacist');

router.use(protect);

/* ── Scan workflow ── */
router.get('/wristband/resolve/:token', scanRoles, resolveWristbandHandler);
router.get('/barcode/resolve/:code', scanRoles, resolveBarcodeHandler);
router.post('/scan', scanRoles, scanConsumeHandler);
router.post('/apply-template', scanRoles, applyTemplateHandler);

/* ── Wristband print data ── */
router.get('/wristband/:admissionId', scanRoles, getWristband);

/* ── Procedure templates ── */
router.get('/templates', scanRoles, listTemplates);
router.post('/templates', adminRoles, createTemplate);
router.put('/templates/:id', adminRoles, updateTemplate);
router.delete('/templates/:id', adminRoles, deleteTemplate);

/* ── Resource ledgers ── */
router.get('/ledgers', scanRoles, listOpenLedgers);
router.get('/ledgers/admission/:admissionId', scanRoles, getLedgerByAdmission);
router.get('/ledgers/patient/:patientId', scanRoles, getLedgerByPatient);
router.get('/usages', scanRoles, recentUsages);

/* ── Bed rates ── */
router.get('/bed-rates', financeRoles, listBedRates);
router.post('/bed-rates', authorize('Hospital Admin'), upsertBedRate);

/* ── Reconciliation ── */
router.post('/reconcile', financeRoles, reconcileHandler);
router.get('/alerts', financeRoles, listAlerts);
router.put('/alerts/:id', financeRoles, resolveAlert);

export default router;
