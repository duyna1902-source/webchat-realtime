<div align="center">
    <img src="webchat-realtime\image_gdg\gdg-hust-lockup-clean.webp" alt="Background Banner" width="100%"/>  
    <br/>
    <br/> 
    <img src="Web\webchat-realtime\image_gdg\logo-gdg-clean.webp" alt="App Logo" width="150"/>
<div>

# Web Chat Real-Time

> A production-grade, feature-rich real-time web chat platform supporting 1-1 direct messaging and multi-user room chats, built with a full-stack TypeScript Monorepo architecture.

[![Status](https://img.shields.io/badge/status-completed%20%26%20verified-success.svg)]()
[![TypeScript](https://img.shields.io/badge/typescript-%5E5.0-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/node.js-v18%2B-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-v18-61dafb.svg)](https://react.dev/)
[![Socket.io](https://img.shields.io/badge/socket.io-v4-orange.svg)](https://socket.io/)
[![License](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)

---

## Key Features

The system is engineered across three progressive technical tiers:

### Level 1: Core Prerequisites
* **Real-time Two-Way Communication**: Stable WebSocket / Socket.io bidirectional connection.
* **Persistent Message History**: Reliable database storage with historical message retrieval upon reopening chat sessions.
* **JWT Authentication**: Secure user authentication for both HTTP REST APIs and Socket Handshake.

### Level 2: Standard Enhancements
* **Room Chats**: Multi-user group chat spaces with role-based administration (`OWNER`, `ADMIN`, `MEMBER`).
* **Real-time Presence**: Live `Online` / `Offline` / `Last seen` statuses equipped with an anti-flicker grace period buffer.
* **Typing Indicators**: Live real-time typing notifications.
* **Rich Media Integration**: Standard Emoji picker and GIF search via Giphy API.

### Level 3: Advanced Capabilities
* **Cloud File Attachments**: Upload and manage images (with thumbnail previews) and documents up to 10MB via Cloud Storage.
* **Dual-Layer Sync Strategy**: Automatic network recovery and missed message synchronization (Connection State Recovery + REST Catch-up Sync).
* **Read Receipts & Unread Counters**: Real-time `read receipts` (`lastReadMessageId`) and unread message count calculations (`unreadCount`).
* **Cursor-based Pagination**: Infinite scroll message history loading for buttery-smooth performance.
* **Browser Push Notifications**: HTML5 Web Notifications accompanied by an audio chime when the app runs in the background.

---

## Tech Stack & Architecture

- **Monorepo Manager**: NPM Workspaces (`shared`, `server`, `client`)
- **Backend**: Node.js, Express, Socket.io, TypeScript
- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, TypeScript
- **Database & ORM**: PostgreSQL (Neon / Supabase), Prisma ORM
- **Storage**: Cloud Storage Adapter Pattern (Local / Supabase Bucket / Cloudinary)
- **Testing**: Vitest + Supertest

```mermaid
flowchart LR
    Client["React SPA (Vercel)"] -- "WebSocket & REST" --> Server["Node.js / Express / Socket.io (Render)"]
    Server -- "Prisma ORM" --> DB[("PostgreSQL (Neon/Supabase)")]
    Server -- "Storage Adapter" --> Storage[("Cloud Storage")]
```

---

## Project Structure

```text
webchat-realtime/
├── package.json                 # Monorepo root configuration
├── tsconfig.base.json           # Shared TypeScript base config
├── render.yaml                  # Render Infrastructure-as-Code deployment blueprint
├── vercel.json                  # Vercel SPA routing configuration
├── docs/                        # Architecture Decision Records (ADRs) & System Design
├── shared/                      # Shared Contracts package (@webchat/shared)
│   └── src/
│       ├── dtos.ts              # Data Transfer Objects
│       ├── enums.ts             # RoomRole, MessageType, MessageStatus
│       └── events.ts            # Socket events constants & payloads
├── server/                      # Backend API & WebSocket Server
│   ├── prisma/schema.prisma     # Prisma database schema definition
│   ├── src/                     # Controllers, routes, socket handlers & adapters
│   └── tests/                   # Integration and boundary test suites
└── client/                      # Frontend React SPA
    ├── src/                     # Components, contexts, custom hooks & utils
    └── tests/                   # Client UI tests
```

---

## Getting Started & Installation

### Prerequisites
- **Node.js** (v18 or higher)
- **NPM** (v9+)
- **PostgreSQL Database** (Local instance or free Neon/Supabase cloud DB)

### 1. Clone the Repository
```bash
git clone https://github.com/duyna1902-source/webchat-realtime.git
cd webchat-realtime
```

### 2. Install Dependencies
Install all workspaces dependencies from the root directory:
```bash
npm install
```

### 3. Environment Configuration
Create `.env` configuration files for both the server and client:

* **`server/.env`**:
  ```env
  PORT=5000
  DATABASE_URL="postgresql://user:password@host:port/dbname?sslmode=require"
  JWT_SECRET="your_super_secret_jwt_key"
  STORAGE_PROVIDER="local" # Options: local | supabase | cloudinary
  ```

### 4. Database Migration
Run Prisma migrations to initialize your database schema:
```bash
npm run db:migrate --workspace=server
```

### 5. Run in Development Mode
Start both the backend server and frontend client concurrently:
```bash
npm run dev
```
* **Frontend**: `http://localhost:5173`
* **Backend API / WebSocket**: `http://localhost:5000`

---

## Running Tests

Execute the backend integration and socket test suites:
```bash
npm test --workspace=server
```

---

## Free-Tier Deployment Strategy

This application is architected to run completely free of charge on modern cloud free-tiers:
1. **Frontend**: Deployed as a static SPA bundle on **Vercel**.
2. **Backend**: Hosted as a Web Service on **Render** (includes automatic handling of Render's cold-start sleep behavior with built-in UI reconnection indicators).
3. **Database & Storage**: Managed PostgreSQL database on **Neon / Supabase** and file attachments stored in **Supabase Storage Buckets**.

---

## Documentation

For deep technical dives into our design patterns, data models, and architectural decision records (ADRs), please check out the [System Architecture Documentation](docs/adr/SYSTEM_ARCHITECTURE.md).

---

## License

Distributed under the [MIT License](LISENCE.md).