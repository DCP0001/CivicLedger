import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean database
  await prisma.auditLog.deleteMany({});
  await prisma.voteReference.deleteMany({});
  await prisma.candidate.deleteMany({});
  await prisma.election.deleteMany({});
  await prisma.user.deleteMany({});

  // 1. Create Admin
  const adminPasswordHash = await bcrypt.hash('adminpassword123', 10);
  const admin = await prisma.user.create({
    data: {
      name: 'Election Administrator',
      email: 'admin@securevote.com',
      passwordHash: adminPasswordHash,
      walletAddress: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', // Hardhat Signer Account 0
      role: 'admin',
    },
  });
  console.log('Admin created:', admin.email);

  // 2. Create Voter Alice
  const voter1 = await prisma.user.create({
    data: {
      name: 'Alice Johnson',
      email: 'alice@securevote.com',
      walletAddress: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8', // Hardhat Signer Account 1
      role: 'voter',
    },
  });
  console.log('Voter 1 (Alice) created:', voter1.email);

  // 3. Create Voter Bob
  const voter2 = await prisma.user.create({
    data: {
      name: 'Bob Smith',
      email: 'bob@securevote.com',
      walletAddress: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc', // Hardhat Signer Account 2
      role: 'voter',
    },
  });
  console.log('Voter 2 (Bob) created:', voter2.email);

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
