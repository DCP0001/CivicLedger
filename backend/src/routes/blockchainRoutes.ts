import { Router, Request, Response } from 'express';
import { BlockchainEngine } from '../blockchain/blockchain';
import prisma from '../config/db';

const router = Router();

// Retrieve all blocks with verification status for audit logs
router.get('/blocks', async (req: Request, res: Response) => {
  try {
    const blocks = await prisma.block.findMany({
      orderBy: { index: 'asc' },
      include: { transactions: true },
    });

    const isValid = await BlockchainEngine.validateChain();

    res.json({
      blocks,
      isValid,
      authorityAddress: BlockchainEngine.getAuthorityAddress(),
    });
  } catch (error) {
    console.error('Error fetching blockchain blocks:', error);
    res.status(500).json({ error: 'Failed to retrieve blockchain ledger' });
  }
});

// Check if a voter is whitelisted on-chain for an election
router.get('/is-registered', async (req: Request, res: Response) => {
  try {
    const { electionId, walletAddress } = req.query;

    if (!electionId || !walletAddress) {
      return res.status(400).json({ error: 'electionId and walletAddress are required' });
    }

    const record = await prisma.whitelistedVoter.findUnique({
      where: {
        electionId_walletAddress: {
          electionId: parseInt(electionId as string, 10),
          walletAddress: (walletAddress as string).toLowerCase(),
        },
      },
    });

    res.json({ isRegistered: !!record });
  } catch (error) {
    console.error('Error checking voter registration status:', error);
    res.status(500).json({ error: 'Failed to check on-chain registration' });
  }
});

// Check if a voter has already cast a ballot for an election
router.get('/has-voted', async (req: Request, res: Response) => {
  try {
    const { electionId, walletAddress } = req.query;

    if (!electionId || !walletAddress) {
      return res.status(400).json({ error: 'electionId and walletAddress are required' });
    }

    const record = await prisma.voteReference.findUnique({
      where: {
        electionId_walletAddress: {
          electionId: parseInt(electionId as string, 10),
          walletAddress: (walletAddress as string).toLowerCase(),
        },
      },
    });

    res.json({ hasVoted: !!record });
  } catch (error) {
    console.error('Error checking vote status:', error);
    res.status(500).json({ error: 'Failed to check on-chain voting status' });
  }
});

// Submit a new signed transaction to the blockchain
router.post('/transactions', async (req: Request, res: Response) => {
  try {
    const { type, sender, payload, signature } = req.body;

    if (!type || !sender || !payload || !signature) {
      return res.status(400).json({ error: 'type, sender, payload, and signature are required' });
    }

    const tx = await BlockchainEngine.submitTransaction(type, sender, payload, signature);
    res.status(201).json({ success: true, transaction: tx });
  } catch (error: any) {
    console.error('Error submitting transaction:', error);
    res.status(400).json({ error: error.message || 'Failed to submit transaction to blockchain' });
  }
});

export default router;
