const { Employee, HRAttendance, Leave, Payroll, Performance } = require('./model');
const logger = require('../../config/logger');

const calculatePayroll = async (empId, month, year) => {
  try {
    const emp = await Employee.findById(empId).lean();
    if (!emp) return null;
    const basicSalary = emp.salary || 0;
    const allowances = basicSalary * 0.2;
    const deductions = basicSalary * 0.1;
    const netPay = basicSalary + allowances - deductions;
    return { employeeId: empId, month, year, basicSalary, allowances, deductions, netPay };
  } catch (err) {
    logger.error('calculatePayroll error:', err);
    return null;
  }
};

const calculateLeaveBalance = async (empId, type) => {
  try {
    const ANNUAL_ENTITLEMENT = { annual: 20, sick: 10, casual: 5 };
    const entitlement = ANNUAL_ENTITLEMENT[type] || 10;
    const taken = await Leave.find({ employeeId: empId, type, status: 'approved' }).lean();
    const usedDays = taken.reduce((s, l) => s + (l.days || 0), 0);
    return { entitlement, used: usedDays, balance: entitlement - usedDays };
  } catch (err) {
    logger.error('calculateLeaveBalance error:', err);
    return { entitlement: 0, used: 0, balance: 0 };
  }
};

const processAttendance = async (empId, date, checkIn, checkOut) => {
  try {
    const cin = new Date(checkIn);
    const cout = checkOut ? new Date(checkOut) : null;
    const hoursWorked = cout ? Math.round(((cout - cin) / 3600000) * 100) / 100 : 0;
    const status = hoursWorked >= 8 ? 'present' : hoursWorked > 0 ? 'half_day' : 'absent';
    return { employeeId: empId, date, checkIn, checkOut, hoursWorked, status };
  } catch (err) {
    logger.error('processAttendance error:', err);
    return null;
  }
};

const generatePerformanceReport = async (empId, period) => {
  try {
    const reviews = await Performance.find({ employeeId: empId, period }).lean();
    if (!reviews.length) return { employeeId: empId, period, averageRating: 0, reviews: [] };
    const avg = reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length;
    return { employeeId: empId, period, averageRating: Math.round(avg * 100) / 100, reviews };
  } catch (err) {
    logger.error('generatePerformanceReport error:', err);
    return null;
  }
};

module.exports = { calculatePayroll, calculateLeaveBalance, processAttendance, generatePerformanceReport };
