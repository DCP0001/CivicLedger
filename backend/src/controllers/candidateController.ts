import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import prisma from '../config/db';

// Get candidates for an election
export const getCandidates = async (req: Request, res: Response) => {
  try {
    const { electionId } = req.params;
    const candidates = await prisma.candidate.findMany({
      where: { electionId: parseInt(electionId, 10) },
    });
    res.json(candidates);
  } catch (error) {
    console.error('Get candidates error:', error);
    res.status(500).json({ error: 'Failed to retrieve candidates' });
  }
};

// Add candidate (Admin only)
export const addCandidate = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { electionId } = req.params;
    const { id, name, party, imageUrl, description } = req.body;

    if (id === undefined || !name || !party || !description) {
      return res.status(400).json({ error: 'ID, name, party, and description are required' });
    }

    const parsedElectionId = parseInt(electionId, 10);
    const candidateId = parseInt(id, 10);

    const election = await prisma.election.findUnique({
      where: { id: parsedElectionId },
    });

    if (!election) {
      return res.status(404).json({ error: 'Election not found' });
    }

    if (election.status !== 'draft') {
      return res.status(400).json({ error: 'Cannot add candidates to an active or completed election' });
    }

    const existing = await prisma.candidate.findUnique({
      where: {
        electionId_id: {
          electionId: parsedElectionId,
          id: candidateId,
        },
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Candidate ID already exists for this election' });
    }

    // Default placeholder gradient if no image URL is provided
    const finalImageUrl = imageUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=b6e3f4,c0aede,d1c4e9`;

    const candidate = await prisma.candidate.create({
      data: {
        id: candidateId,
        electionId: parsedElectionId,
        name,
        party,
        imageUrl: finalImageUrl,
        description,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'ADD_CANDIDATE',
        details: `Candidate "${name}" (ID: ${candidateId}) added to election (ID: ${parsedElectionId}).`,
      },
    });

    res.status(201).json(candidate);
  } catch (error) {
    console.error('Add candidate error:', error);
    res.status(500).json({ error: 'Failed to add candidate' });
  }
};
