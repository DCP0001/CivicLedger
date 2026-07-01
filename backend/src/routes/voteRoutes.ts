import { Router } from 'express';
import { logVoteReference, getTransactionDetails, getElectionVoteReferences } from '../controllers/voteController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// Log vote transaction reference (authenticated voter only)
router.post('/', authenticateToken, logVoteReference);

// Public verification routes
router.get('/transaction/:hash', getTransactionDetails);
router.get('/election/:electionId', getElectionVoteReferences);

export default router;
