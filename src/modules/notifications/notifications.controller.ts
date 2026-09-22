import { Request, Response } from 'express';
import { Notification } from './models';
import { AppError, asyncHandler, sendResponse } from '../../common';

// @desc    Get user notifications
// @route   GET /api/v1/notifications
// @access  Private (All authenticated users)
export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  const notifications = await Notification.find({
    hospitalId: req.hospitalId,
    recipientId: req.user?.id
  }).sort({ createdAt: -1 });

  return sendResponse(res, 200, 'Notifications retrieved successfully', notifications);
});

// @desc    Mark Notification as Read
// @route   PUT /api/v1/notifications/:id/read
// @access  Private (All authenticated users)
export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const notification = await Notification.findOneAndUpdate(
    { _id: id, hospitalId: req.hospitalId, recipientId: req.user?.id },
    { status: 'Read' },
    { new: true }
  );

  if (!notification) {
    throw new AppError('Notification not found or access denied', 404);
  }

  return sendResponse(res, 200, 'Notification marked as read', notification);
});
