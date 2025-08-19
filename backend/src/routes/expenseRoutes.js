import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { listExpenses, createExpense, updateExpense, deleteExpense } from '../controllers/expenseController.js';
const router = Router();

router.get('/', requireAuth, listExpenses);           
router.post('/', requireAuth, createExpense);
router.put('/:id', requireAuth, updateExpense);
router.delete('/:id', requireAuth, deleteExpense);

export default router;
