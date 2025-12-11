/**
 * MongoDB Database Configuration
 * Handles connection, pooling, events, and health checks
 * @version 1.0.0
 */

const mongoose = require('mongoose');

// Will be initialized after logger is created
let logger;

/**
 * Initialize database connection with retry logic
 * @returns {Promise<void>}
 */
const connectDB = async () => {
  try {
    // Lazy load logger to avoid circular dependency
    if (!logger) {
      logger = require('./logger');
    }

    // Mongoose configuration
    mongoose.set('strictQuery', false);
    mongoose.set('debug', process.env.NODE_ENV === 'development');

    // Connection options
    const options = {
      // Connection pool settings
      maxPoolSize: process.env.NODE_ENV === 'production' 
        ? parseInt(process.env.DB_POOL_SIZE) || 50 
        : 10,
      minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE) || 5,
      
      // Timeout settings
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      
      // Retry settings
      retryWrites: true,
      retryReads: true,
      
      // Network settings
      family: 4, // Use IPv4, skip trying IPv6
      
      // Compression
      compressors: process.env.NODE_ENV === 'production' ? ['zlib'] : undefined,
      
      // Auto index (disable in production for performance)
      autoIndex: process.env.NODE_ENV !== 'production',
      
      // Auth (if credentials in URI)
      authSource: 'admin',
    };

    // Connect to MongoDB
    const conn = await mongoose.connect(process.env.MONGODB_URI, options);

    logger.info('✅ MongoDB Connected Successfully');
    logger.info(`📍 Host: ${conn.connection.host}`);
    logger.info(`🗄️  Database: ${conn.connection.name}`);
    logger.info(`🔗 Pool Size: ${options.maxPoolSize}`);
    logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);

    // Setup connection event handlers
    setupConnectionHandlers();

    // Create indexes if in development
    if (process.env.NODE_ENV === 'development') {
      await ensureIndexes();
    }

  } catch (error) {
    if (logger) {
      logger.error('❌ Database connection failed:', error.message);
      logger.error('Stack:', error.stack);
    } else {
      console.error('❌ Database connection failed:', error.message);
    }

    // Retry connection after delay
    logger?.info('⏳ Retrying connection in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
};

/**
 * Setup MongoDB connection event handlers
 */
const setupConnectionHandlers = () => {
  // Connection error handler
  mongoose.connection.on('error', (err) => {
    logger.error('❌ MongoDB connection error:', err);
  });

  // Disconnection handler
  mongoose.connection.on('disconnected', () => {
    logger.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
  });

  // Reconnection handler
  mongoose.connection.on('reconnected', () => {
    logger.info('✅ MongoDB reconnected successfully');
  });

  // Connection state changes
  mongoose.connection.on('connecting', () => {
    logger.info('🔄 Connecting to MongoDB...');
  });

  mongoose.connection.on('connected', () => {
    logger.info('🔗 MongoDB connection established');
  });

  // Index build events (production)
  if (process.env.NODE_ENV === 'production') {
    mongoose.connection.on('index', (indexInfo) => {
      logger.info('📇 Index created:', indexInfo);
    });
  }

  // Monitor slow queries in development
  if (process.env.NODE_ENV === 'development') {
    mongoose.set('debug', (collectionName, method, query, doc) => {
      logger.debug(`MongoDB Query: ${collectionName}.${method}`, {
        query: JSON.stringify(query),
        doc: doc ? JSON.stringify(doc) : undefined,
      });
    });
  }
};

/**
 * Ensure all indexes are created (development only)
 */
const ensureIndexes = async () => {
  try {
    logger.info('🔍 Checking indexes...');
    
    const collections = Object.keys(mongoose.connection.collections);
    
    for (const collectionName of collections) {
      const collection = mongoose.connection.collections[collectionName];
      await collection.createIndexes();
    }
    
    logger.info(`✅ Indexes ensured for ${collections.length} collections`);
  } catch (error) {
    logger.error('❌ Error ensuring indexes:', error.message);
  }
};

/**
 * Get database health status
 * @returns {Object} Health status object
 */
const getDBHealth = () => {
  const state = mongoose.connection.readyState;
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  return {
    status: states[state] || 'unknown',
    state: state,
    host: mongoose.connection.host || 'N/A',
    name: mongoose.connection.name || 'N/A',
    port: mongoose.connection.port || 'N/A',
    collections: mongoose.connection.collections 
      ? Object.keys(mongoose.connection.collections).length 
      : 0,
    models: Object.keys(mongoose.models).length,
  };
};

/**
 * Get database statistics
 * @returns {Promise<Object>} Database statistics
 */
const getDBStats = async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return { error: 'Database not connected' };
    }

    const db = mongoose.connection.db;
    const stats = await db.stats();

    return {
      database: db.databaseName,
      collections: stats.collections,
      dataSize: formatBytes(stats.dataSize),
      storageSize: formatBytes(stats.storageSize),
      indexes: stats.indexes,
      indexSize: formatBytes(stats.indexSize),
      avgObjSize: formatBytes(stats.avgObjSize),
      documents: stats.objects,
    };
  } catch (error) {
    logger.error('Error getting database stats:', error.message);
    return { error: error.message };
  }
};

