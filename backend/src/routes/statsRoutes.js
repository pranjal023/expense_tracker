import { Router } from 'express';
import { leaderboard } from '../controllers/statsController.js';
import { requirePremium } from '../middleware/premium.js';
const router = Router();

router.get('/leaderboard', leaderboard);
router.get('/leaderboard',  requirePremium, leaderboard);
export default router;
