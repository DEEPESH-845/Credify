<div align="center">

# 🔗 Credify

### **Professional Credentials. On-Chain. Unstoppable.**

*A blockchain-powered professional network where your degrees, certifications, and reputation are verifiable, tamper-proof, and truly yours.*

[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636?logo=solidity)](https://soliditylang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=next.js)](https://nextjs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![OpenZeppelin](https://img.shields.io/badge/OpenZeppelin-5.1-4E5EE4?logo=openzeppelin&logoColor=white)](https://www.openzeppelin.com/)
[![IPFS](https://img.shields.io/badge/IPFS-Decentralized-65C2CB?logo=ipfs&logoColor=white)](https://ipfs.tech/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

**[The Problem](#-the-problem) · [The Solution](#-how-credify-solves-it) · [Architecture](#-system-architecture) · [Quick Start](#-quick-start) · [Tech Stack](#-tech-stack)**

</div>

---

## 🚨 The Problem

Professional credential fraud is a **$600B+ global problem**. Today's system is broken:

| Pain Point | Reality |
|---|---|
| 🎓 **Fake Degrees** | 33% of resumes contain fabricated education claims |
| ⏳ **Slow Verification** | Background checks take 2–4 weeks and cost $30–$300 per candidate |
| 🏢 **Centralized Gatekeepers** | LinkedIn, universities, and HR platforms own your professional identity |
| 🔒 **No Portability** | Switch platforms? Start from zero. Your reputation doesn't follow you |
| 🤝 **Meaningless Endorsements** | One-click endorsements carry zero weight or accountability |

> *"Your professional identity shouldn't live on someone else's server."*

---

## 💡 How Credify Solves It

Credify replaces trust-by-assumption with **trust-by-verification** — anchored to the Ethereum blockchain.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   🏛️  University issues a degree    →  Minted as an NFT        │
│   🏢  Company verifies employment   →  Immutable on-chain      │
│   👥  Peers endorse your skills     →  Soulbound reputation    │
│   🔍  Recruiter checks credentials  →  Instant, trustless      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Core Capabilities

| Feature | How It Works |
|---|---|
| **🪪 Wallet-Based Identity** | No passwords. Authenticate by signing a message with your Ethereum wallet. Your keys, your identity. |
| **📜 Credential NFTs** | Universities and companies issue credentials as ERC-721 tokens. Tamper-proof, publicly verifiable, permanently on-chain. |
| **⭐ Soulbound Reputation** | Earn non-transferable ERC-20 tokens through peer endorsements. Reputation can't be bought, sold, or faked. |
| **🗳️ DAO-Style Endorsements** | Endorse peers for specific skills. One endorsement per skill per person — every vote carries weight. |
| **📁 IPFS Document Storage** | Credential documents and profile images stored on IPFS. Decentralized, permanent, censorship-resistant. |
| **🔗 Social Graph** | Connect with professionals, share posts, build your network — with credentials that actually mean something. |

---

## 🏗️ System Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           CREDIFY ARCHITECTURE                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    🖥️  FRONTEND (Next.js 15)                    │    │
│  │                                                                  │    │
│  │  WalletContext ──→ ethers.js ──→ MetaMask                       │    │
│  │       │                              │                           │    │
│  │  Pages: Login │ Profile │ Feed │ Credentials │ Issuer Dashboard │    │
│  │       │                              │                           │    │
│  │  Tailwind CSS    TransactionToasts   Loading Indicators         │    │
│  └───────┬──────────────────────────────┬───────────────────────────┘    │
│          │ REST API + JWT               │ Direct Contract Calls          │
│          ▼                              ▼                                │
│  ┌───────────────────────┐    ┌─────────────────────────────────┐       │
│  │  ⚙️  BACKEND (Express) │    │  ⛓️  SMART CONTRACTS (Solidity)  │       │
│  │                        │    │                                  │       │
│  │  Auth Service          │    │  CredentialNFT (ERC-721)        │       │
│  │  ├─ Nonce generation   │    │  ├─ Issuer management           │       │
│  │  └─ Signature verify   │    │  ├─ Credential minting          │       │
│  │                        │    │  └─ On-chain metadata            │       │
│  │  Profile Service       │    │                                  │       │
│  │  Connection Service    │    │  ReputationToken (ERC-20)       │       │
│  │  Post Service          │    │  ├─ Soulbound (non-transferable)│       │
│  │  IPFS Service          │    │  ├─ Endorsement logic           │       │
│  │                        │    │  └─ Reward minting              │       │
│  │  Middleware:           │    │                                  │       │
│  │  JWT │ CORS │ Rate     │    │  OpenZeppelin v5.1 base         │       │
│  │  Limit │ Sanitize │    │    │  Hardhat deployment             │       │
│  │  Validation (Zod)      │    └─────────────────────────────────┘       │
│  └───────┬────────────────┘                                              │
│          │                                                               │
│          ▼                              ▼                                │
│  ┌───────────────────────┐    ┌─────────────────────────────────┐       │
│  │  🗄️  PostgreSQL        │    │  📦  IPFS                       │       │
│  │                        │    │                                  │       │
│  │  users                 │    │  Profile images                 │       │
│  │  nonces                │    │  Credential documents (PDF)     │       │
│  │  connections           │    │                                  │       │
│  │  posts                 │    │                                  │       │
│  └────────────────────────┘    └─────────────────────────────────┘       │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Authentication Flow

```
User → MetaMask → Sign Nonce → Backend Verifies Signature → JWT Issued
                                                              │
                                    Subsequent API calls use JWT ◄─┘
```

### Credential Issuance Flow

```
Issuer uploads PDF → IPFS returns CID → Issuer calls mintCredential()
                                              │
                              NFT minted to holder's wallet ◄─┘
                              Metadata stored on-chain
                              Event emitted for indexing
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | Next.js 15, React 19, Tailwind CSS | App Router, SSR, responsive UI |
| **Wallet** | ethers.js 6, MetaMask | Blockchain interactions, signing |
| **Backend** | Express 4, TypeScript | REST API, business logic |
| **Database** | PostgreSQL | Off-chain data (profiles, posts, connections) |
| **Validation** | Zod | Request schema validation |
| **Auth** | JWT + Wallet Signatures | Passwordless authentication |
| **Contracts** | Solidity 0.8.20, OpenZeppelin 5.1 | ERC-721 credentials, ERC-20 reputation |
| **Tooling** | Hardhat | Compile, test, deploy contracts |
| **Storage** | IPFS | Decentralized file storage |
| **Testing** | Jest, Mocha/Chai, fast-check | Unit, integration, property-based tests |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 18
- **PostgreSQL** ≥ 14
- **MetaMask** browser extension
- **Git**

### 1. Clone & Install

```bash
git clone https://github.com/your-org/credify.git
cd credify

# Install all dependencies
cd contracts && npm install && cd ..
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### 2. Start Local Blockchain

```bash
cd contracts
npx hardhat node          # Starts local Ethereum node on port 8545
npx hardhat run scripts/deploy.js --network localhost   # Deploy contracts
```

This writes contract addresses to `shared-config.json` at the project root.

### 3. Set Up Database

```bash
createdb blockchain_social    # Or use your preferred method
cd backend
npm run dev                   # Migrations run automatically on startup
```

### 4. Configure Environment

```bash
# Backend uses defaults (localhost:5432, db: blockchain_social, user: postgres)
# Override with: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD

# Frontend
cd frontend
cp .env.example .env.local    # Already configured for localhost
```

### 5. Launch

```bash
# Terminal 1 — Backend (port 3001)
cd backend && npm run dev

# Terminal 2 — Frontend (port 3000)
cd frontend && npm run dev
```

Open **http://localhost:3000** and connect your MetaMask wallet.

---

## 📁 Project Structure

```
credify/
├── contracts/                # Solidity smart contracts (Hardhat)
│   ├── contracts/
│   │   ├── CredentialNFT.sol     # ERC-721 credential issuance
│   │   └── ReputationToken.sol   # Soulbound ERC-20 + endorsements
│   ├── scripts/deploy.js
│   └── test/
│
├── backend/                  # Express REST API (TypeScript)
│   └── src/
│       ├── services/             # Auth, Profile, Post, Connection, IPFS
│       ├── repositories/         # PostgreSQL data access
│       ├── middleware/            # JWT, CORS, rate limit, sanitize, validate
│       ├── routes/               # Express route handlers
│       └── migrations/           # Database schema
│
├── frontend/                 # Next.js 15 App Router (TypeScript)
│   └── src/
│       ├── app/                  # Pages (login, profile, feed, credentials, issuer)
│       ├── contexts/             # WalletContext, TransactionContext
│       ├── components/           # Reusable UI components
│       ├── hooks/                # useTransaction hook
│       └── lib/                  # API client, contract config, utilities
│
└── shared-config.json        # Deployed contract addresses (auto-generated)
```

---

## 🔐 Security

| Measure | Implementation |
|---|---|
| **No Passwords** | Wallet-based auth via cryptographic signatures |
| **SQL Injection** | Parameterized queries throughout |
| **XSS Prevention** | Input sanitization middleware strips HTML/script tags |
| **Rate Limiting** | Sliding window on auth endpoints |
| **CORS** | Restricted to configured frontend origin |
| **Soulbound Tokens** | Reputation cannot be transferred or traded |
| **Checks-Effects-Interactions** | Smart contracts follow CEI pattern |
| **OpenZeppelin** | Battle-tested, audited base contracts |

---

## 🧪 Testing

```bash
# Smart contract tests
cd contracts && npx hardhat test

# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test
```

The project uses **property-based testing** with [fast-check](https://github.com/dubzzz/fast-check) to verify correctness properties across all layers.

---

## 🗺️ Roadmap

- [ ] Multi-chain deployment (Polygon, Arbitrum)
- [ ] Credential revocation by issuers
- [ ] Decentralized identity (DID) integration
- [ ] Governance DAO for platform decisions
- [ ] Mobile wallet support (WalletConnect)
- [ ] Credential expiration and renewal flows

---

<div align="center">

**Built with ⛓️ by professionals, for professionals.**

*Your credentials. Your reputation. Your keys.*

</div>
