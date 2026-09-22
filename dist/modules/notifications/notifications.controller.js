"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markAsRead = exports.getNotifications = void 0;
const models_1 = require("./models");
const common_1 = require("../../common");
// @desc    Get user notifications
// @route   GET /api/v1/notifications
// @access  Private (All authenticated users)
exports.getNotifications = (0, common_1.asyncHandler)(async (req, res) => {
    const notifications = await models_1.Notification.find({
        hospitalId: req.hospitalId,
        recipientId: req.user?.id
    }).sort({ createdAt: -1 });
    return (0, common_1.sendResponse)(res, 200, 'Notifications retrieved successfully', notifications);
});
// @desc    Mark Notification as Read
// @route   PUT /api/v1/notifications/:id/read
// @access  Private (All authenticated users)
exports.markAsRead = (0, common_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const notification = await models_1.Notification.findOneAndUpdate({ _id: id, hospitalId: req.hospitalId, recipientId: req.user?.id }, { status: 'Read' }, { new: true });
    if (!notification) {
        throw new common_1.AppError('Notification not found or access denied', 404);
    }
    return (0, common_1.sendResponse)(res, 200, 'Notification marked as read', notification);
});
