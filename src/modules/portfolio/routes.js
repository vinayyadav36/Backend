'use strict';
const router = require('express').Router();
const { protect } = require('../../middlewares/authMiddleware');
const c = require('./controller');

// Public routes
router.get('/projects', c.getProjects);
router.get('/projects/:id', c.getProject);
router.get('/services', c.getServices);
router.get('/testimonials', c.getTestimonials);
router.get('/blogs', c.getBlogs);
router.get('/blogs/:id', c.getBlog);
router.get('/team', c.getTeam);
router.get('/stats', c.getStats);
router.post('/contact', c.submitContact);

// Protected admin routes
router.use(protect);
router.post('/projects', c.createProject);
router.put('/projects/:id', c.updateProject);
router.delete('/projects/:id', c.deleteProject);
router.post('/services', c.createService);
router.put('/services/:id', c.updateService);
router.delete('/services/:id', c.deleteService);
router.post('/testimonials', c.createTestimonial);
router.put('/testimonials/:id', c.updateTestimonial);
router.post('/blogs', c.createBlog);
router.put('/blogs/:id', c.updateBlog);
router.post('/blogs/:id/publish', c.publishBlog);
router.delete('/blogs/:id', c.deleteBlog);
router.get('/contacts', c.getContacts);
router.put('/contacts/:id', c.updateContactStatus);
router.post('/team', c.createTeamMember);
router.put('/team/:id', c.updateTeamMember);
router.delete('/team/:id', c.deleteTeamMember);

module.exports = router;
