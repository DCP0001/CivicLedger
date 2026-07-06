import crypto from 'crypto';
import { recoverMessageAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import prisma from '../config/db';

export interface TransactionPayload {
  electionId?: number;
  id?: number;
  title?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  name?: string;
  party?: string;
  imageUrl?: string;
  walletAddress?: string;
  candidateId?: number;
}

export class BlockchainEngine {
  private static authorityPrivateKey =
    process.env.AUTHORITY_PRIVATE_KEY ||
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  
  private static authorityAccount = privateKeyToAccount(
    this.authorityPrivateKey as `0x${string}`
  );

  /**
   * Authority Node Public Address
   */
  public static getAuthorityAddress(): string {
    return this.authorityAccount.address.toLowerCase();
  }

  /**
   * Helper: Calculate SHA-256 hash of a string
   */
  public static calculateHash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Digital Signature Verifier: Verifies that a transaction signature matches the sender's public address
   */
  public static async verifySignature(
    type: string,
    sender: string,
    payload: TransactionPayload,
    signature: string
  ): Promise<boolean> {
    try {
      const message = JSON.stringify({ type, sender, payload });
      const recovered = await recoverMessageAddress({
        message,
        signature: signature as `0x${string}`,
      });
      return recovered.toLowerCase() === sender.toLowerCase();
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * Retrieve the latest block in the database
   */
  public static async getLatestBlock() {
    return await prisma.block.findFirst({
      orderBy: { index: 'desc' },
      include: { transactions: true },
    });
  }

  /**
   * Initialize Genesis Block if the chain is empty
   */
  public static async initGenesisBlock() {
    const blockCount = await prisma.block.count();
    if (blockCount > 0) return;

    console.log('Initializing Genesis Block (Index 0) on custom blockchain...');

    const index = 0;
    const timestamp = new Date();
    const prevHash = '0';
    const nonce = 0;
    const transactionsStr = 'Genesis Block';

    // Calculate block hash
    const blockHash = this.calculateHash(
      index + timestamp.toISOString() + prevHash + transactionsStr + nonce
    );

    // Consensus Manager (PoA): Sign block hash with authority key
    const blockSignature = await this.authorityAccount.signMessage({
      message: blockHash,
    });

    await prisma.block.create({
      data: {
        index,
        timestamp,
        prevHash,
        hash: blockHash,
        nonce,
        signature: blockSignature,
      },
    });

    console.log('Genesis Block created successfully. Hash:', blockHash);
  }

  /**
   * Submit and validate a transaction, adding it to the ledger pool (pending)
   */
  public static async submitTransaction(
    type: string,
    sender: string,
    payload: TransactionPayload,
    signature: string
  ) {
    // 1. Verify digital signature
    const isValid = await this.verifySignature(type, sender, payload, signature);
    if (!isValid) {
      throw new Error('Digital signature verification failed. Transaction rejected.');
    }

    // 2. Additional Business Rules Validation (Vote Validator)
    if (type === 'CAST_VOTE') {
      const electionId = payload.electionId;
      const candidateId = payload.candidateId;

      if (electionId === undefined || candidateId === undefined) {
        throw new Error('Election ID and Candidate ID are required for voting.');
      }

      // Check if election is active
      const election = await prisma.election.findUnique({
        where: { id: electionId },
      });
      if (!election || election.status !== 'active') {
        throw new Error('Election is not active.');
      }

      // Check if voter is whitelisted on-chain
      const isWhitelisted = await prisma.whitelistedVoter.findUnique({
        where: {
          electionId_walletAddress: {
            electionId,
            walletAddress: sender.toLowerCase(),
          },
        },
      });
      if (!isWhitelisted) {
        throw new Error('Voter is not whitelisted for this election.');
      }

      // Check if voter already voted
      const alreadyVoted = await prisma.voteReference.findUnique({
        where: {
          electionId_walletAddress: {
            electionId,
            walletAddress: sender.toLowerCase(),
          },
        },
      });
      if (alreadyVoted) {
        throw new Error('Voter has already cast a ballot in this election.');
      }
    }

    // 3. Create the transaction as pending (blockIndex is null)
    const txHashStr = JSON.stringify({ type, sender, payload, timestamp: new Date().toISOString() });
    const txHash = this.calculateHash(txHashStr);

    const transaction = await prisma.transaction.create({
      data: {
        id: '0x' + txHash,
        type,
        sender: sender.toLowerCase(),
        payload: JSON.stringify(payload),
        signature,
      },
    });

    // 4. Automatically trigger block generation for immediate response
    // (Proof of Authority consensus has immediate/fast block minting)
    await this.minePendingTransactions();

    return transaction;
  }

  /**
   * Block Generator & Consensus Manager (PoA)
   * Aggregates pending transactions, signs block hash, commits to SQLite, and updates off-chain state tables
   */
  public static async minePendingTransactions() {
    const pendingTransactions = await prisma.transaction.findMany({
      where: { blockIndex: null },
    });

    if (pendingTransactions.length === 0) return;

    // Get the previous block
    let prevBlock = await this.getLatestBlock();
    if (!prevBlock) {
      await this.initGenesisBlock();
      prevBlock = await this.getLatestBlock();
    }

    const index = prevBlock!.index + 1;
    const timestamp = new Date();
    const prevHash = prevBlock!.hash;
    const transactionsJson = JSON.stringify(pendingTransactions.map((tx) => tx.id));

    // Simple proof of authority hashing with a slight nonce search (difficulty = 2 zero prefix)
    let nonce = 0;
    let blockHash = '';
    while (true) {
      blockHash = this.calculateHash(
        index + timestamp.toISOString() + prevHash + transactionsJson + nonce
      );
      if (blockHash.startsWith('00')) {
        break;
      }
      nonce++;
    }

    // Consensus Manager (PoA): Sign block hash with authority private key
    const blockSignature = await this.authorityAccount.signMessage({
      message: blockHash,
    });

    // Save Block and update transaction relationships inside a Prisma transaction
    await prisma.$transaction(async (tx) => {
      // Create block
      await tx.block.create({
        data: {
          index,
          timestamp,
          prevHash,
          hash: blockHash,
          nonce,
          signature: blockSignature,
        },
      });

      // Link transactions to this block
      await tx.transaction.updateMany({
        where: { id: { in: pendingTransactions.map((t) => t.id) } },
        data: { blockIndex: index },
      });

      // Apply state transitions to relational tables
      for (const trans of pendingTransactions) {
        const payload: TransactionPayload = JSON.parse(trans.payload);

        if (trans.type === 'CREATE_ELECTION') {
          await tx.election.create({
            data: {
              id: payload.id!,
              title: payload.title!,
              description: payload.description!,
              startDate: new Date(payload.startDate!),
              endDate: new Date(payload.endDate!),
              status: 'draft',
              totalVotes: 0,
            },
          });
        } else if (trans.type === 'ADD_CANDIDATE') {
          // Default placeholder gradient if no image URL is provided
          const finalImageUrl = payload.imageUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(payload.name!)}&backgroundColor=b6e3f4,c0aede,d1c4e9`;
          await tx.candidate.create({
            data: {
              id: payload.id!,
              electionId: payload.electionId!,
              name: payload.name!,
              party: payload.party!,
              imageUrl: finalImageUrl,
              description: payload.description!,
              voteCount: 0,
            },
          });
        } else if (trans.type === 'START_ELECTION') {
          await tx.election.update({
            where: { id: payload.electionId! },
            data: { status: 'active' },
          });
        } else if (trans.type === 'END_ELECTION') {
          await tx.election.update({
            where: { id: payload.electionId! },
            data: { status: 'ended' },
          });
        } else if (trans.type === 'REGISTER_VOTER') {
          await tx.whitelistedVoter.create({
            data: {
              electionId: payload.electionId!,
              walletAddress: payload.walletAddress!.toLowerCase(),
            },
          });
        } else if (trans.type === 'CAST_VOTE') {
          // 1. Update candidate vote count
          await tx.candidate.update({
            where: {
              electionId_id: {
                electionId: payload.electionId!,
                id: payload.candidateId!,
              },
            },
            data: {
              voteCount: { increment: 1 },
            },
          });

          // 2. Update election total votes count
          await tx.election.update({
            where: { id: payload.electionId! },
            data: {
              totalVotes: { increment: 1 },
            },
          });

          // 3. Create vote reference to prevent double voting
          await tx.voteReference.create({
            data: {
              electionId: payload.electionId!,
              walletAddress: trans.sender.toLowerCase(),
              transactionHash: trans.id,
            },
          });
        }
      }
    });

    console.log(`Block #${index} minted containing ${pendingTransactions.length} transaction(s). Hash: ${blockHash}`);
  }

  /**
   * Chain Validator: Scans entire block history and validates block linkage and signatures
   */
  public static async validateChain(): Promise<boolean> {
    try {
      const blocks = await prisma.block.findMany({
        orderBy: { index: 'asc' },
        include: { transactions: true },
      });

      if (blocks.length === 0) return true;

      // Check Genesis Block
      const genesis = blocks[0];
      if (genesis.index !== 0 || genesis.prevHash !== '0') {
        console.error('Chain validation failed: Invalid genesis block structure.');
        return false;
      }

      for (let i = 1; i < blocks.length; i++) {
        const currentBlock = blocks[i];
        const prevBlock = blocks[i - 1];

        // 1. Verify previous hash link
        if (currentBlock.prevHash !== prevBlock.hash) {
          console.error(`Chain validation failed at block #${currentBlock.index}: Previous hash link mismatch.`);
          return false;
        }

        // 2. Verify re-computed block hash matches database record
        const transactionsJson = JSON.stringify(currentBlock.transactions.map((tx) => tx.id));
        const computedHash = this.calculateHash(
          currentBlock.index +
            new Date(currentBlock.timestamp).toISOString() +
            currentBlock.prevHash +
            transactionsJson +
            currentBlock.nonce
        );

        if (computedHash !== currentBlock.hash) {
          console.error(`Chain validation failed at block #${currentBlock.index}: Hash does not match transactions.`);
          return false;
        }

        // 3. Verify Proof of Authority block signature
        const signerAddress = await recoverMessageAddress({
          message: currentBlock.hash,
          signature: currentBlock.signature as `0x${string}`,
        });

        if (signerAddress.toLowerCase() !== this.getAuthorityAddress()) {
          console.error(`Chain validation failed at block #${currentBlock.index}: Invalid block signature by ${signerAddress}. Expected authority ${this.getAuthorityAddress()}`);
          return false;
        }
      }

      return true;
    } catch (err) {
      console.error('Chain validation runtime error:', err);
      return false;
    }
  }
}
