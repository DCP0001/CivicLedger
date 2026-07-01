# CivicLedger — Blockchain Voting Platform

A secure, decentralized on-chain voting system built with Ethereum Smart Contracts, an Express.js/SQLite backend, and a Next.js/React frontend integrated with MetaMask and optionally Supabase.

---

## Project Structure

```
secure-vote/
├── blockchain/          # Hardhat Ethereum smart contracts (Solidity)
├── backend/             # Express.js + Prisma + SQLite REST API
├── frontend/            # Next.js 16 UI (Tailwind CSS v4, Wagmi, Viem)
├── MEMORIES.md          # Complete feature changelog and implementation notes
├── supabase_schema.sql  # Supabase tables schema (if using cloud DB)
└── package.json         # Root scripts for running all services
```

---

## Prerequisites

Make sure the following are installed on your machine:

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | v18+ | All services |
| npm | v9+ | Package management |
| MetaMask | Latest | Browser wallet for signing transactions |

---

## Environment Files Setup

> ⚠️ These files are **NOT committed to Git** — you must create them manually.

### 1. Backend env — `backend/.env`

Create the file `backend/.env` with these exact contents:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="supersecretjwtkey12345!votingplatform"
PORT=5000
```

- `DATABASE_URL`: Path to the SQLite database file (auto-created on first run).
- `JWT_SECRET`: Secret key for signing JWT tokens. Change this to a secure random value in production.
- `PORT`: Port the Express server runs on (default 5000).

---

### 2. Frontend env — `frontend/.env.local`

Create the file `frontend/.env.local`:

**Option A — Use Supabase Cloud (recommended for shared development):**
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
```

**Option B — Use local SQLite only (no Supabase account needed):**
```env
# Leave this file empty, or don't create it at all.
# The app will automatically fall back to the local Express/SQLite server.
```

> The Supabase keys can be found in your Supabase project → Settings → API.

---

## Installing Dependencies

Run this in each directory (you only need to do this once):

```bash
# Install root dev tools
npm install

# Install blockchain dependencies
cd blockchain && npm install && cd ..

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

---

## Running the Application

Open **4 separate terminal windows** in the project root and run each command in sequence:

### Terminal 1 — Local Ethereum Blockchain Node
```bash
npm run hardhat:node
```
This starts a local Ethereum simulator at `http://127.0.0.1:8545`. Keep this running.  
It also prints 20 test wallet accounts with their private keys — **save these**.

### Terminal 2 — Deploy Smart Contract
```bash
npm run hardhat:deploy
```
Deploys `SecureVote.sol` to the local blockchain. The contract deploys to address:
```
0x5FbDB2315678afecb367f032d93F642f64180aa3
```
This address is already set in `frontend/src/config/contract.ts`. Only re-deploy if you modify the contract.

### Terminal 3 — Backend Server
```bash
# First time only: create SQLite database and seed default admin/voter accounts
npm run backend:seed

# Start the backend server (runs at http://localhost:5000)
npm run backend:dev
```

### Terminal 4 — Frontend Dev Server
```bash
# Runs at http://localhost:3000
npm run frontend:dev
```

---

## Default Login Credentials

### Admin Dashboard
- **URL:** `http://localhost:3000/admin/login`
- **Email:** `admin@securevote.com`
- **Password:** `adminpassword123`
- **MetaMask Account:** Hardhat Account #0

### Test Voter Accounts (pre-seeded)
These are registered in the SQLite database and can authenticate via MetaMask:
- **Alice Johnson** → Hardhat Account #1 (`0x70997970C51812dc3A010C7d01b50e0d17dc79C8`)
- **Bob Smith** → Hardhat Account #2 (`0x3C44cDDdB6a900fa2b585dd299e03d12FA4293BC`)

---

## MetaMask Setup (Required to Vote)

