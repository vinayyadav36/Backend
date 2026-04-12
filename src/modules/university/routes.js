const express = require('express');
const router = express.Router();
const { protect } = require('../../middlewares/authMiddleware');
const ctrl = require('./controller');

router.use(protect);

router.get('/dashboard', ctrl.getUniversityDashboard);

router.route('/students').get(ctrl.getStudents).post(ctrl.createStudent);
router.route('/students/:id').get(ctrl.getStudent).put(ctrl.updateStudent).delete(ctrl.deleteStudent);
router.get('/students/:id/analytics', ctrl.getStudentAnalytics);

router.route('/courses').get(ctrl.getCourses).post(ctrl.createCourse);
router.route('/courses/:id').get(ctrl.getCourse).put(ctrl.updateCourse).delete(ctrl.deleteCourse);

router.route('/faculty').get(ctrl.getFaculty).post(ctrl.createFaculty);
router.route('/faculty/:id').get(ctrl.getFacultyMember).put(ctrl.updateFaculty).delete(ctrl.deleteFaculty);

router.route('/enrollments').get(ctrl.getEnrollments).post(ctrl.createEnrollment);
router.route('/enrollments/:id').put(ctrl.updateEnrollment);

router.route('/departments').get(ctrl.getDepartments).post(ctrl.createDepartment);
router.route('/departments/:id').put(ctrl.updateDepartment);

router.route('/exam-schedules').get(ctrl.getExamSchedules).post(ctrl.createExamSchedule);

router.route('/attendance').get(ctrl.getAttendance).post(ctrl.markAttendance);

module.exports = router;
