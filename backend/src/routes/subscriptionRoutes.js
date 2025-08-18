import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { createOrder, getStatus } from '../controllers/subscriptionController.js';
const router = Router();

router.post('/create-order', auth, createOrder);
router.get('/status', getStatus);

export default router;
