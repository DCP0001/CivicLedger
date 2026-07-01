import { Router } from 'express';
import { adminLogin, voterLogin } from '../controllers/authController';

const router = Router();

router.post('/login/admin', adminLogin);
router.post('/login/voter', voterLogin);

export default router;
