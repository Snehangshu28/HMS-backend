import { Router } from 'express';
import { orderLabTest, collectSample, uploadLabReport, getLabTests, getLabReport } from './laboratory.controller';
import { protect, authorize } from '../../middleware/auth';

const router = Router();

router.use(protect);

router.route('/tests')
  .post(authorize('Doctor'), orderLabTest)
  .get(getLabTests);

router.post('/samples', authorize('Lab Technician', 'Nurse'), collectSample);
router.post('/reports', authorize('Lab Technician'), uploadLabReport);
router.get('/reports/:labTestId', getLabReport);

export default router;
