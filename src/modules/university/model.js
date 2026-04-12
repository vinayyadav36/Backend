const { createJsonModel } = require('../../models/JsonModel');

const Student = createJsonModel('students', 'Student', {
  name: '',
  email: '',
  studentId: '',
  program: '',
  year: 0,
  gpa: 0,
  courses: [],
  status: 'active',
  createdAt: null,
  updatedAt: null,
});

const Course = createJsonModel('courses', 'Course', {
  code: '',
  name: '',
  credits: 0,
  instructor: '',
  schedule: '',
  capacity: 0,
  enrolled: 0,
  createdAt: null,
  updatedAt: null,
});

const Faculty = createJsonModel('faculty', 'Faculty', {
  name: '',
  email: '',
  department: '',
  designation: '',
  courses: [],
  publications: 0,
  createdAt: null,
  updatedAt: null,
});

const Enrollment = createJsonModel('enrollments', 'Enrollment', {
  studentId: '',
  courseId: '',
  semester: '',
  grade: '',
  status: 'enrolled',
  createdAt: null,
  updatedAt: null,
});

const Department = createJsonModel('departments', 'Department', {
  name: '',
  code: '',
  head: '',
  budget: 0,
  createdAt: null,
  updatedAt: null,
});

const ExamSchedule = createJsonModel('exam_schedules', 'ExamSchedule', {
  courseId: '',
  date: null,
  venue: '',
  duration: 0,
  createdAt: null,
  updatedAt: null,
});

const Attendance = createJsonModel('attendance', 'Attendance', {
  studentId: '',
  courseId: '',
  date: null,
  status: 'present',
  percentage: 0,
  createdAt: null,
  updatedAt: null,
});

module.exports = { Student, Course, Faculty, Enrollment, Department, ExamSchedule, Attendance };
