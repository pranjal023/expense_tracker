import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js'; 
import { createOrder, getStatus } from '../controllers/subscriptionController.js';
const router = Router();



router.post('/create-order', requireAuth, createOrder);
router.get('/status', requireAuth, getStatus);


export default router;
