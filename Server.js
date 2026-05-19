require('dotenv').config();

console.log('========================================');
console.log('  JARVIS BACKEND — The Father of Every Backend');
console.log('========================================');
console.log(`  Started at: ${new Date().toLocaleString()}`);
console.log(`  Node Version: ${process.version}`);
console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`  Storage Mode: ${process.env.USE_JSON_DB === 'true' ? 'JSON NoSQL (local)' : 'MongoDB'}`);
console.log('========================================\n');

let server, io, logger;

try {
  console.log('Loading application modules...');

  const appModule = require('./src/app');
  server = appModule.server;
  io = appModule.io;
  console.log('✓ Express app and Socket.IO loaded');

  const { connectDB } = require('./src/config/database');
  console.log('✓ Database module loaded');

  logger = require('./src/config/logger');
  console.log('✓ Logger module loaded\n');

  // Ensure Master Admin identity exists
  try {
    const { ensureMasterAdmin } = require('./src/middlewares/masterAdmin');
    ensureMasterAdmin();
    console.log('✓ Master Admin identity ready');
  } catch (e) {
    console.log('✓ Master Admin: ' + e.message);
  }

  // Connect to database (JSON DB doesn't need connection, just ensures data dir)
  if (process.env.USE_JSON_DB !== 'true') {
    console.log('Connecting to MongoDB...');
    connectDB().catch(err => {
      console.error('Database connection failed:', err.message);
      if (process.env.NODE_ENV === 'production') process.exit(1);
    });
  } else {
    console.log('✓ JSON NoSQL mode — no external database required\n');
  }

  const PORT = process.env.PORT || 5000;
  const NODE_ENV = process.env.NODE_ENV || 'development';

  server.listen(PORT, () => {
    console.log('\n========================================');
    console.log('  JARVIS BACKEND STARTED SUCCESSFULLY');
    console.log('========================================');
    console.log(`  Environment: ${NODE_ENV}`);
    console.log(`  Port: ${PORT}`);
    console.log(`  Storage: ${process.env.USE_JSON_DB === 'true' ? 'JSON NoSQL' : 'MongoDB'}`);
    console.log(`  URL: http://localhost:${PORT}`);
    console.log(`  Health: http://localhost:${PORT}/health`);
    console.log(`  API: http://localhost:${PORT}/api/v1`);
    console.log(`  Socket.IO: Ready`);
    console.log(`  Uptime: ${process.uptime().toFixed(2)}s`);
    console.log('========================================\n');

    if (logger) {
      logger.info(`Server running in ${NODE_ENV} mode on port ${PORT}`);
      logger.info(`Storage mode: ${process.env.USE_JSON_DB === 'true' ? 'JSON NoSQL' : 'MongoDB'}`);
    }
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`\nERROR: Port ${PORT} is already in use`);
      process.exit(1);
    } else {
      console.error('\nServer Error:', error.message);
    }
    if (logger) logger.error('Server error:', error);
    process.exit(1);
  });

} catch (error) {
  console.error('\n========================================');
  console.error('FATAL ERROR DURING STARTUP');
  console.error('========================================');
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
  console.error('========================================\n');

  if (error.message.includes('Cannot find module')) {
    console.error('Run "npm install" to install missing dependencies\n');
  }

  process.exit(1);
}

const gracefulShutdown = (signal) => {
  console.log(`\n\n${signal} RECEIVED — Starting graceful shutdown...\n`);

  if (logger) logger.info(`${signal} received. Starting graceful shutdown...`);

  if (server) {
    server.close(() => {
      console.log('✓ HTTP server closed');
      if (logger) logger.info('HTTP server closed');

      if (io) {
        io.close(() => {
          console.log('✓ Socket.IO connections closed');
          if (logger) logger.info('Socket.IO connections closed');
          shutdownDB();
        });
      } else {
        shutdownDB();
      }
    });
  } else {
    console.log('No server instance found, exiting...');
    process.exit(0);
  }

  setTimeout(() => {
    console.error('Forced shutdown after timeout (30s)');
    process.exit(1);
  }, 30000);
};

function shutdownDB() {
  if (process.env.USE_JSON_DB !== 'true') {
    try {
      const mongoose = require('mongoose');
      mongoose.connection.close(false, () => {
        console.log('✓ MongoDB connection closed');
        console.log('✓ Graceful shutdown completed\n');
        process.exit(0);
      });
    } catch (_) {
      process.exit(0);
    }
  } else {
    console.log('✓ JSON NoSQL — no connection to close');
    console.log('✓ Graceful shutdown completed\n');
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION:', error.message);
  console.error(error.stack);
  if (logger) logger.error('Uncaught Exception:', error);
  if (process.env.NODE_ENV === 'production') gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED PROMISE REJECTION:', reason);
  if (logger) logger.error('Unhandled Rejection:', reason);
  if (process.env.NODE_ENV === 'production') gracefulShutdown('UNHANDLED_REJECTION');
});

process.on('warning', (warning) => {
  console.warn('Warning:', warning.name, warning.message);
  if (logger) logger.warn('Process warning:', warning);
});

if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    const used = process.memoryUsage();
    const memInfo = {
      rss: `${Math.round(used.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)}MB`,
    };
    if (logger) logger.info('Memory Usage:', memInfo);
    if (used.heapUsed > 500 * 1024 * 1024) {
      console.warn('High memory usage detected:', memInfo);
      if (logger) logger.warn('High memory usage:', memInfo);
    }
  }, 5 * 60 * 1000);
}

module.exports = server;