/**
 * Close database connection gracefully
 * @returns {Promise<void>}
 */
const closeDB = async () => {
  try {
    await mongoose.connection.close();
    logger.info('✅ MongoDB connection closed gracefully');
  } catch (error) {
    logger.error('❌ Error closing MongoDB connection:', error.message);
    throw error;
  }
};

/**
 * Drop database (use with extreme caution!)
 * Only works in development/test environments
 * @returns {Promise<void>}
 */
const dropDB = async () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cannot drop database in production environment');
  }

  try {
    await mongoose.connection.dropDatabase();
    logger.warn('⚠️  Database dropped successfully');
  } catch (error) {
    logger.error('❌ Error dropping database:', error.message);
    throw error;
  }
};

/**
 * Clear all collections (use with extreme caution!)
 * Only works in development/test environments
 * @returns {Promise<void>}
 */
const clearDB = async () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cannot clear database in production environment');
  }

  try {
    const collections = Object.keys(mongoose.connection.collections);
    
    for (const collectionName of collections) {
      const collection = mongoose.connection.collections[collectionName];
      await collection.deleteMany({});
    }
    
    logger.warn(`⚠️  Cleared ${collections.length} collections`);
  } catch (error) {
    logger.error('❌ Error clearing database:', error.message);
    throw error;
  }
};

/**
 * Format bytes to human-readable format
 * @param {number} bytes - Bytes to format
 * @returns {string} Formatted string
 */
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Check if database is connected
 * @returns {boolean} Connection status
 */
const isConnected = () => {
  return mongoose.connection.readyState === 1;
};

/**
 * Wait for database connection
 * @param {number} timeout - Timeout in milliseconds (default: 30000)
 * @returns {Promise<boolean>} Connection success
 */
const waitForConnection = (timeout = 30000) => {
  return new Promise((resolve, reject) => {
    if (isConnected()) {
      return resolve(true);
    }

    const timer = setTimeout(() => {
      reject(new Error('Database connection timeout'));
    }, timeout);

    mongoose.connection.once('connected', () => {
      clearTimeout(timer);
      resolve(true);
    });

    mongoose.connection.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
};

/**
 * Handle process termination
 */
process.on('SIGINT', async () => {
  try {
    await closeDB();
    logger.info('MongoDB connection closed through app termination');
    process.exit(0);
  } catch (error) {
    logger.error('Error during SIGINT shutdown:', error.message);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  try {
    await closeDB();
    logger.info('MongoDB connection closed through SIGTERM');
    process.exit(0);
  } catch (error) {
    logger.error('Error during SIGTERM shutdown:', error.message);
    process.exit(1);
  }
});

// ==========================================
// EXPORTS
// ==========================================
module.exports = {
  connectDB,
  closeDB,
  getDBHealth,
  getDBStats,
  isConnected,
  waitForConnection,
  dropDB,        // Development only
  clearDB,       // Development only
};
