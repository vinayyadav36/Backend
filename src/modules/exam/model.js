'use strict';
const { createJsonModel } = require('../../models/JsonModel');

const ExamCourse = createJsonModel('exam_courses', 'ExamCourse', {
  title: { type: 'string', required: true },
  description: { type: 'string' },
  category: { type: 'string', required: true },
  difficulty: { type: 'string', default: 'beginner' },
  thumbnail: { type: 'string' },
  price: { type: 'number', default: 0 },
  isFree: { type: 'boolean', default: false },
  duration: { type: 'number', default: 0 },
  lessonsCount: { type: 'number', default: 0 },
  enrolledCount: { type: 'number', default: 0 },
  rating: { type: 'number', default: 0 },
  isPublished: { type: 'boolean', default: false },
  tags: { type: 'array', default: [] },
  createdAt: { type: 'date' },
  updatedAt: { type: 'date' },
});

const ExamLesson = createJsonModel('exam_lessons', 'ExamLesson', {
  courseId: { type: 'string', required: true },
  title: { type: 'string', required: true },
  content: { type: 'string' },
  type: { type: 'string', default: 'text' },
  videoUrl: { type: 'string' },
  code: { type: 'string' },
  order: { type: 'number', default: 0 },
  duration: { type: 'number', default: 0 },
  isPublished: { type: 'boolean', default: false },
  createdAt: { type: 'date' },
});

const ExamProblem = createJsonModel('exam_problems', 'ExamProblem', {
  title: { type: 'string', required: true },
  description: { type: 'string', required: true },
  difficulty: { type: 'string', default: 'easy' },
  category: { type: 'string' },
  tags: { type: 'array', default: [] },
  examples: { type: 'array', default: [] },
  constraints: { type: 'array', default: [] },
  starterCode: { type: 'string' },
  solution: { type: 'string' },
  testCases: { type: 'array', default: [] },
  points: { type: 'number', default: 10 },
  acceptance: { type: 'number', default: 0 },
 Submissions: { type: 'number', default: 0 },
  isPublished: { type: 'boolean', default: false },
  createdAt: { type: 'date' },
});

const ExamSubmission = createJsonModel('exam_submissions', 'ExamSubmission', {
  problemId: { type: 'string', required: true },
  userId: { type: 'string', required: true },
  code: { type: 'string', required: true },
  language: { type: 'string', default: 'javascript' },
  status: { type: 'string', default: 'pending' },
  output: { type: 'string' },
  error: { type: 'string' },
  runtime: { type: 'number', default: 0 },
  memory: { type: 'number', default: 0 },
  score: { type: 'number', default: 0 },
  maxScore: { type: 'number', default: 0 },
  createdAt: { type: 'date' },
});

const ExamTest = createJsonModel('exam_tests', 'ExamTest', {
  title: { type: 'string', required: true },
  description: { type: 'string' },
  category: { type: 'string', required: true },
  duration: { type: 'number', default: 60 },
  totalMarks: { type: 'number', default: 100 },
  passingMarks: { type: 'number', default: 35 },
  questions: { type: 'array', default: [] },
  status: { type: 'string', default: 'draft' },
  scheduledFor: { type: 'date' },
  allowedAttempts: { type: 'number', default: 1 },
  isPublished: { type: 'boolean', default: false },
  createdAt: { type: 'date' },
});

const ExamAttempt = createJsonModel('exam_attempts', 'ExamAttempt', {
  testId: { type: 'string', required: true },
  userId: { type: 'string', required: true },
  questions: { type: 'array', default: [] },
  answers: { type: 'object', default: {} },
  status: { type: 'string', default: 'in_progress' },
  score: { type: 'number', default: 0 },
  maxScore: { type: 'number', default: 100 },
  startedAt: { type: 'date' },
  submittedAt: { type: 'date' },
  timeTaken: { type: 'number', default: 0 },
  createdAt: { type: 'date' },
});

const ExamCertificate = createJsonModel('exam_certificates', 'ExamCertificate', {
  userId: { type: 'string', required: true },
  courseId: { type: 'string', required: true },
  courseName: { type: 'string', required: true },
  issuedAt: { type: 'date' },
  credentialId: { type: 'string', required: true },
  template: { type: 'string', default: 'default' },
});

const ExamProgress = createJsonModel('exam_progress', 'ExamProgress', {
  userId: { type: 'string', required: true },
  courseId: { type: 'string', required: true },
  lessonId: { type: 'string' },
  completed: { type: 'boolean', default: false },
  watchedSeconds: { type: 'number', default: 0 },
  completedAt: { type: 'date' },
});

module.exports = {
  ExamCourse,
  ExamLesson,
  ExamProblem,
  ExamSubmission,
  ExamTest,
  ExamAttempt,
  ExamCertificate,
  ExamProgress,
};