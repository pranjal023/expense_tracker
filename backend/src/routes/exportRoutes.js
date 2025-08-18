import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { exportCsv } from '../controllers/exportController.js';
const router = Router();

router.get('/csv', auth, exportCsv);

export default router;
