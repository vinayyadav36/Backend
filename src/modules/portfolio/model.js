'use strict';
/**
 * Portfolio / Studio Module - Models
 */
const { createJsonModel } = require('../../models/JsonModel');

const Project = createJsonModel('portfolio_projects', {
  title: { type: 'string', required: true },
  description: { type: 'string' },
  category: { type: 'string' },
  technologies: { type: 'array', default: [] },
  client: { type: 'string' },
  images: { type: 'array', default: [] },
  url: { type: 'string' },
  featured: { type: 'boolean', default: false },
  status: { type: 'string', default: 'active' },
});

const Service = createJsonModel('services', {
  name: { type: 'string', required: true },
  description: { type: 'string' },
  price: { type: 'number', default: 0 },
  duration: { type: 'string' },
  features: { type: 'array', default: [] },
  category: { type: 'string' },
  isActive: { type: 'boolean', default: true },
});

const Testimonial = createJsonModel('testimonials', {
  client: { type: 'string', required: true },
  company: { type: 'string' },
  text: { type: 'string', required: true },
  rating: { type: 'number', default: 5 },
  projectId: { type: 'string' },
  isPublished: { type: 'boolean', default: true },
});

const Blog = createJsonModel('blogs', {
  title: { type: 'string', required: true },
  content: { type: 'string' },
  slug: { type: 'string' },
  tags: { type: 'array', default: [] },
  published: { type: 'boolean', default: false },
  publishedAt: { type: 'date' },
  views: { type: 'number', default: 0 },
  likes: { type: 'number', default: 0 },
  coverImage: { type: 'string' },
  author: { type: 'string' },
});

const ContactForm = createJsonModel('portfolio_contacts', {
  name: { type: 'string', required: true },
  email: { type: 'string', required: true },
  message: { type: 'string', required: true },
  service: { type: 'string' },
  budget: { type: 'string' },
  status: { type: 'string', default: 'new' },
  repliedAt: { type: 'date' },
});

const TeamMember = createJsonModel('team_members', {
  name: { type: 'string', required: true },
  role: { type: 'string' },
  bio: { type: 'string' },
  skills: { type: 'array', default: [] },
  social: { type: 'object', default: {} },
  avatar: { type: 'string' },
  isActive: { type: 'boolean', default: true },
  order: { type: 'number', default: 0 },
});

module.exports = { Project, Service, Testimonial, Blog, ContactForm, TeamMember };
