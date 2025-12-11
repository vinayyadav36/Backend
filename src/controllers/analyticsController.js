/**
 * Analytics Controller
 * Handles dashboard metrics, revenue, and occupancy analytics
 * @version 1.0.0
 */

const Booking = require('../models/Booking');
const Room = require('../models/Room');
const Guest = require('../models/Guest');
const Invoice = require('../models/Invoice');
const logger = require('../config/logger');

/**
 * Get dashboard analytics with KPIs
 * @route GET /api/v1/analytics
 * @access Private (Admin, Manager)
 */
const getDashboardAnalytics = async (req, res) => {
  try {
    const today = new Date();
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const previousWeek = new Date(lastWeek.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Parallel execution of independent queries
    const [
      totalRooms,
      occupiedRooms,
      currentRevenue,
      previousRevenue,
      currentBookings,
      previousBookings,
      avgRoomRate,
      totalBookingsLastWeek,
      cancelledBookings,
      completedBookings,
      recentBookings,
      guestRatings
    ] = await Promise.all([
      // Room statistics
      Room.countDocuments({ isActive: true }),
      Room.countDocuments({ status: 'occupied', isActive: true }),

      // Current period revenue
      Invoice.aggregate([
        {
          $match: {
            createdAt: { $gte: lastWeek },
            status: 'paid'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalAmount' },
            count: { $sum: 1 }
          }
        }
      ]),

      // Previous period revenue
      Invoice.aggregate([
        {
          $match: {
            createdAt: { $gte: previousWeek, $lt: lastWeek },
            status: 'paid'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalAmount' }
          }
        }
      ]),

      // Current bookings count
      Booking.countDocuments({ createdAt: { $gte: lastWeek } }),

      // Previous bookings count
      Booking.countDocuments({
        createdAt: { $gte: previousWeek, $lt: lastWeek }
      }),

      // Average room rate
      Booking.aggregate([
        {
          $match: {
            createdAt: { $gte: lastWeek },
            status: { $in: ['confirmed', 'checked-in', 'checked-out'] }
          }
        },
        {
          $group: {
            _id: null,
            avgRate: { $avg: '$totalAmount' },
            count: { $sum: 1 }
          }
        }
      ]),

      // Total bookings for cancellation rate
      Booking.countDocuments({ createdAt: { $gte: lastWeek } }),

      // Cancelled bookings
      Booking.countDocuments({
        createdAt: { $gte: lastWeek },
        status: 'cancelled'
      }),

      // Completed bookings for avg stay duration
      Booking.find({
        status: 'checked-out',
        checkOutDate: { $gte: lastWeek }
      }).select('checkInDate checkOutDate'),

      // Recent activity
      Booking.find()
        .populate('guest', 'name email')
        .populate('room', 'number type')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),

      // Guest ratings (if you have a Review/Rating model)
      // For now, calculate from bookings with ratings
      Booking.aggregate([
        {
          $match: {
            createdAt: { $gte: lastWeek },
            rating: { $exists: true, $ne: null }
          }
        },
        {
          $group: {
            _id: null,
            avgRating: { $avg: '$rating' },
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    // Calculate metrics
    const occupancyRate = totalRooms > 0 
      ? Math.round((occupiedRooms / totalRooms) * 100) 
      : 0;

    const currentRevenueValue = currentRevenue[0]?.total || 0;
    const previousRevenueValue = previousRevenue[0]?.total || 0;
    const revenueChange = previousRevenueValue > 0 
      ? Math.round(((currentRevenueValue - previousRevenueValue) / previousRevenueValue) * 100 * 10) / 10
      : 0;

    const bookingsChange = previousBookings > 0 
      ? Math.round(((currentBookings - previousBookings) / previousBookings) * 100 * 10) / 10
      : 0;

    const cancellationRate = totalBookingsLastWeek > 0 
      ? Math.round((cancelledBookings / totalBookingsLastWeek) * 100 * 10) / 10
      : 0;

    // Calculate average stay duration
    const avgStayDuration = completedBookings.length > 0
      ? Math.round((completedBookings.reduce((sum, booking) => {
          const duration = (new Date(booking.checkOutDate) - new Date(booking.checkInDate)) / (1000 * 60 * 60 * 24);
          return sum + duration;
        }, 0) / completedBookings.length) * 10) / 10
      : 0;

    // Calculate guest rating
    const avgGuestRating = guestRatings[0]?.avgRating 
      ? Math.round(guestRatings[0].avgRating * 10) / 10 
      : 0;

    // Format recent activity
    const recentActivity = recentBookings.slice(0, 5).map(booking => ({
      id: booking._id,
      type: booking.status === 'checked-in' ? 'checkin' : 
            booking.status === 'checked-out' ? 'checkout' : 'booking',
      message: `${booking.guest?.name || 'Guest'} ${
        booking.status === 'checked-in' ? 'checked in to' : 
        booking.status === 'checked-out' ? 'checked out from' : 'booked'
      } Room ${booking.room?.number || 'N/A'}`,
      time: getTimeAgo(booking.createdAt),
      timestamp: booking.createdAt,
      icon: booking.status === 'checked-in' ? 'user-check' : 
            booking.status === 'checked-out' ? 'user-minus' : 'calendar'
    }));

    // Calculate Revenue per Available Room (RevPAR)
    const revenuePAR = totalRooms > 0 
      ? Math.round((currentRevenueValue / totalRooms) / 7) // Daily RevPAR
      : 0;

    // Build stats object
    const stats = {
      occupancyRate: { 
        value: occupancyRate,
        change: 0, // Calculate from previous week if needed
        trend: 'neutral',
        label: 'Occupancy Rate',
        unit: '%'
      },
      revenue: { 
        value: currentRevenueValue,
        change: Math.abs(revenueChange),
        trend: revenueChange >= 0 ? 'up' : 'down',
        label: 'Total Revenue',
        unit: '₹',
        invoiceCount: currentRevenue[0]?.count || 0
      },
      totalBookings: { 
        value: currentBookings,
        change: Math.abs(bookingsChange),
        trend: bookingsChange >= 0 ? 'up' : 'down',
        label: 'Total Bookings',
        unit: ''
      },
      guestRating: { 
        value: avgGuestRating || 4.5, // Fallback to 4.5 if no ratings
        change: 0,
        trend: 'neutral',
        label: 'Guest Rating',
        unit: '★',
        reviewCount: guestRatings[0]?.count || 0
      },
      avgRoomRate: { 
        value: Math.round(avgRoomRate[0]?.avgRate || 0),
        change: 0,
        trend: 'neutral',
        label: 'Avg. Room Rate',
        unit: '₹',
        bookingCount: avgRoomRate[0]?.count || 0
      },
      revenuePAR: { 
        value: revenuePAR,
        change: 0,
        trend: 'neutral',
        label: 'RevPAR (Daily)',
        unit: '₹'
      },
      cancellationRate: { 
        value: cancellationRate,
        change: 0,
        trend: cancellationRate > 10 ? 'up' : 'down',
        label: 'Cancellation Rate',
        unit: '%'
      },
      avgStayDuration: { 
        value: avgStayDuration || 0,
        change: 0,
        trend: 'neutral',
        label: 'Avg. Stay Duration',
        unit: 'days'
      }
    };

    logger.info(`Dashboard analytics fetched successfully for user: ${req.user?.id}`);

    res.json({
      success: true,
      data: {
        stats,
        recentActivity,
        summary: {
          totalRooms,
          occupiedRooms,
          availableRooms: totalRooms - occupiedRooms,
          period: 'Last 7 days',
          generatedAt: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    logger.error('Dashboard analytics error:', {
      error: error.message,
      stack: error.stack,
      user: req.user?.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get revenue analytics with time-series data
 * @route GET /api/v1/analytics/revenue
 * @access Private (Admin, Manager)
 */
const getRevenueAnalytics = async (req, res) => {
  try {
    const { period = '7d', groupBy = 'day' } = req.query;

    // Validate period
    const validPeriods = ['7d', '30d', '90d', '1y'];
    if (!validPeriods.includes(period)) {
      return res.status(400).json({
        success: false,
        message: `Invalid period. Must be one of: ${validPeriods.join(', ')}`
      });
    }

    // Calculate start date
    let startDate;
    let dateFormat;
    
    switch (period) {
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        dateFormat = "%Y-%m-%d";
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        dateFormat = "%Y-%m-%d";
        break;
      case '90d':
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        dateFormat = groupBy === 'week' ? "%Y-W%V" : "%Y-%m-%d";
        break;
      case '1y':
        startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        dateFormat = "%Y-%m";
        break;
      default:
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        dateFormat = "%Y-%m-%d";
    }

    // Aggregate revenue data
    const revenueData = await Invoice.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: 'paid'
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: dateFormat, date: "$createdAt" }
          },
          revenue: { $sum: '$totalAmount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$totalAmount' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Format data
    const data = revenueData.map(item => ({
      date: item._id,
      revenue: Math.round(item.revenue),
      bookings: item.count,
      avgAmount: Math.round(item.avgAmount)
    }));

    // Calculate totals
    const totals = {
      totalRevenue: data.reduce((sum, item) => sum + item.revenue, 0),
      totalBookings: data.reduce((sum, item) => sum + item.bookings, 0),
      avgDailyRevenue: data.length > 0 
        ? Math.round(data.reduce((sum, item) => sum + item.revenue, 0) / data.length)
        : 0
    };

    logger.info(`Revenue analytics fetched: ${period}, ${data.length} data points`);

    res.json({
      success: true,
      data: {
        chartData: data,
        totals,
        period,
        dataPoints: data.length
      }
    });

  } catch (error) {
    logger.error('Revenue analytics error:', {
      error: error.message,
      stack: error.stack,
      query: req.query
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch revenue analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get occupancy analytics with historical trends
 * @route GET /api/v1/analytics/occupancy
 * @access Private (Admin, Manager)
 */
const getOccupancyAnalytics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;

    // Validate period
    const validPeriods = ['7d', '30d', '90d'];
    if (!validPeriods.includes(period)) {
      return res.status(400).json({
        success: false,
        message: `Invalid period. Must be one of: ${validPeriods.join(', ')}`
      });
    }

    let startDate;
    switch (period) {
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get total rooms (should be relatively constant)
    const totalRooms = await Room.countDocuments({ isActive: true });

    if (totalRooms === 0) {
      return res.json({
        success: true,
        data: {
          chartData: [],
          totals: { totalRooms: 0, avgOccupancy: 0 },
          message: 'No rooms configured'
        }
      });
    }

    // Get bookings with date ranges in the period
    const bookings = await Booking.aggregate([
      {
        $match: {
          $or: [
            { checkInDate: { $gte: startDate } },
            { checkOutDate: { $gte: startDate } }
          ],
          status: { $in: ['confirmed', 'checked-in', 'checked-out'] }
        }
      },
      {
        $project: {
          checkInDate: 1,
          checkOutDate: 1,
          roomCount: { $size: { $ifNull: ['$rooms', ['$room']] } }
        }
      }
    ]);

    // Calculate occupancy per day
    const days = Math.ceil((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const data = [];

    for (let i = 0; i < days; i++) {
      const currentDate = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = currentDate.toISOString().split('T')[0];

      // Count rooms occupied on this date
      let occupiedRooms = 0;
      bookings.forEach(booking => {
        const checkIn = new Date(booking.checkInDate);
        const checkOut = new Date(booking.checkOutDate);
        
        if (currentDate >= checkIn && currentDate < checkOut) {
          occupiedRooms += booking.roomCount || 1;
        }
      });

      const occupancy = totalRooms > 0 
        ? Math.round((occupiedRooms / totalRooms) * 100) 
        : 0;

      data.push({
        date: dateStr,
        occupancy,
        occupiedRooms,
        availableRooms: totalRooms - occupiedRooms
      });
    }

    // Calculate average occupancy
    const avgOccupancy = data.length > 0
      ? Math.round(data.reduce((sum, item) => sum + item.occupancy, 0) / data.length)
      : 0;

    logger.info(`Occupancy analytics fetched: ${period}, ${data.length} data points`);

    res.json({
      success: true,
      data: {
        chartData: data,
        totals: {
          totalRooms,
          avgOccupancy,
          dataPoints: data.length
        },
        period
      }
    });

  } catch (error) {
    logger.error('Occupancy analytics error:', {
      error: error.message,
      stack: error.stack,
      query: req.query
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch occupancy analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Helper function to get time ago string
 * @param {Date} date - Date to calculate from
 * @returns {string} Human-readable time ago
 */
function getTimeAgo(date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now - new Date(date)) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths} month${diffInMonths > 1 ? 's' : ''} ago`;

  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears} year${diffInYears > 1 ? 's' : ''} ago`;
}

module.exports = {
  getDashboardAnalytics,
  getRevenueAnalytics,
  getOccupancyAnalytics
};
