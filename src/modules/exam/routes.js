'use strict';
const express = require('express');
const router = express.Router();
const { protect } = require('../../middlewares/authMiddleware');
const ctrl = require('./controller');

router.get('/dashboard', ctrl.getDashboard);

router.get('/courses', ctrl.getCourses);
router.get('/courses/:id', ctrl.getCourse);
router.get('/courses/:id/lessons', ctrl.getLessons);
router.post('/courses', ctrl.createCourse);
router.put('/courses/:id', ctrl.updateCourse);
router.delete('/courses/:id', ctrl.deleteCourse);
router.post('/courses/:id/publish', ctrl.publishCourse);

router.get('/lessons/:id', ctrl.getLesson);
router.post('/lessons', ctrl.createLesson);
router.put('/lessons/:id', ctrl.updateLesson);
router.post('/lessons/:id/complete', ctrl.markLessonComplete);

router.get('/problems', ctrl.getProblems);
router.get('/problems/:id', ctrl.getProblem);
router.post('/problems', ctrl.createProblem);
router.put('/problems/:id', ctrl.updateProblem);
router.delete('/problems/:id', ctrl.deleteProblem);
router.post('/problems/:id/submit', ctrl.submitSolution);

router.get('/submissions', ctrl.getSubmissions);
router.get('/submissions/:id', ctrl.getSubmission);

router.get('/tests', ctrl.getTests);
router.get('/tests/:id', ctrl.getTest);
router.post('/tests', ctrl.createTest);
router.put('/tests/:id', ctrl.updateTest);
router.post('/tests/:id/publish', ctrl.publishTest);
router.post('/tests/:id/start', ctrl.startTest);
router.post('/tests/:id/submit', ctrl.submitTest);

router.get('/attempts', ctrl.getAttempts);
router.get('/attempts/:id', ctrl.getAttemptResult);

router.get('/certificates', ctrl.getCertificates);
router.post('/certificates/generate', ctrl.generateCertificate);

router.get('/progress', ctrl.getProgress);
router.put('/progress/:courseId', ctrl.updateProgress);

router.get('/leaderboard', ctrl.getLeaderboard);

module.exports = router;