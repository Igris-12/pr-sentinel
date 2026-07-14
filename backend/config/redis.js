import IORedis from 'ioredis';
import logger from './logger.js';

const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = process.env.REDIS_PORT || 6379;

const connection = new IORedis({
  host: redisHost,
  port: redisPort,
  maxRetriesPerRequest: null, // Required by BullMQ
});

connection.on('error', (err) => {
  logger.error('Redis connection error', { error: err.message });
});

connection.on('connect', () => {
  logger.info(`Connected to Redis at ${redisHost}:${redisPort}`);
});

export default connection;
