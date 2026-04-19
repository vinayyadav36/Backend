'use strict';
const db = require('../config/jsonDb');

const generateId = () => db.generateId();
const now = () => new Date().toISOString();

const seedData = async () => {
  console.log('Seeding database...');
  
  if (!db.find('pos_products', {}).length) {
    db.insert('pos_products', [
      { _id: generateId(), name: 'Coffee', sku: 'COF001', barcode: '123456789012', category: 'Beverages', hsnCode: '0901', gstRate: 18, price: 150, costPrice: 80, stock: 100, reorderLevel: 20, unit: 'cup', isActive: true, createdAt: now(), updatedAt: now() },
      { _id: generateId(), name: ' Sandwich', sku: 'SAN001', barcode: '123456789013', category: 'Food', hsnCode: '1905', gstRate: 18, price: 200, costPrice: 100, stock: 50, reorderLevel: 10, unit: 'piece', isActive: true, createdAt: now(), updatedAt: now() },
      { _id: generateId(), name: 'Tea', sku: 'TEA001', barcode: '123456789014', category: 'Beverages', hsnCode: '0902', gstRate: 5, price: 50, costPrice: 20, stock: 200, reorderLevel: 50, unit: 'cup', isActive: true, createdAt: now(), updatedAt: now() },
      { _id: generateId(), name: 'Pastry', sku: 'PAT001', barcode: '123456789015', category: 'Bakery', hsnCode: '1905', gstRate: 18, price: 80, costPrice: 40, stock: 30, reorderLevel: 10, unit: 'piece', isActive: true, createdAt: now(), updatedAt: now() },
    ]);
    console.log('✓ POS Products seeded');
  }

  if (!db.find('pos_customers', {}).length) {
    db.insert('pos_customers', [
      { _id: generateId(), name: 'John Doe', phone: '+919900001100', email: 'john@example.com', state: 'Maharashtra', stateCode: '27', type: 'retail', balance: 0, isActive: true, createdAt: now(), updatedAt: now() },
      { _id: generateId(), name: 'ABC Corp', phone: '+919900001200', email: 'contact@abccorp.com', gstin: '27ABCDE1234F1Z5', state: 'Maharashtra', stateCode: '27', type: 'business', creditLimit: 50000, balance: 0, isActive: true, createdAt: now(), updatedAt: now() },
    ]);
    console.log('✓ POS Customers seeded');
  }

  if (!db.find('agency_clients', {}).length) {
    db.insert('agency_clients', [
      { _id: generateId(), name: 'Rajesh Kumar', company: 'Tech Solutions', email: 'rajesh@techsol.in', phone: '+919900001300', industry: 'Technology', budget: 500000, status: 'active', source: 'Referral', createdAt: now(), updatedAt: now() },
      { _id: generateId(), name: 'Priya Sharma', company: 'Fashion Forward', email: 'priya@fashionforward.com', phone: '+919900001400', industry: 'E-commerce', budget: 250000, status: 'lead', source: 'Website', createdAt: now(), updatedAt: now() },
    ]);
    console.log('✓ Agency Clients seeded');
  }

  if (!db.find('agency_projects', {}).length) {
    const clients = db.find('agency_clients', {});
    db.insert('agency_projects', [
      { _id: generateId(), title: 'Website Redesign', clientId: clients[0]?._id || '', type: 'web', description: 'Complete website overhaul', status: 'active', budget: 150000, cost: 75000, milestone 
s: [{ _id: generateId(), title: 'Design', status: 'completed' }, { _id: generateId(), title: 'Development', status: 'in_progress' }], createdAt: now(), updatedAt: now() },
      { _id: generateId(), title: 'SEO Campaign', clientId: clients[1]?._id || '', type: 'marketing', description: '6 months SEO', status: 'planning', budget: 75000, cost: 0, createdAt: now(), updatedAt: now() },
    ]);
    console.log('✓ Agency Projects seeded');
  }

  if (!db.find('crm_leads', {}).length) {
    db.insert('crm_leads', [
      { _id: generateId(), name: 'Amit Patel', email: 'amit@startup.io', phone: '+919900001500', source: 'Website', score: 75, status: 'qualified', createdAt: now(), updatedAt: now() },
      { _id: generateId(), name: 'Sneha Reddy', email: 'sneha@design.co', phone: '+919900001600', source: 'Referral', score: 90, status: 'new', createdAt: now(), updatedAt: now() },
    ]);
    console.log('✓ CRM Leads seeded');
  }

  if (!db.find('hr_employees', {}).length) {
    db.insert('hr_employees', [
      { _id: generateId(), name: 'Vikram Singh', email: 'vikram@company.com', phone: '+919900001700', departmentId: 'engineering', designation: 'Senior Developer', salary: 85000, status: 'active', joinDate: '2024-01-15', createdAt: now(), updatedAt: now() },
      { _id: generateId(), name: 'Anjali Gupta', email: 'anjali@company.com', phone: '+919900001800', departmentId: 'sales', designation: 'Sales Executive', salary: 45000, status: 'active', joinDate: '2024-03-01', createdAt: now(), updatedAt: now() },
    ]);
    console.log('✓ HR Employees seeded');
  }

  if (!db.find('exam_courses', {}).length) {
    db.insert('exam_courses', [
      { _id: generateId(), title: 'JavaScript Fundamentals', description: 'Master JS from scratch', category: 'Programming', difficulty: 'beginner', price: 0, isFree: true, duration: 480, lessonsCount: 12, enrolledCount: 1250, rating: 4.5, isPublished: true, tags: ['javascript', 'web'], createdAt: now(), updatedAt: now() },
      { _id: generateId(), title: 'Data Structures & Algorithms', description: 'DSA for interviews', category: 'Computer Science', difficulty: 'intermediate', price: 999, duration: 1200, lessonsCount: 45, enrolledCount: 3500, rating: 4.8, isPublished: true, tags: ['dsa', 'interviews'], createdAt: now(), updatedAt: now() },
      { _id: generateId(), title: 'React Mastery', description: 'Build production apps', category: 'Frontend', difficulty: 'advanced', price: 1999, duration: 960, lessonsCount: 30, enrolledCount: 2100, rating: 4.7, isPublished: true, tags: ['react', 'frontend'], createdAt: now(), updatedAt: now() },
    ]);
    console.log('✓ Exam Courses seeded');
  }

  if (!db.find('exam_problems', {}).length) {
    db.insert('exam_problems', [
      { _id: generateId(), title: 'Two Sum', description: 'Find indices of two numbers that add up to target', difficulty: 'easy', category: 'Arrays', tags: ['array', 'hashmap'], points: 10, acceptance: 45, submissions: 12500, isPublished: true, createdAt: now() },
      { _id: generateId(), title: 'Reverse Linked List', description: 'Reverse a singly linked list', difficulty: 'easy', category: 'Linked List', tags: ['linkedlist'], points: 10, acceptance: 62, submissions: 8900, isPublished: true, createdAt: now() },
      { _id: generateId(), title: 'Merge Intervals', description: 'Merge overlapping intervals', difficulty: 'medium', category: 'Arrays', tags: ['array', 'sorting'], points: 20, acceptance: 38, submissions: 5600, isPublished: true, createdAt: now() },
    ]);
    console.log('✓ Exam Problems seeded');
  }

  if (!db.find('portfolio_projects', {}).length) {
    db.insert('portfolio_projects', [
      { _id: generateId(), title: 'E-commerce Platform', description: 'Full-stack shopping platform', category: 'Web Development', technologies: ['React', 'Node.js', 'MongoDB'], featured: true, status: 'active', createdAt: now(), updatedAt: now() },
      { _id: generateId(), title: 'AI Chatbot', description: 'ML-powered customer support', category: 'AI/ML', technologies: ['Python', 'TensorFlow', 'NLP'], featured: true, status: 'active', createdAt: now(), updatedAt: now() },
    ]);
    console.log('✓ Portfolio Projects seeded');
  }

  if (!db.find('team_members', {}).length) {
    db.insert('team_members', [
      { _id: generateId(), name: 'Alex Chen', role: 'Full Stack Developer', bio: '10+ years experience', skills: ['React', 'Node.js', 'Python'], order: 1, isActive: true, createdAt: now(), updatedAt: now() },
      { _id: generateId(), name: 'Maria Santos', role: 'UI/UX Designer', bio: 'Creative designer', skills: ['Figma', 'Photoshop', 'Illustrator'], order: 2, isActive: true, createdAt: now(), updatedAt: now() },
    ]);
    console.log('✓ Team Members seeded');
  }

  console.log('✓ Database seeding complete!');
  return { success: true };
};

seedData().then(console.log).catch(console.error);
module.exports = seedData;