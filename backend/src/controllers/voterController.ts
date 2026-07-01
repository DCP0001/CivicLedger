import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import prisma from '../config/db';

// Register voter (Admin only)
export const registerVoter = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, email, walletAddress } = req.body;

    if (!name || !email || !walletAddress) {
      return res.status(400).json({ error: 'Name, email, and wallet address are required' });
    }

    const normalizedEmail = email.toLowerCase();
    const normalizedWallet = walletAddress.toLowerCase();

    // Check if user already exists
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          { walletAddress: normalizedWallet },
        ],
      },
    });

    if (existing) {
      return res.status(400).json({
        error: existing.email === normalizedEmail 
          ? 'Email already registered' 
          : 'Wallet address already registered',
      });
    }

    const voter = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        walletAddress: normalizedWallet,
        role: 'voter',
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'REGISTER_VOTER',
        details: `Registered voter "${name}" with wallet ${normalizedWallet}.`,
      },
    });

    res.status(201).json(voter);
  } catch (error) {
    console.error('Register voter error:', error);
    res.status(500).json({ error: 'Failed to register voter' });
  }
};

// Check voter registration status
export const checkVoterRegistration = async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;

    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }

    const user = await prisma.user.findFirst({
      where: {
        walletAddress: walletAddress.toLowerCase(),
      },
    });

    if (!user) {
      return res.json({ registered: false });
    }

    res.json({
      registered: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        walletAddress: user.walletAddress,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Check voter registration error:', error);
    res.status(500).json({ error: 'Failed to check registration status' });
  }
};

// Get registered voters list (Admin only)
export const getVoters = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const voters = await prisma.user.findMany({
      where: { role: 'voter' },
      orderBy: { createdAt: 'desc' },
    });
    res.json(voters);
  } catch (error) {
    console.error('Get voters list error:', error);
    res.status(500).json({ error: 'Failed to retrieve voters' });
  }
};

// Public voter self-registration
export const registerVoterPublic = async (req: Request, res: Response) => {
  try {
    const { name, email, walletAddress } = req.body;

    if (!name || !email || !walletAddress) {
      return res.status(400).json({ error: 'Name, email, and wallet address are required' });
    }

    const normalizedEmail = email.toLowerCase();
    const normalizedWallet = walletAddress.toLowerCase();

    // Check if user already exists
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          { walletAddress: normalizedWallet },
        ],
      },
    });

    if (existing) {
      return res.status(400).json({
        error: existing.email === normalizedEmail 
          ? 'Email already registered' 
          : 'Wallet address already registered',
      });
    }

    const voter = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        walletAddress: normalizedWallet,
        role: 'voter',
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: voter.id,
        action: 'PUBLIC_SELF_REGISTER_VOTER',
        details: `Voter "${name}" self-registered with wallet ${normalizedWallet}.`,
      },
    });

    res.status(201).json(voter);
  } catch (error) {
    console.error('Public register voter error:', error);
    res.status(500).json({ error: 'Failed to self-register voter' });
  }
};

// Delete voter account (Admin only)
export const deleteVoter = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({ error: 'Voter not found' });
    }

    if (user.role === 'admin') {
      return res.status(400).json({ error: 'Cannot delete an administrator account' });
    }

    await prisma.user.delete({
      where: { id },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'DELETE_VOTER',
        details: `Deleted voter account "${user.name}" with wallet ${user.walletAddress}.`,
      },
    });

    res.json({ message: 'Voter account deleted successfully' });
  } catch (error) {
    console.error('Delete voter error:', error);
    res.status(500).json({ error: 'Failed to delete voter account' });
  }
};
