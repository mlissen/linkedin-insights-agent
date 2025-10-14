import { Queue } from 'bullmq';
import { config } from './config.js';
export const runQueue = new Queue('insight-runs', {
    connection: { url: config.queueRedisUrl },
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: 500,
    },
});
