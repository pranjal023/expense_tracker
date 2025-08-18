import { Router } from 'express';
import { signup, login, forgotPassword, resetPassword ,me} from '../controllers/authController.js';
const router = Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/forgot', forgotPassword);
router.post('/reset', resetPassword);
router.get('/me',  me); 

export default router;
