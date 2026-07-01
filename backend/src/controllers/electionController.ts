import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import prisma from '../config/db';

// Get all elections
export const getElections = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const elections = await prisma.election.findMany({
      include: {
        candidates: true,
      },
      orderBy: {
        startDate: 'desc',
      },
    });
    res.json(elections);
  } catch (error) {
    console.error('Get elections error:', error);
    res.status(500).json({ error: 'Failed to retrieve elections' });
  }
};

// Get election by ID
export const getElectionById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const election = await prisma.election.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        candidates: true,
      },
    });

    if (!election) {
      return res.status(404).json({ error: 'Election not found' });
    }

    res.json(election);
  } catch (error) {
    console.error('Get election by ID error:', error);
    res.status(500).json({ error: 'Failed to retrieve election' });
  }
};

// Create a new election
export const createElection = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id, title, description, startDate, endDate } = req.body;

    if (id === undefined || !title || !description || !startDate || !endDate) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const electionId = parseInt(id, 10);
    const existing = await prisma.election.findUnique({
      where: { id: electionId },
    });

    if (existing) {
      return res.status(400).json({ error: 'Election ID already exists' });
    }

    const election = await prisma.election.create({
      data: {
        id: electionId,
        title,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: 'draft',
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'CREATE_ELECTION',
        details: `Election "${title}" (ID: ${electionId}) created as draft.`,
      },
    });

    res.status(201).json(election);
  } catch (error) {
    console.error('Create election error:', error);
    res.status(500).json({ error: 'Failed to create election' });
  }
};

// Update election details before starting
export const updateElection = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, startDate, endDate, status } = req.body;

    const electionId = parseInt(id, 10);
    const election = await prisma.election.findUnique({
      where: { id: electionId },
    });

    if (!election) {
      return res.status(404).json({ error: 'Election not found' });
    }

    // Only allow updating title/desc/dates if in draft mode
    if (election.status !== 'draft' && (title || description || startDate || endDate)) {
      return res.status(400).json({ error: 'Cannot modify election details once it is active or ended' });
    }

    const updated = await prisma.election.update({
      where: { id: electionId },
      data: {
        title: title || undefined,
        description: description || undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        status: status || undefined,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'UPDATE_ELECTION',
        details: `Election (ID: ${electionId}) updated. Status: ${updated.status}.`,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Update election error:', error);
    res.status(500).json({ error: 'Failed to update election' });
  }
};

// Delete election
export const deleteElection = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const electionId = parseInt(id, 10);

    const election = await prisma.election.findUnique({
      where: { id: electionId },
    });

    if (!election) {
      return res.status(404).json({ error: 'Election not found' });
    }

    if (election.status !== 'draft') {
      return res.status(400).json({ error: 'Can only delete elections in draft status' });
    }

    await prisma.election.delete({
      where: { id: electionId },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'DELETE_ELECTION',
        details: `Election "${election.title}" (ID: ${electionId}) deleted.`,
      },
    });

    res.json({ message: 'Election deleted successfully' });
  } catch (error) {
    console.error('Delete election error:', error);
    res.status(500).json({ error: 'Failed to delete election' });
  }
};
