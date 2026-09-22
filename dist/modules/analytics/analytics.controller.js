"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardStats = void 0;
const models_1 = require("../billing/models");
const models_2 = require("../patients/models");
const models_3 = require("../ipd/models");
const models_4 = require("../appointments/models");
const common_1 = require("../../common");
const mongoose_1 = __importDefault(require("mongoose"));
// @desc    Get dashboard metrics and trends
// @route   GET /api/v1/analytics/dashboard
// @access  Private (Hospital Admin, Super Admin)
exports.getDashboardStats = (0, common_1.asyncHandler)(async (req, res) => {
    const hospitalId = new mongoose_1.default.Types.ObjectId(req.hospitalId);
    // Revenue sum
    const revenueStats = await models_1.Invoice.aggregate([
        { $match: { hospitalId, paymentStatus: 'Paid' } },
        { $group: { _id: null, total: { $sum: '$grandTotal' } } }
    ]);
    const totalRevenue = revenueStats.length ? revenueStats[0].total : 0;
    const totalPatients = await models_2.Patient.countDocuments({ hospitalId, isDeleted: false });
    // Bed Occupancy
    const totalBeds = await models_3.Bed.countDocuments({ hospitalId });
    const occupiedBeds = await models_3.Bed.countDocuments({ hospitalId, status: 'Occupied' });
    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
    const scheduledAppts = await models_4.Appointment.countDocuments({ hospitalId, status: 'Scheduled' });
    const completedAppts = await models_4.Appointment.countDocuments({ hospitalId, status: 'Completed' });
    // Last 6 months revenues
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);
    const monthlyRevenue = await models_1.Invoice.aggregate([
        {
            $match: {
                hospitalId,
                paymentStatus: 'Paid',
                createdAt: { $gte: sixMonthsAgo }
            }
        },
        {
            $group: {
                _id: { month: { $month: '$createdAt' }, year: { $year: '$createdAt' } },
                revenue: { $sum: '$grandTotal' }
            }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);
    return (0, common_1.sendResponse)(res, 200, 'Analytics stats fetched successfully', {
        overview: {
            totalRevenue,
            totalPatients,
            bedOccupancy: {
                total: totalBeds,
                occupied: occupiedBeds,
                rate: occupancyRate
            },
            appointments: {
                scheduled: scheduledAppts,
                completed: completedAppts
            }
        },
        monthlyRevenue
    });
});
