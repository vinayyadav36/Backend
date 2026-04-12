const { Employee, HRDepartment, HRAttendance, Leave, Payroll, Performance, JobPosting, Training } = require('./model');
const { calculatePayroll, calculateLeaveBalance, processAttendance, generatePerformanceReport } = require('./service');
const logger = require('../../config/logger');

const crud = (Model, name) => ({
  getAll: async (req, res) => {
    try { res.json({ success: true, data: await Model.find({}).lean() }); }
    catch (err) { logger.error(`get${name}s:`, err); res.status(500).json({ success: false, message: err.message }); }
  },
  getOne: async (req, res) => {
    try {
      const item = await Model.findById(req.params.id).lean();
      if (!item) return res.status(404).json({ success: false, message: `${name} not found` });
      res.json({ success: true, data: item });
    } catch (err) { logger.error(`get${name}:`, err); res.status(500).json({ success: false, message: err.message }); }
  },
  create: async (req, res) => {
    try {
      const now = new Date().toISOString();
      res.status(201).json({ success: true, data: await Model.create({ ...req.body, createdAt: now, updatedAt: now }) });
    } catch (err) { logger.error(`create${name}:`, err); res.status(500).json({ success: false, message: err.message }); }
  },
  update: async (req, res) => {
    try {
      const item = await Model.findByIdAndUpdate(req.params.id, { ...req.body, updatedAt: new Date().toISOString() }, { new: true });
      if (!item) return res.status(404).json({ success: false, message: `${name} not found` });
      res.json({ success: true, data: item });
    } catch (err) { logger.error(`update${name}:`, err); res.status(500).json({ success: false, message: err.message }); }
  },
});

const empC = crud(Employee, 'Employee');
const getEmployees = empC.getAll;
const getEmployee = empC.getOne;
const createEmployee = empC.create;
const updateEmployee = empC.update;
const terminateEmployee = async (req, res) => {
  try {
    const emp = await Employee.findByIdAndUpdate(req.params.id, { status: 'terminated', updatedAt: new Date().toISOString() }, { new: true });
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });
    res.json({ success: true, data: emp });
  } catch (err) { logger.error('terminateEmployee:', err); res.status(500).json({ success: false, message: err.message }); }
};
const getEmployeeAnalytics = async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id).lean();
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });
    const [leaveBalance, perfReport] = await Promise.all([
      calculateLeaveBalance(req.params.id, 'annual'),
      generatePerformanceReport(req.params.id, new Date().getFullYear().toString())
    ]);
    res.json({ success: true, data: { employee: emp, leaveBalance, performance: perfReport } });
  } catch (err) { logger.error('getEmployeeAnalytics:', err); res.status(500).json({ success: false, message: err.message }); }
};

const deptC = crud(HRDepartment, 'Department');
const getDepartments = deptC.getAll;
const getDepartment = deptC.getOne;
const createDepartment = deptC.create;
const updateDepartment = deptC.update;

const getAttendance = async (req, res) => {
  try { res.json({ success: true, data: await HRAttendance.find({}).lean() }); }
  catch (err) { logger.error('getAttendance:', err); res.status(500).json({ success: false, message: err.message }); }
};
const checkIn = async (req, res) => {
  try {
    const { employeeId, date } = req.body;
    const now = new Date().toISOString();
    const record = await HRAttendance.create({ employeeId, date: date || now, checkIn: now, status: 'present', createdAt: now, updatedAt: now });
    res.status(201).json({ success: true, data: record });
  } catch (err) { logger.error('checkIn:', err); res.status(500).json({ success: false, message: err.message }); }
};
const checkOut = async (req, res) => {
  try {
    const { employeeId, date } = req.body;
    const record = await HRAttendance.findOne({ employeeId, date: { $regex: (date || '').substring(0, 10) } }).lean();
    if (!record) return res.status(404).json({ success: false, message: 'Check-in record not found' });
    const now = new Date().toISOString();
    const processed = await processAttendance(employeeId, record.date, record.checkIn, now);
    const updated = await HRAttendance.findByIdAndUpdate(record._id, { ...processed, updatedAt: now }, { new: true });
    res.json({ success: true, data: updated });
  } catch (err) { logger.error('checkOut:', err); res.status(500).json({ success: false, message: err.message }); }
};
const getAttendanceSummary = async (req, res) => {
  try {
    const records = await HRAttendance.find({ employeeId: req.params.empId }).lean();
    const present = records.filter(r => r.status === 'present').length;
    const totalHours = records.reduce((s, r) => s + (r.hoursWorked || 0), 0);
    res.json({ success: true, data: { total: records.length, present, absent: records.length - present, totalHours } });
  } catch (err) { logger.error('getAttendanceSummary:', err); res.status(500).json({ success: false, message: err.message }); }
};

