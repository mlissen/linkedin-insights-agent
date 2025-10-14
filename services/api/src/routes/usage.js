import { Router } from 'express';
import { supabaseAuth } from '../middleware/auth.js';
import { ensureUserRecord } from '../services/run-service.js';
import { getSupabase } from '../supabase.js';
import { config } from '../config.js';
export const usageRouter = Router();
usageRouter.use(supabaseAuth);
function currentPeriodStart() {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
}
usageRouter.get('/', async (req, res) => {
    const userId = await ensureUserRecord(req.auth);
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('usage_counters')
        .select('runs_used, tokens_used')
        .eq('user_id', userId)
        .eq('period_start', currentPeriodStart())
        .single();
    if (error && error.code !== 'PGRST116') {
        return res.status(500).json({ error: 'Failed to fetch usage' });
    }
    const runsUsed = data?.runs_used ?? 0;
    const tokensUsed = data?.tokens_used ?? 0;
    res.json({
        runsUsed,
        runsRemaining: Math.max(config.runLimit - runsUsed, 0),
        tokensUsed,
        tokenCostEstimate: Number(((tokensUsed / 1000000) * config.costPerMillionTokens).toFixed(4)),
    });
});
