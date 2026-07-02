import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { recoverMessageAddress } from 'viem';
import prisma from '../config/db';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey12345!votingplatform';

// Admin Login
export const adminLogin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        role: 'admin',
      },
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, walletAddress: user.walletAddress },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        walletAddress: user.walletAddress,
      },
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Voter Login (Wallet Signature Verification)
export const voterLogin = async (req: Request, res: Response) => {
  try {
    const { walletAddress, signature, message } = req.body;

    if (!walletAddress || !signature || !message) {
      return res.status(400).json({ error: 'Wallet address, signature, and message are required' });
    }

    // 1. Verify that the message includes the correct timestamp and is not expired (5 minutes max age)
    const timestampMatch = message.match(/Timestamp:\s*(\d+)/);
    if (!timestampMatch) {
      return res.status(400).json({ error: 'Invalid authentication message format' });
    }

    const timestamp = parseInt(timestampMatch[1], 10);
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (Math.abs(now - timestamp) > fiveMinutes) {
      return res.status(400).json({ error: 'Authentication challenge expired. Please sign a new message.' });
    }

    // 2. Recover the signer address using viem
    let recoveredAddress: string;
    try {
      recoveredAddress = await recoverMessageAddress({
        message: message,
        signature: signature,
      });
    } catch (err: any) {
      return res.status(400).json({ error: 'Signature verification failed: ' + err.message });
    }

    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(401).json({ error: 'Signature recovered address does not match provided wallet address' });
    }

    // 3. Verify that the voter is registered in the database
    const user = await prisma.user.findFirst({
      where: {
        walletAddress: walletAddress.toLowerCase(),
      },
    });

    if (!user) {
      return res.status(403).json({ error: 'This wallet address is not registered as a voter. Please contact the administrator.' });
    }

    // 4. Create JWT token
    const token = jwt.sign(
      { id: user.id, role: user.role, walletAddress: user.walletAddress },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        walletAddress: user.walletAddress,
        verificationStatus: user.verificationStatus,
        verificationNotes: user.verificationNotes,
      },
    });
  } catch (error) {
    console.error('Voter login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
