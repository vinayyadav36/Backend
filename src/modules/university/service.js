const { Student, Course, Enrollment, Attendance } = require('./model');
const logger = require('../../config/logger');

const calculateGPA = (grades) => {
  if (!grades || grades.length === 0) return 0;
  const gradePoints = { A: 4.0, 'A-': 3.7, 'B+': 3.3, B: 3.0, 'B-': 2.7, 'C+': 2.3, C: 2.0, 'C-': 1.7, D: 1.0, F: 0.0 };
  let totalPoints = 0;
  let totalCredits = 0;
  for (const g of grades) {
    const points = gradePoints[g.grade] ?? 0;
    const credits = g.credits || 3;
    totalPoints += points * credits;
    totalCredits += credits;
  }
  return totalCredits > 0 ? Math.round((totalPoints / totalCredits) * 100) / 100 : 0;
};

const validateEnrollment = async (studentId, courseId) => {
  try {
    const course = await Course.findById(courseId).lean();
    if (!course) return { valid: false, message: 'Course not found' };
    if (course.enrolled >= course.capacity) return { valid: false, message: 'Course is at full capacity' };
    const existing = await Enrollment.findOne({ studentId, courseId, status: 'enrolled' }).lean();
    if (existing) return { valid: false, message: 'Student already enrolled in this course' };
    return { valid: true, message: 'Enrollment valid' };
  } catch (err) {
    logger.error('validateEnrollment error:', err);
    return { valid: false, message: err.message };
  }
};

const trackAttendance = async (studentId, courseId) => {
  try {
    const records = await Attendance.find({ studentId, courseId }).lean();
    if (records.length === 0) return { percentage: 0, present: 0, total: 0 };
    const present = records.filter(r => r.status === 'present').length;
    const percentage = Math.round((present / records.length) * 100);
    return { percentage, present, total: records.length };
  } catch (err) {
    logger.error('trackAttendance error:', err);
    return { percentage: 0, present: 0, total: 0 };
  }
};

const getStudentSummary = async (studentId) => {
  try {
    const student = await Student.findById(studentId).lean();
    if (!student) return null;
    const enrollments = await Enrollment.find({ studentId }).lean();
    const attendanceRecords = await Attendance.find({ studentId }).lean();
    const present = attendanceRecords.filter(r => r.status === 'present').length;
    const attendancePct = attendanceRecords.length > 0
      ? Math.round((present / attendanceRecords.length) * 100) : 0;
    return {
      student,
      enrollments,
      totalCourses: enrollments.length,
      attendancePercentage: attendancePct,
      gpa: student.gpa,
    };
  } catch (err) {
    logger.error('getStudentSummary error:', err);
    return null;
  }
};

module.exports = { calculateGPA, validateEnrollment, trackAttendance, getStudentSummary };
