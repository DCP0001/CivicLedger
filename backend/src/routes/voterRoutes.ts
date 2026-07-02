import { Router } from 'express';
import {
  registerVoter,
  checkVoterRegistration,
  getVoters,
  getPendingVoters,
  verifyVoter,
  registerVoterPublic,
  deleteVoter,
} from '../controllers/voterController';
import { authenticateToken, requireRole } from '../middleware/authMiddleware';

const router = Router();

// Public route to check registration status
router.get('/check/:walletAddress', checkVoterRegistration);

// Public route to register voter self-account
router.post('/register', registerVoterPublic);

// Admin-only routes
router.post('/', authenticateToken, requireRole('admin'), registerVoter);
router.get('/', authenticateToken, requireRole('admin'), getVoters);
router.get('/pending', authenticateToken, requireRole('admin'), getPendingVoters);
router.patch('/:id/verify', authenticateToken, requireRole('admin'), verifyVoter);
router.delete('/:id', authenticateToken, requireRole('admin'), deleteVoter);

export default router;
