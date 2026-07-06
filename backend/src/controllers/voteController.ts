import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import prisma from '../config/db';

// Log vote reference (transaction hash)
export const logVoteReference = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { electionId, transactionHash } = req.body;

    if (electionId === undefined || !transactionHash) {
      return res.status(400).json({ error: 'Election ID and transaction hash are required' });
    }

    const parsedElectionId = parseInt(electionId, 10);
    const walletAddress = req.user!.walletAddress.toLowerCase();

    // Check if election exists
    const election = await prisma.election.findUnique({
      where: { id: parsedElectionId },
    });

    if (!election) {
      return res.status(404).json({ error: 'Election not found' });
    }

    // Verify voter didn't already log a vote for this election
    const existing = await prisma.voteReference.findUnique({
      where: {
        electionId_walletAddress: {
          electionId: parsedElectionId,
          walletAddress,
        },
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Vote already recorded for this election' });
    }

    const voteRef = await prisma.voteReference.create({
      data: {
        electionId: parsedElectionId,
        walletAddress,
        transactionHash: transactionHash.toLowerCase(),
      },
    });

    res.status(201).json(voteRef);
  } catch (error) {
    console.error('Log vote reference error:', error);
    res.status(500).json({ error: 'Failed to log vote transaction reference' });
  }
};

// Verify transaction by hash
export const getTransactionDetails = async (req: Request, res: Response) => {
  try {
    const { hash } = req.params;

    if (!hash) {
      return res.status(400).json({ error: 'Transaction hash is required' });
    }

    const tx = await prisma.transaction.findUnique({
      where: { id: hash.toLowerCase() },
      include: {
        block: true,
      },
    });

    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found in blockchain ledger' });
    }

    const payload = JSON.parse(tx.payload);
    const electionId = payload.electionId;

    const election = await prisma.election.findUnique({
      where: { id: electionId },
      select: {
        title: true,
        status: true,
      },
    });

    res.json({
      id: tx.id,
      electionId,
      walletAddress: tx.sender,
      transactionHash: tx.id,
      timestamp: tx.timestamp,
      signature: tx.signature,
      blockIndex: tx.blockIndex,
      block: tx.block,
      election: election || { title: 'Unknown Election', status: 'unknown' },
    });
  } catch (error) {
    console.error('Verify transaction error:', error);
    res.status(500).json({ error: 'Failed to retrieve transaction reference' });
  }
};

// Get transaction references for an election
export const getElectionVoteReferences = async (req: Request, res: Response) => {
  try {
    const { electionId } = req.params;

    const voteRefs = await prisma.voteReference.findMany({
      where: { electionId: parseInt(electionId, 10) },
      orderBy: { timestamp: 'desc' },
    });

    res.json(voteRefs);
  } catch (error) {
    console.error('Get election references error:', error);
    res.status(500).json({ error: 'Failed to retrieve vote references' });
  }
};
