import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { runsRouter } from './routes/runs.js';
import { usageRouter } from './routes/usage.js';
import { logger } from './logger.js';

const app = express();
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/runs', runsRouter);
app.use('/usage', usageRouter);

app.listen(config.port, () => {
  logger.info({ port: config.port }, 'API server listening');
});
