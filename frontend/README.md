<div align="center">

# 🖥️ Credify — Frontend

**Next.js 15 + React 19 + Tailwind CSS + ethers.js**

[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![ethers.js](https://img.shields.io/badge/ethers.js-6-2535A0)](https://docs.ethers.org/)

</div>

---

## Overview

The frontend is a Next.js App Router application that connects users to the Credify platform. It handles wallet-based authentication via MetaMask, displays on-chain credentials and reputation, and communicates with both the Express backend (REST API) and Ethereum smart contracts (ethers.js).

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | ≥ 18 |
| npm | ≥ 9 |
| MetaMask | Browser extension |
| Backend | Running on port 3001 |
| Contracts | Deployed (shared-config.json populated) |

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:3001` | Backend API URL |
| `NEXT_PUBLIC_IPFS_GATEWAY` | `https://ipfs.io/ipfs` | IPFS gateway for file display |

### 3. Ensure prerequisites are running

- **Local blockchain**: `cd contracts && npx hardhat node` (port 8545)
- **Contracts deployed**: `npx hardhat run scripts/deploy.js --network localhost`
- **Backend**: `cd backend && npm run dev` (port 3001)

### 4. Start the dev server

```bash
npm run dev
```

Open **http://localhost:3000** and connect MetaMask (set to Hardhat network: `localhost:8545`, chain ID `31337`).

---

## Pages

| Route | Page | Description |
|---|---|---|
| `/login` | Login | Connect MetaMask, sign nonce, authenticate |
| `/profile/[address]` | Profile View | Display profile, credentials (NFTs), reputation tokens, endorse |
| `/profile/edit` | Profile Edit | Update display name, headline, bio, location, profile image |
| `/connections` | Connections | Send/accept/decline requests, view connections |
| `/feed` | Feed | Create posts, view reverse-chronological feed, delete own posts |
| `/credentials/[tokenId]` | Credential Verification | Verify on-chain credential data, view IPFS document |
| `/issuer` | Issuer Dashboard | Upload credential docs to IPFS, mint credential NFTs |

All routes except `/login` are protected by an auth guard that redirects unauthenticated users.

---

## Project Structure

```
frontend/
├── src/
│   ├── app/                          # Next.js App Router pages
│   │   ├── layout.tsx                    # Root layout (WalletProvider + TransactionProvider)
│   │   ├── login/page.tsx
│   │   ├── profile/[address]/page.tsx
│   │   ├── profile/edit/page.tsx
│   │   ├── connections/page.tsx
│   │   ├── feed/page.tsx
│   │   ├── credentials/[tokenId]/page.tsx
│   │   └── issuer/page.tsx
│   ├── contexts/
│   │   ├── WalletContext.tsx              # MetaMask, signer, contract instances, JWT
│   │   └── TransactionContext.tsx         # Global toast notification system
│   ├── components/
│   │   ├── TransactionStatus.tsx         # Inline spinner + status text
│   │   ├── TransactionToast.tsx          # Toast notification (loading/success/error)
│   │   └── EndorseButton.tsx             # Skill endorsement UI
│   ├── hooks/
│   │   └── useTransaction.ts             # Transaction lifecycle hook
│   └── lib/
│       ├── api.ts                        # Centralized API client (JWT auto-attached)
│       ├── contracts-config.ts           # Reads shared-config.json for contract addresses
│       └── transaction-utils.ts          # Revert reason parser
├── __tests__/                        # Jest + React Testing Library
├── .env.example
├── jest.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Key Architecture Decisions

### WalletContext

Wraps the entire app. Manages:
- MetaMask connection state and account/chain change listeners
- `BrowserProvider` and `Signer` from ethers.js
- Pre-connected `CredentialNFT` and `ReputationToken` contract instances
- JWT storage (localStorage) for API authentication

### API Client (`lib/api.ts`)

All backend calls go through a centralized `request()` function that:
- Prepends `NEXT_PUBLIC_API_BASE_URL` to all paths
- Attaches `Authorization: Bearer <jwt>` header automatically
- Parses error responses into typed `ApiRequestError` objects

### Transaction UX

Blockchain transactions use a layered feedback system:
- **`useTransaction` hook** — Tracks lifecycle (idle → pending → success/error)
- **`TransactionStatus`** — Inline spinner embedded in forms
- **`TransactionToast`** — Global toast notifications with retry on network errors
- **Revert reason parsing** — Extracts human-readable messages from contract reverts

---

## MetaMask Setup (Local Development)

To connect MetaMask to the local Hardhat network:

1. Open MetaMask → Settings → Networks → Add Network
2. Configure:
   - **Network Name**: Hardhat Local
   - **RPC URL**: `http://127.0.0.1:8545`
   - **Chain ID**: `31337`
   - **Currency Symbol**: `ETH`
3. Import a Hardhat test account using one of the private keys printed when you run `npx hardhat node`

---

## Testing

```bash
npm test          # Run all tests
```

Tests use **Jest** with **React Testing Library** and **jsdom** environment. Component tests verify rendering, user interactions, and loading/error states.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server (port 3000) |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run test suite |
