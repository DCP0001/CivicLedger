import { Router } from 'express';
import { getElections, getElectionById, createElection, updateElection, deleteElection } from '../controllers/electionController';
import { authenticateToken, requireRole } from '../middleware/authMiddleware';

const router = Router();

// Public routes
router.get('/', getElections);
router.get('/:id', getElectionById);

// Admin-only routes
router.post('/', authenticateToken, requireRole('admin'), createElection);
router.put('/:id', authenticateToken, requireRole('admin'), updateElection);
router.delete('/:id', authenticateToken, requireRole('admin'), deleteElection);

export default router;
