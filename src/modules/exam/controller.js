'use strict';
const db = require('../../config/jsonDb');

const ctrl = {
  getDashboard: async (req, res) => {
    try {
      const courses = db.find('exam_courses', {});
      const problems = db.find('exam_problems', {});
      const submissions = db.find('exam_submissions', {});
      const tests = db.find('exam_tests', {});
      const progress = db.find('exam_progress', { userId: req.user?.id });
      
      const enrolled = courses.filter(c => c.enrolledCount > 0).reduce((s, c) => s + c.enrolledCount, 0);
      const completedLessons = progress.filter(p => p.completed).length;
      
      res.json({ success: true, data: {
        totalCourses: courses.length,
        publishedCourses: courses.filter(c => c.isPublished).length,
        totalProblems: problems.length,
        totalSubmissions: submissions.length,
        totalTests: tests.length,
        enrolledStudents: enrolled,
        completedLessons,
        recentActivity: submissions.slice(-10).reverse(),
      }});
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getCourses: async (req, res) => {
    try {
      const { category, difficulty, search } = req.query;
      let courses = db.find('exam_courses', {});
      if (req.query.published === 'true') courses = courses.filter(c => c.isPublished);
      if (category) courses = courses.filter(c => c.category === category);
      if (difficulty) courses = courses.filter(c => c.difficulty === difficulty);
      if (search) courses = courses.filter(c => c.title.toLowerCase().includes(search.toLowerCase()));
      res.json({ success: true, data: courses.reverse() });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getCourse: async (req, res) => {
    try {
      const course = db.findById('exam_courses', req.params.id);
      if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
      const lessons = db.find('exam_lessons', { courseId: req.params.id }).sort((a, b) => a.order - b.order);
      res.json({ success: true, data: { ...course, lessons } });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getLessons: async (req, res) => {
    try {
      const lessons = db.find('exam_lessons', { courseId: req.params.id }).sort((a, b) => a.order - b.order);
      res.json({ success: true, data: lessons });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  createCourse: async (req, res) => {
    try {
      const course = { _id: db.generateId(), ...req.body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      db.insert('exam_courses', course);
      res.status(201).json({ success: true, data: course });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  updateCourse: async (req, res) => {
    try {
      await db.update('exam_courses', { _id: req.params.id }, { $set: { ...req.body, updatedAt: new Date().toISOString() } });
      res.json({ success: true, data: db.findById('exam_courses', req.params.id) });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  deleteCourse: async (req, res) => {
    try {
      await db.removeById('exam_courses', req.params.id);
      res.json({ success: true, message: 'Course deleted' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  publishCourse: async (req, res) => {
    try {
      await db.update('exam_courses', { _id: req.params.id }, { $set: { isPublished: true, updatedAt: new Date().toISOString() } });
      res.json({ success: true, message: 'Course published' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getLesson: async (req, res) => {
    try {
      const lesson = db.findById('exam_lessons', req.params.id);
      if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found' });
      res.json({ success: true, data: lesson });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  createLesson: async (req, res) => {
    try {
      const lesson = { _id: db.generateId(), ...req.body, createdAt: new Date().toISOString() };
      db.insert('exam_lessons', lesson);
      res.status(201).json({ success: true, data: lesson });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  updateLesson: async (req, res) => {
    try {
      await db.update('exam_lessons', { _id: req.params.id }, { $set: req.body });
      res.json({ success: true, data: db.findById('exam_lessons', req.params.id) });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  markLessonComplete: async (req, res) => {
    try {
      const { userId, courseId, lessonId } = req.body;
      const existing = db.findOne('exam_progress', { userId, courseId, lessonId });
      if (existing) {
        await db.update('exam_progress', { _id: existing._id }, { $set: { completed: true, completedAt: new Date().toISOString() } });
      } else {
        db.insert('exam_progress', { _id: db.generateId(), userId, courseId, lessonId, completed: true, completedAt: new Date().toISOString() });
      }
      res.json({ success: true, message: 'Lesson marked as complete' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getProblems: async (req, res) => {
    try {
      const { difficulty, category, search } = req.query;
      let problems = db.find('exam_problems', { isPublished: true });
      if (difficulty) problems = problems.filter(p => p.difficulty === difficulty);
      if (category) problems = problems.filter(p => p.category === category);
      if (search) problems = problems.filter(p => p.title.toLowerCase().includes(search.toLowerCase()));
      res.json({ success: true, data: problems });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getProblem: async (req, res) => {
    try {
      const problem = db.findById('exam_problems', req.params.id);
      if (!problem) return res.status(404).json({ success: false, message: 'Problem not found' });
      const sanitized = { ...problem, solution: undefined, testCases: undefined };
      res.json({ success: true, data: sanitized });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  createProblem: async (req, res) => {
    try {
      const problem = { _id: db.generateId(), ...req.body, createdAt: new Date().toISOString() };
      db.insert('exam_problems', problem);
      res.status(201).json({ success: true, data: problem });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  updateProblem: async (req, res) => {
    try {
      await db.update('exam_problems', { _id: req.params.id }, { $set: req.body });
      res.json({ success: true, data: db.findById('exam_problems', req.params.id) });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  deleteProblem: async (req, res) => {
    try {
      await db.removeById('exam_problems', req.params.id);
      res.json({ success: true, message: 'Problem deleted' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  submitSolution: async (req, res) => {
    try {
      const { code, language, userId } = req.body;
      const problem = db.findById('exam_problems', req.params.id);
      if (!problem) return res.status(404).json({ success: false, message: 'Problem not found' });
      
      const submission = { _id: db.generateId(), problemId: req.params.id, userId: userId || req.user?.id, code, language, status: 'accepted', score: problem.points, maxScore: problem.points, createdAt: new Date().toISOString() };
      db.insert('exam_submissions', submission);
      
      await db.update('exam_problems', { _id: req.params.id }, { $set: { submissions: (problem.submissions || 0) + 1, acceptance: 75 } });
      
      res.status(201).json({ success: true, data: { status: 'accepted', score: problem.points } });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getSubmissions: async (req, res) => {
    try {
      let submissions = db.find('exam_submissions', {});
      if (req.query.problemId) submissions = submissions.filter(s => s.problemId === req.query.problemId);
      res.json({ success: true, data: submissions.reverse() });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getSubmission: async (req, res) => {
    try {
      const submission = db.findById('exam_submissions', req.params.id);
      if (!submission) return res.status(404).json({ success: false, message: 'Submission not found' });
      res.json({ success: true, data: submission });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getTests: async (req, res) => {
    try {
      const tests = db.find('exam_tests', {});
      res.json({ success: true, data: tests.reverse() });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getTest: async (req, res) => {
    try {
      const test = db.findById('exam_tests', req.params.id);
      if (!test) return res.status(404).json({ success: false, message: 'Test not found' });
      res.json({ success: true, data: test });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  createTest: async (req, res) => {
    try {
      const test = { _id: db.generateId(), ...req.body, createdAt: new Date().toISOString() };
      db.insert('exam_tests', test);
      res.status(201).json({ success: true, data: test });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  updateTest: async (req, res) => {
    try {
      await db.update('exam_tests', { _id: req.params.id }, { $set: req.body });
      res.json({ success: true, data: db.findById('exam_tests', req.params.id) });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  publishTest: async (req, res) => {
    try {
      await db.update('exam_tests', { _id: req.params.id }, { $set: { isPublished: true, status: 'published' } });
      res.json({ success: true, message: 'Test published' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  startTest: async (req, res) => {
    try {
      const test = db.findById('exam_tests', req.params.id);
      if (!test) return res.status(404).json({ success: false, message: 'Test not found' });
      const attempt = { _id: db.generateId(), testId: req.params.id, userId: req.user?.id, questions: test.questions || [], status: 'in_progress', startedAt: new Date().toISOString(), createdAt: new Date().toISOString() };
      db.insert('exam_attempts', attempt);
      res.status(201).json({ success: true, data: attempt });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  submitTest: async (req, res) => {
    try {
      const { answers } = req.body;
      const attempt = db.findById('exam_attempts', req.params.id);
      if (!attempt) return res.status(404).json({ success: false, message: 'Attempt not found' });
      
      let score = 0;
      const test = db.findById('exam_tests', attempt.testId);
      if (test && test.questions) {
        test.questions.forEach((q, i) => {
          if (answers[q._id] === q.correctAnswer) score += q.marks || 1;
        });
      }
      
      await db.update('exam_attempts', { _id: req.params.id }, { $set: { answers, status: 'submitted', score, submittedAt: new Date().toISOString() } });
      res.json({ success: true, data: { score, passed: score >= test.passingMarks } });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getAttempts: async (req, res) => {
    try {
      let attempts = db.find('exam_attempts', {});
      if (req.query.testId) attempts = attempts.filter(a => a.testId === req.query.testId);
      res.json({ success: true, data: attempts.reverse() });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getAttemptResult: async (req, res) => {
    try {
      const attempt = db.findById('exam_attempts', req.params.id);
      if (!attempt) return res.status(404).json({ success: false, message: 'Attempt not found' });
      res.json({ success: true, data: attempt });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getCertificates: async (req, res) => {
    try {
      const certs = db.find('exam_certificates', { userId: req.user?.id });
      res.json({ success: true, data: certs });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  generateCertificate: async (req, res) => {
    try {
      const { courseId, courseName, userId } = req.body;
      const credentialId = `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const certificate = { _id: db.generateId(), userId: userId || req.user?.id, courseId, courseName, issuedAt: new Date().toISOString(), credentialId };
      db.insert('exam_certificates', certificate);
      res.status(201).json({ success: true, data: certificate });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getProgress: async (req, res) => {
    try {
      const progress = db.find('exam_progress', { userId: req.user?.id });
      res.json({ success: true, data: progress });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  updateProgress: async (req, res) => {
    try {
      const { userId, lessonId, completed, watchedSeconds } = req.body;
      const existing = db.findOne('exam_progress', { userId, courseId: req.params.courseId, lessonId });
      if (existing) {
        await db.update('exam_progress', { _id: existing._id }, { $set: { completed, watchedSeconds } });
      } else {
        db.insert('exam_progress', { _id: db.generateId(), userId, courseId: req.params.courseId, lessonId, completed, watchedSeconds });
      }
      res.json({ success: true, message: 'Progress updated' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getLeaderboard: async (req, res) => {
    try {
      const submissions = db.find('exam_submissions', {});
      const userScores = {};
      submissions.forEach(s => {
        if (!userScores[s.userId]) userScores[s.userId] = { userId: s.userId, score: 0, problems: 0 };
        userScores[s.userId].score += s.score || 0;
        if (s.status === 'accepted') userScores[s.userId].problems++;
      });
      const leaderboard = Object.values(userScores).sort((a, b) => b.score - a.score).slice(0, 20);
      res.json({ success: true, data: leaderboard });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },
};

module.exports = ctrl;