const leaveC = crud(Leave, 'Leave');
const getLeaves = leaveC.getAll;
const requestLeave = leaveC.create;
const updateLeaveStatus = async (req, res) => {
  try {
    const leave = await Leave.findByIdAndUpdate(req.params.id, { status: req.body.status, updatedAt: new Date().toISOString() }, { new: true });
    if (!leave) return res.status(404).json({ success: false, message: 'Leave not found' });
    res.json({ success: true, data: leave });
  } catch (err) { logger.error('updateLeaveStatus:', err); res.status(500).json({ success: false, message: err.message }); }
};
const getLeaveBalance = async (req, res) => {
  try {
    const balance = await calculateLeaveBalance(req.params.empId, req.query.type || 'annual');
    res.json({ success: true, data: balance });
  } catch (err) { logger.error('getLeaveBalance:', err); res.status(500).json({ success: false, message: err.message }); }
};

const payC = crud(Payroll, 'Payroll');
const getPayrolls = payC.getAll;
const processPayroll = async (req, res) => {
  try {
    const { employeeId, month, year } = req.body;
    const data = await calculatePayroll(employeeId, month, year);
    if (!data) return res.status(404).json({ success: false, message: 'Employee not found' });
    const now = new Date().toISOString();
    const payroll = await Payroll.create({ ...data, status: 'pending', createdAt: now, updatedAt: now });
    res.status(201).json({ success: true, data: payroll });
  } catch (err) { logger.error('processPayroll:', err); res.status(500).json({ success: false, message: err.message }); }
};
const getPayslip = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id).lean();
    if (!payroll) return res.status(404).json({ success: false, message: 'Payroll not found' });
    res.json({ success: true, data: payroll });
  } catch (err) { logger.error('getPayslip:', err); res.status(500).json({ success: false, message: err.message }); }
};
const approvePayroll = async (req, res) => {
  try {
    const p = await Payroll.findByIdAndUpdate(req.params.id, { status: 'approved', updatedAt: new Date().toISOString() }, { new: true });
    if (!p) return res.status(404).json({ success: false, message: 'Payroll not found' });
    res.json({ success: true, data: p });
  } catch (err) { logger.error('approvePayroll:', err); res.status(500).json({ success: false, message: err.message }); }
};

const perfC = crud(Performance, 'Performance');
const getPerformanceReviews = perfC.getAll;
const createReview = perfC.create;
const updateReview = perfC.update;
const getPerformanceSummary = async (req, res) => {
  try {
    const report = await generatePerformanceReport(req.params.empId, req.query.period || '');
    res.json({ success: true, data: report });
  } catch (err) { logger.error('getPerformanceSummary:', err); res.status(500).json({ success: false, message: err.message }); }
};

const jobC = crud(JobPosting, 'JobPosting');
const getJobPostings = jobC.getAll;
const createJobPosting = jobC.create;
const updateJobPosting = jobC.update;
const closeJobPosting = async (req, res) => {
  try {
    const jp = await JobPosting.findByIdAndUpdate(req.params.id, { status: 'closed', updatedAt: new Date().toISOString() }, { new: true });
    if (!jp) return res.status(404).json({ success: false, message: 'Job posting not found' });
    res.json({ success: true, data: jp });
  } catch (err) { logger.error('closeJobPosting:', err); res.status(500).json({ success: false, message: err.message }); }
};

const trainC = crud(Training, 'Training');
const getTrainings = trainC.getAll;
const createTraining = trainC.create;
const updateTraining = trainC.update;
const enrollEmployee = async (req, res) => {
  try {
    const training = await Training.findById(req.params.id).lean();
    if (!training) return res.status(404).json({ success: false, message: 'Training not found' });
    const enrollees = [...(training.enrollees || []), req.body.employeeId];
    const updated = await Training.findByIdAndUpdate(req.params.id, { enrollees, updatedAt: new Date().toISOString() }, { new: true });
    res.json({ success: true, data: updated });
  } catch (err) { logger.error('enrollEmployee:', err); res.status(500).json({ success: false, message: err.message }); }
};

const getHRDashboard = async (req, res) => {
  try {
    const [employees, departments, pendingLeaves, openJobs] = await Promise.all([
      Employee.countDocuments({}), HRDepartment.countDocuments({}),
      Leave.countDocuments({ status: 'pending' }), JobPosting.countDocuments({ status: 'open' })
    ]);
    res.json({ success: true, data: { totalEmployees: employees, totalDepartments: departments, pendingLeaves, openJobPostings: openJobs } });
  } catch (err) { logger.error('getHRDashboard:', err); res.status(500).json({ success: false, message: err.message }); }
};

module.exports = {
  getEmployees, getEmployee, createEmployee, updateEmployee, terminateEmployee, getEmployeeAnalytics,
  getDepartments, getDepartment, createDepartment, updateDepartment,
  getAttendance, checkIn, checkOut, getAttendanceSummary,
  getLeaves, requestLeave, updateLeaveStatus, getLeaveBalance,
  getPayrolls, processPayroll, getPayslip, approvePayroll,
  getPerformanceReviews, createReview, updateReview, getPerformanceSummary,
  getJobPostings, createJobPosting, updateJobPosting, closeJobPosting,
  getTrainings, createTraining, updateTraining, enrollEmployee,
  getHRDashboard,
};
