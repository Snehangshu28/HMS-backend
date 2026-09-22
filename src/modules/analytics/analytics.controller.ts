import { Request, Response } from 'express';
import { Invoice } from '../billing/models';
import { Patient } from '../patients/models';
import { Bed } from '../ipd/models';
import { Appointment } from '../appointments/models';
import { sendResponse, asyncHandler } from '../../common';
import mongoose from 'mongoose';

// @desc    Get dashboard metrics and trends
// @route   GET /api/v1/analytics/dashboard
// @access  Private (Hospital Admin, Super Admin)
export const getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
  const hospitalId = new mongoose.Types.ObjectId(req.hospitalId);

  // Revenue sum
  const revenueStats = await Invoice.aggregate([
    { $match: { hospitalId, paymentStatus: 'Paid' } },
    { $group: { _id: null, total: { $sum: '$grandTotal' } } }
  ]);
  const totalRevenue = revenueStats.length ? revenueStats[0].total : 0;

  const totalPatients = await Patient.countDocuments({ hospitalId, isDeleted: false });

  // Bed Occupancy
  const totalBeds = await Bed.countDocuments({ hospitalId });
  const occupiedBeds = await Bed.countDocuments({ hospitalId, status: 'Occupied' });
  const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  const scheduledAppts = await Appointment.countDocuments({ hospitalId, status: 'Scheduled' });
  const completedAppts = await Appointment.countDocuments({ hospitalId, status: 'Completed' });

  // Last 6 months revenues
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const monthlyRevenue = await Invoice.aggregate([
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

  return sendResponse(res, 200, 'Analytics stats fetched successfully', {
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
