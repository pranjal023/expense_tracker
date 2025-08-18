import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { listExpenses, createExpense, updateExpense, deleteExpense } from '../controllers/expenseController.js';
const router = Router();

router.get('/', auth, listExpenses);           
router.post('/', auth, createExpense);
router.put('/:id', auth, updateExpense);
router.delete('/:id', auth, deleteExpense);

export default router;
