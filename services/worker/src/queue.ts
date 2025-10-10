import { Worker, type Job } from 'bullmq';
import { config } from './config.js';
import { logger } from './logger.js';
import { processRunJob, type RunJobData } from './run-processor.js';

export function startWorker() {
  const worker = new Worker<RunJobData>(
    'insight-runs',
    async (job: Job<RunJobData>) => {
      logger.info({ runId: job.data.runId }, 'Processing run job');
      await processRunJob(job.data, job);
    },
    {
      connection: { url: config.queueRedisUrl },
      lockDuration: config.maxRunMinutes * 60 * 1000,
      removeOnComplete: true,
      removeOnFail: 500,
    },
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Run job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Run job failed');
  });

  return worker;
}
