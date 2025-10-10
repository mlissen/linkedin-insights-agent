import { Router } from 'express';
import { supabaseAuth } from '../middleware/auth.js';
import {
  ensureUserRecord,
  validateRunConfig,
  checkRunLimit,
  incrementRunUsage,
  createRun,
  listRuns,
  getRun,
} from '../services/run-service.js';
import { logger } from '../logger.js';

export const runsRouter = Router();

runsRouter.use(supabaseAuth);

runsRouter.post('/', async (req, res) => {
  try {
    const auth = req.auth!;
    const userId = await ensureUserRecord(auth);
    await checkRunLimit(userId);
    const config = await validateRunConfig(req.body);
    const run = await createRun(userId, config);
    await incrementRunUsage(userId);
    res.status(201).json({ run });
  } catch (error: any) {
    logger.error({ error }, 'Failed to create run');
    if (error.message === 'Run limit reached') {
      res.status(429).json({ error: error.message });
    } else if (error.message === 'You can analyze up to 10 experts per run') {
      res.status(400).json({ error: error.message });
    } else if (error?.issues) {
      res.status(400).json({ error: 'Invalid run configuration', details: error.issues });
    } else {
      res.status(500).json({ error: 'Unexpected error' });
    }
  }
});

runsRouter.get('/', async (req, res) => {
  try {
    const userId = await ensureUserRecord(req.auth!);
    const runs = await listRuns(userId);
    res.json({ runs });
  } catch (error) {
    logger.error({ error }, 'Failed to list runs');
    res.status(500).json({ error: 'Unexpected error' });
  }
});

runsRouter.get('/:runId', async (req, res) => {
  try {
    const userId = await ensureUserRecord(req.auth!);
    const run = await getRun(userId, req.params.runId);
    res.json({ run });
  } catch (error: any) {
    logger.error({ error }, 'Failed to fetch run');
    if (error?.code === 'PGRST116') {
      res.status(404).json({ error: 'Run not found' });
    } else {
      res.status(500).json({ error: 'Unexpected error' });
    }
  }
});