1. Open MetaMask → Click network selector → **Add network manually**
2. Enter these network details:
   - **Network Name:** `Hardhat Localhost`
   - **RPC URL:** `http://127.0.0.1:8545`
   - **Chain ID:** `1337`
   - **Currency Symbol:** `ETH`
3. Import a test account:
   - From the `npm run hardhat:node` terminal output, copy any account's **Private Key**
   - MetaMask → Profile icon → **Import Account** → Paste the private key

---

## Application Routes

| URL | Description |
|-----|-------------|
| `http://localhost:3000/` | Public homepage — lists active elections |
| `http://localhost:3000/register` | Self-register as a voter (generates wallet if needed) |
| `http://localhost:3000/profile` | Voter profile — whitelist status, ballot links |
| `http://localhost:3000/elections/:id/vote` | Cast ballot page |
| `http://localhost:3000/elections/:id/results` | Election results & winner |
| `http://localhost:3000/verify` | Public blockchain ballot audit ledger |
| `http://localhost:3000/admin/login` | Admin login |
| `http://localhost:3000/admin/dashboard` | Admin control panel |

---

## Voter Registration Flow (End-to-End)

1. **Voter visits `/register`** — fills in Name, Email, Wallet Address (or generates a new one in-browser)
2. **Admin logs into `/admin/dashboard`** — sees voter in the Voter Registry directory
3. **Admin whitelists voter on-chain** — clicks "Whitelist" for the specific election (calls smart contract `registerVoter`)
4. **Voter connects MetaMask** → visits `/profile` → sees "Whitelisted" status ✅
5. **Voter clicks "Go Vote"** → signs transaction on MetaMask → ballot recorded on blockchain

---

## Admin Actions Summary

From the Admin Dashboard (`/admin/dashboard`):
- Create elections (synced on-chain + off-chain database)
- Add candidates to elections
- Start/End elections (on-chain state transitions)
- Register voters manually (off-chain directory)
- Whitelist voter wallets on-chain per election
- **Delete voter profiles** (new — trash icon in Voter Directory)

---

## Supabase Cloud Database (Optional)

If you want to use Supabase instead of local SQLite for shared team development:

1. Create a free project at [supabase.com](https://supabase.com)
2. Open the **SQL Editor** in your Supabase project
3. Paste and run the contents of `supabase_schema.sql` to create all tables
4. Copy your project URL and publishable key from **Settings → API**
5. Add them to `frontend/.env.local` (see Environment Files section above)

> ⚠️ When Supabase is configured, the frontend skips the local Express backend for database queries and talks directly to Supabase. The blockchain layer (Hardhat + smart contract) always runs locally regardless.

---

## Key Files for Development

| File | Purpose |
|------|---------|
| `blockchain/contracts/SecureVote.sol` | The Solidity smart contract |
| `blockchain/scripts/deploy.ts` | Deployment script |
| `backend/prisma/schema.prisma` | SQLite database schema |
| `backend/src/controllers/` | All API endpoint logic |
| `backend/src/routes/` | Express route definitions |
| `frontend/src/config/contract.ts` | ABI + contract address |
| `frontend/src/config/supabase.ts` | Supabase client config |
| `frontend/src/store/authStore.ts` | Zustand auth state |
| `frontend/src/components/Header.tsx` | Top navigation |
| `frontend/src/components/Sidebar.tsx` | Collapsible side nav |
| `MEMORIES.md` | Detailed changelog of all features added |

---

## Common Issues

**"Cannot connect to RPC" in MetaMask**
→ Make sure `npm run hardhat:node` is running and MetaMask is on the `Hardhat Localhost` network.

**Backend 500 errors / "table not found"**
→ Run `npm run backend:seed` to create and seed the SQLite database.

**Frontend shows blank page**
→ Check that the backend is running at `http://localhost:5000` and the contract address in `contract.ts` matches the deployed address.

**Supabase "table not found" errors**
→ Make sure you ran `supabase_schema.sql` in your Supabase SQL Editor.
