/**
 * HotelAI Backend Application
 * Main Express application setup with security, monitoring, and real-time features
 * @version 1.0.0
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

require('dotenv').config();

const logger = require('./config/logger');
const { errorHandler, notFound } = require('./middlewares/errorMiddleware');

// Import routes
const authRoutes = require('./routes/authRoutes');
const guestRoutes = require('./routes/guestRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const roomRoutes = require('./routes/roomRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');

// Jarvis: new platform routes (Deliverables B-F)
const ledgerRoutes = require('./routes/ledgerRoutes');
const jarvisRoutes = require('./routes/jarvisRoutes');
const reportsRoutes = require('./routes/reportsRoutes');
const reconcileRoutes = require('./routes/reconcileRoutes');
const pdfRoutes = require('./routes/pdfRoutes');

// Jarvis: audit middleware (Deliverable F)
const auditMiddleware = require('./middlewares/auditMiddleware');
const requestId = require('./middlewares/requestIdMiddleware');

// Initialize Express app
const app = express();
const server = createServer(app);

// ==========================================
// SOCKET.IO CONFIGURATION
// ==========================================
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ["http://localhost:5173", "http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
});

// Socket.IO authentication middleware
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token || 
                  socket.handshake.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }
    
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    
    logger.info(`Socket authenticated: ${socket.id} for user: ${decoded.userId || decoded.id}`);
    next();
  } catch (error) {
    logger.error('Socket authentication failed:', error.message);
    next(new Error('Invalid authentication token'));
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}, User: ${socket.user?.userId || socket.user?.id}`);

  // Auto-join user's hotel room
  if (socket.user.hotelId) {
    socket.join(`hotel_${socket.user.hotelId}`);
    logger.info(`Socket ${socket.id} joined hotel_${socket.user.hotelId}`);
  }

  // Handle room join
  socket.on('join_hotel', (hotelId) => {
    if (!hotelId || typeof hotelId !== 'string') {
      logger.warn(`Invalid hotelId provided: ${hotelId}`);
      socket.emit('error', { message: 'Invalid hotel ID' });
      return;
    }
    
    // Verify user has access to this hotel
    if (socket.user.hotelId !== hotelId && socket.user.role !== 'admin') {
      logger.warn(`Unauthorized hotel access attempt: ${socket.user.id} -> ${hotelId}`);
      socket.emit('error', { message: 'Unauthorized access' });
      return;
    }
    
    socket.join(`hotel_${hotelId}`);
    logger.info(`Socket ${socket.id} joined hotel ${hotelId}`);
    socket.emit('joined_hotel', { hotelId });
  });

  // Handle booking updates
  socket.on('booking_update', (data) => {
    if (!data?.hotelId || !data?.bookingId) {
      logger.warn('Invalid booking update data:', data);
      return;
    }
    
    logger.info(`Broadcasting booking update for hotel ${data.hotelId}`);
    socket.to(`hotel_${data.hotelId}`).emit('booking_update', {
      bookingId: data.bookingId,
      status: data.status,
      updatedBy: socket.user.id,
      timestamp: new Date().toISOString()
    });
  });

  // Handle room status changes
  socket.on('room_status_change', (data) => {
    if (!data?.hotelId || !data?.roomId) {
      logger.warn('Invalid room status change data:', data);
      return;
    }
    
    logger.info(`Broadcasting room status change for hotel ${data.hotelId}`);
    socket.to(`hotel_${data.hotelId}`).emit('room_status_change', {
      roomId: data.roomId,
      status: data.status,
      updatedBy: socket.user.id,
      timestamp: new Date().toISOString()
    });
  });

  // Handle guest check-in notification
  socket.on('guest_checkin', (data) => {
    if (!data?.hotelId || !data?.guestId) {
      logger.warn('Invalid guest check-in data:', data);
      return;
    }
    
    socket.to(`hotel_${data.hotelId}`).emit('guest_checkin', {
      guestId: data.guestId,
      roomId: data.roomId,
      timestamp: new Date().toISOString()
    });
  });

  // Handle guest check-out notification
  socket.on('guest_checkout', (data) => {
    if (!data?.hotelId || !data?.guestId) {
      logger.warn('Invalid guest check-out data:', data);
      return;
    }
    
    socket.to(`hotel_${data.hotelId}`).emit('guest_checkout', {
      guestId: data.guestId,
      roomId: data.roomId,
      timestamp: new Date().toISOString()
    });
  });

  // Handle disconnect
  socket.on('disconnect', (reason) => {
    logger.info(`Client disconnected: ${socket.id}, Reason: ${reason}`);
  });

  // Handle errors
  socket.on('error', (error) => {
    logger.error('Socket error:', error);
  });
});

// Make io accessible to routes
app.set('io', io);

// ==========================================
// TRUST PROXY (for rate limiting behind reverse proxy)
// ==========================================
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// ==========================================
// SECURITY MIDDLEWARE
// ==========================================

// Request ID - assign unique ID to every request
app.use(requestId);

// Helmet - Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// Data sanitization against NoSQL injection
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    logger.warn(`Sanitized NoSQL injection attempt: ${key} from IP: ${req.ip}`);
  },
}));

// ==========================================
// RATE LIMITING
// ==========================================

// Authentication rate limiter (stricter)
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW || 15) * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_AUTH_MAX || 5),
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for auth endpoint: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts. Please try again later.'
    });
  }
});

// Registration rate limiter (very strict)
const registerLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_REGISTER_WINDOW || 60) * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_REGISTER_MAX || 3),
  message: {
    success: false,
    message: 'Too many accounts created from this IP. Please try again in an hour.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || 100),
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/health';
  },
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded: ${req.ip} - ${req.path}`);
    res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.'
    });
  }
});

// ==========================================
// CORS CONFIGURATION
// ==========================================
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(',').map(o => o.trim());
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-tenant-id'],
  exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
  maxAge: 86400, // 24 hours
};

app.use(cors(corsOptions));

// ==========================================
// GENERAL MIDDLEWARE
// ==========================================

// Compression
app.use(compression({
  level: parseInt(process.env.COMPRESSION_LEVEL || 6),
  threshold: 1024, // Only compress responses larger than 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
}));

// HTTP request logging
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined', { 
    stream: { 
      write: (message) => logger.info(message.trim()) 
    } 
  }));
} else {
  app.use(morgan('dev'));
}

// Body parsers
app.use(express.json({ 
  limit: '10mb'
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files statically
const uploadsPath = path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsPath));

// ==========================================
// HEALTH CHECK ENDPOINT
// ==========================================
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB',
    },
    socketConnections: io?.engine?.clientsCount ?? 0,
  });
});

// Simple API info endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Hotel Management System API',
    version: 'v1',
    status: 'active',
    documentation: '/api/docs',
  });
});

// ==========================================
// API ROUTES
// ==========================================
const apiVersion = 'v1';

// Apply rate limiters to specific routes
app.use(`/api/${apiVersion}/auth/login`, authLimiter);
app.use(`/api/${apiVersion}/auth/register`, registerLimiter);
app.use(`/api/${apiVersion}/auth/forgot-password`, authLimiter);

// Mount routes with general API limiter
app.use(`/api/${apiVersion}/auth`, apiLimiter, authRoutes);
app.use(`/api/${apiVersion}/guests`, apiLimiter, guestRoutes);
app.use(`/api/${apiVersion}/bookings`, apiLimiter, bookingRoutes);
app.use(`/api/${apiVersion}/rooms`, apiLimiter, roomRoutes);
app.use(`/api/${apiVersion}/invoices`, apiLimiter, invoiceRoutes);
app.use(`/api/${apiVersion}/analytics`, apiLimiter, analyticsRoutes);

// ── Jarvis Platform Routes (Deliverables B-F) ─────────────────────────────
app.use(`/api/${apiVersion}/ledger`, apiLimiter, auditMiddleware, ledgerRoutes);
app.use(`/api/${apiVersion}/jarvis`, apiLimiter, jarvisRoutes);
app.use(`/api/${apiVersion}/reports`, apiLimiter, reportsRoutes);
app.use(`/api/${apiVersion}/reconcile`, apiLimiter, auditMiddleware, reconcileRoutes);
app.use(`/api/${apiVersion}/pdf`, apiLimiter, pdfRoutes);

// ==========================================
// ERROR HANDLING MIDDLEWARE
// ==========================================
app.use(notFound);
app.use(errorHandler);

// ==========================================
// EXPORTS
// ==========================================
module.exports = { app, server, io };
