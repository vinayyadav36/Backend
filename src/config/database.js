const path = require('path');
const fs = require('fs');

let logger;

const connectDB = async () => {
  if (process.env.USE_JSON_DB === 'true') {
    const dataDir = path.resolve(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const backupsDir = path.join(dataDir, 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    if (!logger) logger = require('./logger');
    logger.info('JSON NoSQL mode — data directory ready');
    return;
  }

  try {
    if (!logger) logger = require('./logger');

    const mongoose = require('mongoose');

    mongoose.set('strictQuery', false);
    mongoose.set('debug', process.env.NODE_ENV === 'development');

    const options = {
      maxPoolSize: process.env.NODE_ENV === 'production'
        ? parseInt(process.env.DB_POOL_SIZE) || 50
        : 10,
      minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE) || 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      retryWrites: true,
      retryReads: true,
      family: 4,
      compressors: process.env.NODE_ENV === 'production' ? ['zlib'] : undefined,
      autoIndex: process.env.NODE_ENV !== 'production',
      authSource: 'admin',
    };

    const conn = await mongoose.connect(process.env.MONGODB_URI, options);

    logger.info('MongoDB Connected Successfully');
    logger.info(`Host: ${conn.connection.host}`);
    logger.info(`Database: ${conn.connection.name}`);
    logger.info(`Pool Size: ${options.maxPoolSize}`);

    setupConnectionHandlers();

    if (process.env.NODE_ENV === 'development') {
      await ensureIndexes();
    }
  } catch (error) {
    if (logger) {
      logger.error('Database connection failed:', error.message);
    } else {
      console.error('Database connection failed:', error.message); // eslint-disable-line no-console
    }

    logger?.info('Retrying connection in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
};

const setupConnectionHandlers = () => {
  if (process.env.USE_JSON_DB === 'true') return;
  const mongoose = require('mongoose');

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected. Attempting to reconnect...');
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected successfully');
  });

  mongoose.connection.on('connecting', () => {
    logger.info('Connecting to MongoDB...');
  });

  mongoose.connection.on('connected', () => {
    logger.info('MongoDB connection established');
  });
};

const ensureIndexes = async () => {
  if (process.env.USE_JSON_DB === 'true') return;
  try {
    const mongoose = require('mongoose');
    logger.info('Checking indexes...');
    const collections = Object.keys(mongoose.connection.collections);
    for (const collectionName of collections) {
      const collection = mongoose.connection.collections[collectionName];
      await collection.createIndexes();
    }
    logger.info(`Indexes ensured for ${collections.length} collections`);
  } catch (error) {
    logger.error('Error ensuring indexes:', error.message);
  }
};

const getDBHealth = () => {
  if (process.env.USE_JSON_DB === 'true') {
    const dataDir = path.resolve(__dirname, '../../data');
    const files = fs.existsSync(dataDir) ? fs.readdirSync(dataDir).filter(f => f.endsWith('.json')) : [];
    return {
      status: 'connected',
      mode: 'json_nosql',
      collections: files.length,
      dataDirectory: dataDir,
    };
  }

  const mongoose = require('mongoose');
  const state = mongoose.connection.readyState;
  const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

  return {
    status: states[state] || 'unknown',
    state,
    host: mongoose.connection.host || 'N/A',
    name: mongoose.connection.name || 'N/A',
    mode: 'mongodb',
  };
};

const getDBStats = async () => {
  if (process.env.USE_JSON_DB === 'true') {
    const dataDir = path.resolve(__dirname, '../../data');
    const files = fs.existsSync(dataDir) ? fs.readdirSync(dataDir).filter(f => f.endsWith('.json')) : [];
    let totalSize = 0;
    const collections = files.map(f => {
      const fp = path.join(dataDir, f);
      const stat = fs.statSync(fp);
      totalSize += stat.size;
      return { name: f.replace('.json', ''), size: stat.size, sizeKB: (stat.size / 1024).toFixed(1) };
    });
    return { mode: 'json_nosql', collections, totalSizeKB: (totalSize / 1024).toFixed(1) };
  }

  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) return { error: 'Database not connected' };
    const db = mongoose.connection.db;
    const stats = await db.stats();
    return {
      mode: 'mongodb',
      database: db.databaseName,
      collections: stats.collections,
      dataSize: formatBytes(stats.dataSize),
      storageSize: formatBytes(stats.storageSize),
      indexes: stats.indexes,
      documents: stats.objects,
    };
  } catch (error) {
    logger.error('Error getting database stats:', error.message);
    return { error: error.message };
  }
};

const closeDB = async () => {
  if (process.env.USE_JSON_DB === 'true') {
    logger.info('JSON NoSQL — no connection to close');
    return;
  }
  try {
    const mongoose = require('mongoose');
    await mongoose.connection.close();
    logger.info('MongoDB connection closed gracefully');
  } catch (error) {
    logger.error('Error closing MongoDB connection:', error.message);
    throw error;
  }
};

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

const isConnected = () => {
  if (process.env.USE_JSON_DB === 'true') return true;
  const mongoose = require('mongoose');
  return mongoose.connection.readyState === 1;
};

module.exports = {
  connectDB,
  closeDB,
  getDBHealth,
  getDBStats,
  isConnected,
};
