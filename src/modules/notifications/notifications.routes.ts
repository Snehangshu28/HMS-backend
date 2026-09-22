import { Router } from 'express';
import { getNotifications, markAsRead } from './notifications.controller';
import { protect } from '../../middleware/auth';

const router = Router();

router.use(protect);

router.get('/', getNotifications);
router.put('/:id/read', markAsRead);

export default router;
