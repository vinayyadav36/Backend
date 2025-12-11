/**
 * Hotel Management System - Server Entry Point
 * @version 1.0.0
 * @description Main server file that initializes the Express app, connects to MongoDB,
 *              and handles graceful shutdown with Socket.IO support
 */

// ==========================================
// LOAD ENVIRONMENT VARIABLES FIRST
// ==========================================
require('dotenv').config();

console.log('========================================');
console.log('🏨 Hotel Management System Backend');
console.log('========================================');
console.log(`📅 Started at: ${new Date().toLocaleString()}`);
console.log(`🔧 Node Version: ${process.version}`);
console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log('========================================\n');

// ==========================================
// IMPORT REQUIRED MODULES
// ==========================================
let server, io, logger;

try {
  console.log('Loading application modules...');
  
  // Import app and socket.io server
  const appModule = require('./src/app');
  server = appModule.server;
  io = appModule.io;
  console.log('✓ Express app and Socket.IO loaded');
  
  // Import database connection
  const { connectDB } = require('./src/config/database');
  console.log('✓ Database module loaded');
  
  // Import logger
  logger = require('./src/config/logger');
  console.log('✓ Logger module loaded\n');
  
  // ==========================================
  // CONNECT TO DATABASE
  // ==========================================
  console.log('Connecting to MongoDB...');
  connectDB().catch(err => {
    console.error('❌ Database connection failed:', err.message);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  });
  
  // ==========================================
  // START SERVER
  // ==========================================
  const PORT = process.env.PORT || 5000;
  const NODE_ENV = process.env.NODE_ENV || 'development';
  
  server.listen(PORT, () => {
    console.log('\n========================================');
    console.log('✅ SERVER STARTED SUCCESSFULLY');
    console.log('========================================');
    console.log(`🚀 Environment: ${NODE_ENV}`);
    console.log(`🌐 Port: ${PORT}`);
    console.log(`📍 Local URL: http://localhost:${PORT}`);
    console.log(`📊 Health Check: http://localhost:${PORT}/health`);
    console.log(`🔗 API Base URL: http://localhost:${PORT}/api/v1`);
    console.log(`🔌 Socket.IO: Ready for real-time connections`);
    console.log(`⏱️  Uptime: ${process.uptime().toFixed(2)}s`);
    console.log('========================================\n');
    
    // Log to Winston logger
    if (logger) {
      logger.info(`🚀 Server running in ${NODE_ENV} mode on port ${PORT}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      logger.info(`🔗 API Base URL: http://localhost:${PORT}/api/v1`);
      logger.info(`🔌 Socket.IO ready for real-time connections`);
    }
  });
  
  // ==========================================
  // HANDLE SERVER ERRORS
  // ==========================================
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`\n❌ ERROR: Port ${PORT} is already in use`);
      console.error('Solutions:');
      console.error('1. Stop other server using this port');
      console.error('2. Change PORT in .env file');
      console.error('3. Kill process: netstat -ano | findstr :' + PORT + '\n');
    } else {
      console.error('\n❌ Server Error:', error.message);
    }
    
    if (logger) {
      logger.error('Server error:', error);
    }
    
    process.exit(1);
  });
  
} catch (error) {
  console.error('\n========================================');
  console.error('❌ FATAL ERROR DURING STARTUP');
  console.error('========================================');
  console.error('Error Type:', error.name);
  console.error('Error Message:', error.message);
  console.error('Stack Trace:\n', error.stack);
  console.error('========================================\n');
  
  // Common error solutions
  if (error.message.includes('Cannot find module')) {
    console.error('💡 Solution: Run "npm install" to install missing dependencies\n');
  } else if (error.message.includes('MONGODB_URI')) {
    console.error('💡 Solution: Check your .env file and ensure MONGODB_URI is set\n');
  } else if (error.message.includes('JWT_SECRET')) {
    console.error('💡 Solution: Check your .env file and ensure JWT_SECRET is set\n');
  }
  
  process.exit(1);
}

