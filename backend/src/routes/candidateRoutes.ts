import { Router } from 'express';
import { getCandidates, addCandidate } from '../controllers/candidateController';
import { authenticateToken, requireRole } from '../middleware/authMiddleware';

const router = Router();

// Public routes
router.get('/:electionId', getCandidates);

// Admin-only routes
router.post('/:electionId', authenticateToken, requireRole('admin'), addCandidate);

export default router;
