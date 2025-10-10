import { startWorker } from './queue.js';
import { logger } from './logger.js';

startWorker();
logger.info('Worker started');
