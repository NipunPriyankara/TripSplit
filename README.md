# TripSplit — Full-Stack Group Trip Expense Splitter PWA

A modern, mobile-first Progressive Web App (PWA) built to make splitting group expenses during trips, dinners, parties, and adventures fast, simple, and mathematically accurate—both offline and online.

---

## 🌟 Key Features

- **📱 Mobile-First PWA**: Installable on iOS and Android via browser "Add to Home Screen". Touch-first responsive interface with bottom navigation and quick-entry modals.
- **⚡ Offline-First Architecture**: Powered by **Dexie.js (IndexedDB)** and a Service Worker (`sw.js`). Cache trips, view members, record expenses, and compute balances with zero internet connection.
- **🔄 Auto-Synchronization**: Background mutation queue (`syncQueue`) that automatically syncs offline changes via `/api/sync` when connectivity is restored, featuring Last-Write-Wins (LWW) conflict handling and client-generated UUIDs.
- **🔒 Private Trip Rooms & Gated Access**:
  - Unpredictable invitation tokens (`/join/:token`).
  - Strict join-request approval flow: Opening the invite link requires submitting a request that only the Trip Owner can **Accept** or **Reject**.
  - No trip data, balances, or member names are exposed to outsiders before approval.
- **💰 Decimal-Safe Financial Engine**:
  - All monetary values stored and computed in integer cents to prevent IEEE 754 floating-point errors.
  - **Split Types Supported**:
    - **Equal**: Automatic remainder-penny distribution.
    - **Exact Amounts**: Strict sum validation.
    - **Percentages**: 100% sum validation with remainder adjustment.
    - **Shares**: Proportionally weighted units.
    - **Selected Members**: Split exclusively across a subset of group members.
- **🤝 Minimized Settlement Optimizer**: Greedy debt simplification algorithm that condenses cyclic and multi-party debts down to the theoretical minimum number of transactions ($\le N-1$).
- **🎉 Settlement Tracking**: Record payments between members with confetti celebration animations and track status (`Pending`, `Paid`, `Confirmed`).

---

## 🏗️ Architecture & Tech Stack

```
Frontend (PWA)               Backend (REST API)               Database
React 18 + TypeScript        Node.js + Express + TypeScript    Normalized Relational SQLite
Vite + Tailwind CSS          JWT Auth + Zod Validation         WAL Mode + Foreign Keys
Dexie.js (IndexedDB)         Decimal Splitting & Settlement    UUID Primary Keys
Service Worker (sw.js)       Offline Batch Sync Handler        Soft Deletes (deleted_at)
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js v18+ (tested on Node v22.19.0)
- npm v10+

### 2. Start the Backend API Server
```bash
npm run server
# Or:
cd server
npm run dev
```
The API server will start on `http://localhost:5000`.

### 3. Start the Frontend PWA Client
```bash
npm run client
# Or:
cd client
npm run dev
```
The Vite development server will start on `http://localhost:5173`.

---

## 🧪 Running Automated Tests

Run the complete test suite (unit tests for math & settlements + full end-to-end API integration tests):
```bash
npm test
```
All 18 test cases cover:
1. Equal split penny remainder fairness
2. Exact amounts strict sum equality
3. Percentage sum validation and rounding
4. Shares proportional distribution
5. Net balance arithmetic
6. Minimized settlement graph generation ($\le N-1$ transactions)
7. End-to-end trip creation, invitation generation, join request submission, owner approval, expense logging, balance calculation, and settlement clearing.
