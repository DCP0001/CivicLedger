# Secure Blockchain Voting Platform

A secure, decentralized on-chain voting platform built using Ethereum Smart Contracts (Solidity/Hardhat), an Express.js & SQLite off-chain database backend (Prisma), and a Next.js frontend (Wagmi/Viem).

---

## High-Level Architecture
1. **Blockchain Layer (`/blockchain`):** Ethereum smart contract (`SecureVote.sol`) that records elections, candidates, registers voter wallets, and holds casted votes immutably.
2. **Backend Services (`/backend`):** Off-chain server providing JWT authentication, voter profiles database, candidate bios/images storage, and transaction receipts indexing via SQLite.
3. **Frontend Application (`/frontend`):** Responsive Web3 UI allowing the administrator to manage voting whitelist registries, and voters to securely authenticate with MetaMask, sign ballots, and audit the results ledger.

---

## Requirements
- **Node.js** (v18 or higher recommended)
- **MetaMask Chrome Extension** (installed in your browser to interact with local blockchain node)

---

## Quick Start Guide

Open separate terminals in your workspace root directory and run the following commands sequentially:

### Step 1: Boot Up the Local Blockchain Network
Starts a local Ethereum blockchain simulator running at `http://127.0.0.1:8545`. Keep this running.
```bash
npm run hardhat:node
```

### Step 2: Deploy the Smart Contract
Deploys the `SecureVote` smart contract to the local blockchain.
```bash
npm run hardhat:deploy
```
*Note: Make sure the contract address matches `SECURE_VOTE_ADDRESS` in `frontend/src/config/contract.ts` (defaults to `0x5FbDB2315678afecb367f032d93F642f64180aa3`).*

### Step 3: Run Backend Migrations & Dev Server
Generates the SQLite file-based database, seeds default users, and starts the Express server at `http://localhost:5000`.
```bash
# Push database schema & seed local admin/voters data (run once)
npm run backend:seed

# Start backend dev server
npm run backend:dev
```

### Step 4: Run Frontend Development Server
Starts the Next.js frontend dev server at `http://localhost:3000`.
```bash
npm run frontend:dev
```

---

## Local Development Credentials

### 1. Administrator Dashboard Sign-in
- **URL:** `http://localhost:3000/admin/login`
- **Email:** `admin@securevote.com`
- **Password:** `adminpassword123`
- **Wallet Account:** Hardhat Account #0 (`0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`)

### 2. Whitelisted Voters
Log in by connecting their MetaMask wallet and signing a digital signature authentication challenge.
- **Voter 1 (Alice Johnson):** Hardhat Account #1 (`0x70997970C51812dc3A010C7d01b50e0d17dc79C8`)
- **Voter 2 (Bob Smith):** Hardhat Account #2 (`0x3C44cDDdB6a900fa2b585dd299e03d12FA4293BC`)

---

## Browser MetaMask Setup (To Test Voting)

To sign transactions and vote on your local node using MetaMask:

1. Click on the network selector in MetaMask -> **Add Network** -> **Add network manually**.
2. Enter the following network details:
   - **Network Name:** `Hardhat Localhost`
   - **New RPC URL:** `http://127.0.0.1:8545`
   - **Chain ID:** `1337` *(standard chain ID used in our `hardhat.config` for MetaMask compatibility)*
   - **Currency Symbol:** `ETH`
3. Import Private Keys to test:
   - Copy the private key of Hardhat Account #0 (Admin) or Account #1 (Alice) printed in the `npm run hardhat:node` terminal output.
   - In MetaMask, click your profile icon -> **Import Account** -> paste the private key.