// ==========================================
// GRACEFUL SHUTDOWN HANDLER
// ==========================================
const gracefulShutdown = (signal) => {
  console.log(`\n\n========================================`);
  console.log(`⚠️  ${signal} RECEIVED`);
  console.log('========================================');
  console.log('Starting graceful shutdown...\n');
  
  if (logger) {
    logger.info(`${signal} received. Starting graceful shutdown...`);
  }
  
  // Stop accepting new connections
  if (server) {
    server.close(() => {
      console.log('✓ HTTP server closed');
      if (logger) logger.info('HTTP server closed');
      
      // Close Socket.IO connections
      if (io) {
        io.close(() => {
          console.log('✓ Socket.IO connections closed');
          if (logger) logger.info('Socket.IO connections closed');
          
          // Close database connection
          const mongoose = require('mongoose');
          mongoose.connection.close(false, () => {
            console.log('✓ MongoDB connection closed');
            if (logger) logger.info('MongoDB connection closed');
            
            console.log('\n========================================');
            console.log('✅ Graceful shutdown completed');
            console.log('========================================\n');
            if (logger) logger.info('Graceful shutdown completed');
            
            process.exit(0);
          });
        });
      } else {
        // If no Socket.IO, just close database
        const mongoose = require('mongoose');
        mongoose.connection.close(false, () => {
          console.log('✓ MongoDB connection closed');
          console.log('✅ Graceful shutdown completed\n');
          process.exit(0);
        });
      }
    });
  } else {
    console.log('⚠️  No server instance found, exiting...\n');
    process.exit(0);
  }
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('\n❌ Forced shutdown after timeout (30s)');
    if (logger) logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

// ==========================================
// PROCESS EVENT HANDLERS
// ==========================================

// SIGTERM - Graceful shutdown signal (from cloud platforms, docker, etc.)
process.on('SIGTERM', () => {
  gracefulShutdown('SIGTERM');
});

// SIGINT - Ctrl+C in terminal
process.on('SIGINT', () => {
  gracefulShutdown('SIGINT');
});

// Uncaught Exception Handler
process.on('uncaughtException', (error) => {
  console.error('\n========================================');
  console.error('❌ UNCAUGHT EXCEPTION');
  console.error('========================================');
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
  console.error('========================================\n');
  
  if (logger) {
    logger.error('Uncaught Exception:', error);
  }
  
  // In production, shut down gracefully
  if (process.env.NODE_ENV === 'production') {
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  } else {
    // In development, just log and continue
    console.log('⚠️  Development mode: Server continues running\n');
  }
});

// Unhandled Promise Rejection Handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('\n========================================');
  console.error('❌ UNHANDLED PROMISE REJECTION');
  console.error('========================================');
  console.error('Reason:', reason);
  console.error('Promise:', promise);
  console.error('========================================\n');
  
  if (logger) {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  }
  
  // In production, shut down gracefully
  if (process.env.NODE_ENV === 'production') {
    gracefulShutdown('UNHANDLED_REJECTION');
  } else {
    // In development, just log and continue
    console.log('⚠️  Development mode: Server continues running\n');
  }
});

// Warning Handler (for deprecation warnings, etc.)
process.on('warning', (warning) => {
  console.warn('\n⚠️  Warning:', warning.name);
  console.warn('Message:', warning.message);
  console.warn('Stack:', warning.stack);
  
  if (logger) {
    logger.warn('Process warning:', warning);
  }
});

// Memory Usage Monitor (every 5 minutes in production)
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    const used = process.memoryUsage();
    const memoryInfo = {
      rss: `${Math.round(used.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(used.external / 1024 / 1024)}MB`,
    };
    
    if (logger) {
      logger.info('Memory Usage:', memoryInfo);
    }
    
    // Warn if memory usage is high (> 500MB)
    if (used.heapUsed > 500 * 1024 * 1024) {
      console.warn('⚠️  High memory usage detected:', memoryInfo);
      if (logger) {
        logger.warn('High memory usage:', memoryInfo);
      }
    }
  }, 5 * 60 * 1000); // Every 5 minutes
}

// ==========================================
// EXPORT FOR TESTING
// ==========================================
module.exports = server;
