import { Router } from 'express';
import { getDashboardStats } from './analytics.controller';
import { protect, authorize } from '../../middleware/auth';

const router = Router();

router.use(protect);

router.get('/dashboard', authorize('Hospital Admin', 'Super Admin'), getDashboardStats);

export default router;
