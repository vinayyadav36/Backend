'use strict';
/**
 * Portfolio / Studio Module - Controller
 */
const { Project, Service, Testimonial, Blog, ContactForm, TeamMember } = require('./model');
const logger = require('../../config/logger');

const ok = (res, data, code = 200) => res.status(code).json({ success: true, data });
const err = (res, e, code = 500) => { logger.error(e.message); res.status(code).json({ success: false, message: e.message }); };

// Projects
const getProjects = async (req, res) => { try { const { featured, category } = req.query; const q = {}; if (featured === 'true') q.featured = true; if (category) q.category = category; const data = await Project.find(q).lean(); ok(res, data); } catch (e) { err(res, e); } };
const getProject = async (req, res) => { try { const data = await Project.findById(req.params.id); if (!data) return res.status(404).json({ success: false, message: 'Not found' }); ok(res, data); } catch (e) { err(res, e); } };
const createProject = async (req, res) => { try { const data = await Project.create(req.body); ok(res, data, 201); } catch (e) { err(res, e); } };
const updateProject = async (req, res) => { try { const data = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true }); ok(res, data); } catch (e) { err(res, e); } };
const deleteProject = async (req, res) => { try { await Project.findByIdAndDelete(req.params.id); ok(res, { message: 'Deleted' }); } catch (e) { err(res, e); } };

// Services
const getServices = async (req, res) => { try { const data = await Service.find({ isActive: true }).lean(); ok(res, data); } catch (e) { err(res, e); } };
const createService = async (req, res) => { try { const data = await Service.create(req.body); ok(res, data, 201); } catch (e) { err(res, e); } };
const updateService = async (req, res) => { try { const data = await Service.findByIdAndUpdate(req.params.id, req.body, { new: true }); ok(res, data); } catch (e) { err(res, e); } };
const deleteService = async (req, res) => { try { await Service.findByIdAndDelete(req.params.id); ok(res, { message: 'Deleted' }); } catch (e) { err(res, e); } };

// Testimonials
const getTestimonials = async (req, res) => { try { const data = await Testimonial.find({ isPublished: true }).lean(); ok(res, data); } catch (e) { err(res, e); } };
const createTestimonial = async (req, res) => { try { const data = await Testimonial.create(req.body); ok(res, data, 201); } catch (e) { err(res, e); } };
const updateTestimonial = async (req, res) => { try { const data = await Testimonial.findByIdAndUpdate(req.params.id, req.body, { new: true }); ok(res, data); } catch (e) { err(res, e); } };

// Blog
const getBlogs = async (req, res) => { try { const q = req.query.published === 'true' ? { published: true } : {}; const data = await Blog.find(q).lean(); ok(res, data); } catch (e) { err(res, e); } };
const getBlog = async (req, res) => { try { const data = await Blog.findById(req.params.id); if (!data) return res.status(404).json({ success: false, message: 'Not found' }); ok(res, data); } catch (e) { err(res, e); } };
const createBlog = async (req, res) => { try { if (!req.body.slug) req.body.slug = req.body.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''); const data = await Blog.create(req.body); ok(res, data, 201); } catch (e) { err(res, e); } };
const updateBlog = async (req, res) => { try { const data = await Blog.findByIdAndUpdate(req.params.id, req.body, { new: true }); ok(res, data); } catch (e) { err(res, e); } };
const publishBlog = async (req, res) => { try { const data = await Blog.findByIdAndUpdate(req.params.id, { published: true, publishedAt: new Date() }, { new: true }); ok(res, data); } catch (e) { err(res, e); } };
const deleteBlog = async (req, res) => { try { await Blog.findByIdAndDelete(req.params.id); ok(res, { message: 'Deleted' }); } catch (e) { err(res, e); } };

// Contact Form (public)
const submitContact = async (req, res) => { try { const data = await ContactForm.create(req.body); ok(res, { message: 'Message received. We will contact you soon!', id: data._id }, 201); } catch (e) { err(res, e); } };
const getContacts = async (req, res) => { try { const data = await ContactForm.find({}).lean(); ok(res, data); } catch (e) { err(res, e); } };
const updateContactStatus = async (req, res) => { try { const data = await ContactForm.findByIdAndUpdate(req.params.id, { status: req.body.status, repliedAt: req.body.status === 'replied' ? new Date() : undefined }, { new: true }); ok(res, data); } catch (e) { err(res, e); } };

// Team
const getTeam = async (req, res) => { try { const data = await TeamMember.find({ isActive: true }).lean(); ok(res, data.sort((a, b) => (a.order || 0) - (b.order || 0))); } catch (e) { err(res, e); } };
const createTeamMember = async (req, res) => { try { const data = await TeamMember.create(req.body); ok(res, data, 201); } catch (e) { err(res, e); } };
const updateTeamMember = async (req, res) => { try { const data = await TeamMember.findByIdAndUpdate(req.params.id, req.body, { new: true }); ok(res, data); } catch (e) { err(res, e); } };
const deleteTeamMember = async (req, res) => { try { await TeamMember.findByIdAndDelete(req.params.id); ok(res, { message: 'Deleted' }); } catch (e) { err(res, e); } };

// Portfolio Stats (public dashboard)
const getStats = async (req, res) => {
  try {
    const [projects, services, testimonials, blogs] = await Promise.all([
      Project.countDocuments({ status: 'active' }),
      Service.countDocuments({ isActive: true }),
      Testimonial.countDocuments({ isPublished: true }),
      Blog.countDocuments({ published: true }),
    ]);
    ok(res, { projects, services, testimonials, blogs });
  } catch (e) { err(res, e); }
};

module.exports = { getProjects, getProject, createProject, updateProject, deleteProject, getServices, createService, updateService, deleteService, getTestimonials, createTestimonial, updateTestimonial, getBlogs, getBlog, createBlog, updateBlog, publishBlog, deleteBlog, submitContact, getContacts, updateContactStatus, getTeam, createTeamMember, updateTeamMember, deleteTeamMember, getStats };
