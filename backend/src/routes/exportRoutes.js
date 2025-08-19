import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { exportCsv } from '../controllers/exportController.js';
const router = Router();

router.get('/csv', requireAuth, exportCsv);

export default router;
