'use strict';
const express = require('express');
const router = express.Router();
const { protect } = require('../../middlewares/authMiddleware');
const ctrl = require('./controller');

router.get('/dashboard', protect, ctrl.getDashboard);

router.get('/courses', ctrl.getCourses);
router.get('/courses/:id', ctrl.getCourse);
router.get('/courses/:id/lessons', ctrl.getLessons);
router.post('/courses', protect, ctrl.createCourse);
router.put('/courses/:id', protect, ctrl.updateCourse);
router.delete('/courses/:id', protect, ctrl.deleteCourse);
router.post('/courses/:id/publish', protect, ctrl.publishCourse);

router.get('/lessons/:id', ctrl.getLesson);
router.post('/lessons', protect, ctrl.createLesson);
router.put('/lessons/:id', protect, ctrl.updateLesson);
router.post('/lessons/:id/complete', protect, ctrl.markLessonComplete);

router.get('/problems', ctrl.getProblems);
router.get('/problems/:id', ctrl.getProblem);
router.post('/problems', protect, ctrl.createProblem);
router.put('/problems/:id', protect, ctrl.updateProblem);
router.delete('/problems/:id', protect, ctrl.deleteProblem);
router.post('/problems/:id/submit', protect, ctrl.submitSolution);

router.get('/submissions', protect, ctrl.getSubmissions);
router.get('/submissions/:id', protect, ctrl.getSubmission);

router.get('/tests', ctrl.getTests);
router.get('/tests/:id', ctrl.getTest);
router.post('/tests', protect, ctrl.createTest);
router.put('/tests/:id', protect, ctrl.updateTest);
router.post('/tests/:id/publish', protect, ctrl.publishTest);
router.post('/tests/:id/start', protect, ctrl.startTest);
router.post('/tests/:id/submit', protect, ctrl.submitTest);

router.get('/attempts', protect, ctrl.getAttempts);
router.get('/attempts/:id', protect, ctrl.getAttemptResult);

router.get('/certificates', protect, ctrl.getCertificates);
router.post('/certificates/generate', protect, ctrl.generateCertificate);

router.get('/progress', protect, ctrl.getProgress);
router.put('/progress/:courseId', protect, ctrl.updateProgress);

router.get('/leaderboard', ctrl.getLeaderboard);

module.exports = router;