const { Student, Course, Faculty, Enrollment, Department, ExamSchedule, Attendance } = require('./model');
const { calculateGPA, validateEnrollment, trackAttendance, getStudentSummary } = require('./service');
const logger = require('../../config/logger');

// Students
const getStudents = async (req, res) => {
  try {
    const students = await Student.find({}).lean();
    res.json({ success: true, data: students });
  } catch (err) {
    logger.error('getStudents error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const getStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).lean();
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, data: student });
  } catch (err) {
    logger.error('getStudent error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const createStudent = async (req, res) => {
  try {
    const now = new Date().toISOString();
    const student = await Student.create({ ...req.body, createdAt: now, updatedAt: now });
    res.status(201).json({ success: true, data: student });
  } catch (err) {
    logger.error('createStudent error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateStudent = async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date().toISOString() },
      { new: true }
    );
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, data: student });
  } catch (err) {
    logger.error('updateStudent error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteStudent = async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, message: 'Student deleted' });
  } catch (err) {
    logger.error('deleteStudent error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const getStudentAnalytics = async (req, res) => {
  try {
    const summary = await getStudentSummary(req.params.id);
    if (!summary) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, data: summary });
  } catch (err) {
    logger.error('getStudentAnalytics error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Courses
const getCourses = async (req, res) => {
  try {
    const courses = await Course.find({}).lean();
    res.json({ success: true, data: courses });
  } catch (err) {
    logger.error('getCourses error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const getCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id).lean();
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    res.json({ success: true, data: course });
  } catch (err) {
    logger.error('getCourse error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const createCourse = async (req, res) => {
  try {
    const now = new Date().toISOString();
    const course = await Course.create({ ...req.body, createdAt: now, updatedAt: now });
    res.status(201).json({ success: true, data: course });
  } catch (err) {
    logger.error('createCourse error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateCourse = async (req, res) => {
  try {
    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date().toISOString() },
      { new: true }
    );
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    res.json({ success: true, data: course });
  } catch (err) {
    logger.error('updateCourse error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteCourse = async (req, res) => {
  try {
    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    res.json({ success: true, message: 'Course deleted' });
  } catch (err) {
    logger.error('deleteCourse error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Faculty
const getFaculty = async (req, res) => {
  try {
    const faculty = await Faculty.find({}).lean();
    res.json({ success: true, data: faculty });
  } catch (err) {
    logger.error('getFaculty error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const getFacultyMember = async (req, res) => {
  try {
    const member = await Faculty.findById(req.params.id).lean();
    if (!member) return res.status(404).json({ success: false, message: 'Faculty member not found' });
    res.json({ success: true, data: member });
  } catch (err) {
    logger.error('getFacultyMember error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const createFaculty = async (req, res) => {
  try {
    const now = new Date().toISOString();
    const member = await Faculty.create({ ...req.body, createdAt: now, updatedAt: now });
    res.status(201).json({ success: true, data: member });
  } catch (err) {
    logger.error('createFaculty error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateFaculty = async (req, res) => {
  try {
    const member = await Faculty.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date().toISOString() },
      { new: true }
    );
    if (!member) return res.status(404).json({ success: false, message: 'Faculty member not found' });
    res.json({ success: true, data: member });
  } catch (err) {
    logger.error('updateFaculty error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteFaculty = async (req, res) => {
  try {
    const member = await Faculty.findByIdAndDelete(req.params.id);
    if (!member) return res.status(404).json({ success: false, message: 'Faculty member not found' });
    res.json({ success: true, message: 'Faculty member deleted' });
  } catch (err) {
    logger.error('deleteFaculty error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Enrollments
const getEnrollments = async (req, res) => {
  try {
    const enrollments = await Enrollment.find({}).lean();
    res.json({ success: true, data: enrollments });
  } catch (err) {
    logger.error('getEnrollments error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const createEnrollment = async (req, res) => {
  try {
    const { studentId, courseId } = req.body;
    const validation = await validateEnrollment(studentId, courseId);
    if (!validation.valid) return res.status(400).json({ success: false, message: validation.message });
    const now = new Date().toISOString();
    const enrollment = await Enrollment.create({ ...req.body, createdAt: now, updatedAt: now });
    res.status(201).json({ success: true, data: enrollment });
  } catch (err) {
    logger.error('createEnrollment error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateEnrollment = async (req, res) => {
  try {
    const enrollment = await Enrollment.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date().toISOString() },
      { new: true }
    );
    if (!enrollment) return res.status(404).json({ success: false, message: 'Enrollment not found' });
    res.json({ success: true, data: enrollment });
  } catch (err) {
    logger.error('updateEnrollment error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Departments
const getDepartments = async (req, res) => {
  try {
    const departments = await Department.find({}).lean();
    res.json({ success: true, data: departments });
  } catch (err) {
    logger.error('getDepartments error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const createDepartment = async (req, res) => {
  try {
    const now = new Date().toISOString();
    const dept = await Department.create({ ...req.body, createdAt: now, updatedAt: now });
    res.status(201).json({ success: true, data: dept });
  } catch (err) {
    logger.error('createDepartment error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateDepartment = async (req, res) => {
  try {
    const dept = await Department.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date().toISOString() },
      { new: true }
    );
    if (!dept) return res.status(404).json({ success: false, message: 'Department not found' });
    res.json({ success: true, data: dept });
  } catch (err) {
    logger.error('updateDepartment error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ExamSchedules
const getExamSchedules = async (req, res) => {
  try {
    const exams = await ExamSchedule.find({}).lean();
    res.json({ success: true, data: exams });
  } catch (err) {
    logger.error('getExamSchedules error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const createExamSchedule = async (req, res) => {
  try {
    const now = new Date().toISOString();
    const exam = await ExamSchedule.create({ ...req.body, createdAt: now, updatedAt: now });
    res.status(201).json({ success: true, data: exam });
  } catch (err) {
    logger.error('createExamSchedule error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Attendance
const getAttendance = async (req, res) => {
  try {
    const records = await Attendance.find({}).lean();
    res.json({ success: true, data: records });
  } catch (err) {
    logger.error('getAttendance error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const markAttendance = async (req, res) => {
  try {
    const now = new Date().toISOString();
    const record = await Attendance.create({ ...req.body, createdAt: now, updatedAt: now });
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    logger.error('markAttendance error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Dashboard
const getUniversityDashboard = async (req, res) => {
  try {
    const [students, courses, faculty, enrollments, departments] = await Promise.all([
      Student.countDocuments({}),
      Course.countDocuments({}),
      Faculty.countDocuments({}),
      Enrollment.countDocuments({}),
      Department.countDocuments({}),
    ]);
    res.json({
      success: true,
      data: {
        totalStudents: students,
        totalCourses: courses,
        totalFaculty: faculty,
        totalEnrollments: enrollments,
        totalDepartments: departments,
      },
    });
  } catch (err) {
    logger.error('getUniversityDashboard error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getStudents, getStudent, createStudent, updateStudent, deleteStudent, getStudentAnalytics,
  getCourses, getCourse, createCourse, updateCourse, deleteCourse,
  getFaculty, getFacultyMember, createFaculty, updateFaculty, deleteFaculty,
  getEnrollments, createEnrollment, updateEnrollment,
  getDepartments, createDepartment, updateDepartment,
  getExamSchedules, createExamSchedule,
  getAttendance, markAttendance,
  getUniversityDashboard,
};
