<div align="center">
    <img src="image_gdg/gdg-hust-lockup-clean.webp" alt="Background Banner" width="100%"/>  
    <br/>
    <br/> 
    <img src="image_gdg/logo-gdg-clean.webp" alt="App Logo" width="150"/>
</div>

# Web Chat Real-Time (GDG-HUST Realtime Chat)

> A production-grade, feature-rich real-time web chat platform crafted for **Google Developer Groups on Campus • Hanoi University of Science and Technology (GDG-HUST)**, supporting 1-1 direct messaging and multi-user room chats, built with a full-stack TypeScript Monorepo architecture.

[![Status](https://img.shields.io/badge/status-completed%20%26%20verified-success.svg)]()
[![TypeScript](https://img.shields.io/badge/typescript-%5E5.7-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/node.js-v18%2B-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-v18-61dafb.svg)](https://react.dev/)
[![Socket.io](https://img.shields.io/badge/socket.io-v4.8-orange.svg)](https://socket.io/)
[![License](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)

---

## Key Features

The system is engineered across three progressive technical tiers, enhanced with the **GDG-HUST / Google Chat Design System**:

### Level 1: Core Prerequisites
* **Real-time Two-Way Communication**: Stable WebSocket / Socket.io bidirectional connection with automatic background room subscriptions.
* **Persistent Message History**: Reliable PostgreSQL database storage (with automatic in-memory **PGlite** fallback for zero-config local/test runs) and historical message retrieval upon reopening chat sessions.
* **JWT Authentication**: Secure user authentication for both HTTP REST APIs and Socket Handshake, paired with a **Zero-Shift Auth UI**.

### Level 2: Standard Enhancements
* **Room Chats**: Multi-user group chat spaces with role-based administration (`OWNER`, `ADMIN`, `MEMBER`).
* **Real-time Presence**: Live `Online` / `Offline` / `Last seen` statuses equipped with a 5-second anti-flicker grace period buffer.
* **Typing Indicators**: Live real-time debounced typing notifications for both 1-1 and group rooms.
* **Rich Media Integration**: Built-in Emoji picker popover and GIF search modal via Giphy API (with curated fallback GIFs).

### Level 3: Advanced Capabilities & Responsive UX
* **Cloud File Attachments & Previews**: Upload and manage images (with thumbnail previews & full-screen **Image Lightbox**) and documents (with in-app **Document Preview Modal**) up to 10MB via Cloud Storage.
* **Dual-Layer Sync Strategy**: Automatic network recovery and missed message synchronization (Socket.io Connection State Recovery `< 2 min` + REST Catch-up Sync `> 2 min`).
* **Delivery Tracking, Read Receipts & Unread Counters**: Real-time delivery state transitions (`SENT` $\rightarrow$ `DELIVERED` $\rightarrow$ `READ` with a moving `Seen [Mini-Avatar]` watermark) and live unread badges (`unreadCount`).
* **Cursor-based Pagination**: Infinite scroll message history loading (`limit=50`, `before=<id>`, `after=<id>`) for smooth scroll performance.
* **Browser Push Notifications**: HTML5 Web Notifications accompanied by an audio chime when the app runs in the background.
* **Adaptive Multi-Device Layout**:
  * **Mobile (`< 768px`)**: Master-Detail navigation with `100dvh` dynamic viewport height and a dedicated mobile back button without unmounting real-time socket state.
  * **Desktop (`>= 768px`)**: Dual-Pane layout featuring a fixed `352px` (`md:w-88`) sidebar and a **Persistent Detail View** when switching between Direct Chats and Rooms tabs.

---

## Tech Stack & Architecture

- **Monorepo Manager**: NPM Workspaces (`shared`, `server`, `client`)
- **Backend**: Node.js, Express, Socket.io, TypeScript
- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, TypeScript
- **Database & ORM**: PostgreSQL (Neon / Supabase) + Prisma v7 Driver Adapters (`@prisma/adapter-pg` & in-memory `@electric-sql/pglite`)
- **Storage**: Cloud Storage Adapter Pattern (`LocalStorageAdapter` / `SupabaseStorageAdapter`)
- **Testing**: Vitest + Supertest (Backend) & Vitest + React Testing Library + JSDOM (Frontend)

```mermaid
flowchart LR
    Client["React SPA (Vercel)"] -- "WebSocket & REST" --> Server["Node.js / Express / Socket.io (Render)"]
    Server -- "Prisma ORM (pg / PGlite)" --> DB[("PostgreSQL (Neon/Supabase)")]
    Server -- "Storage Adapter" --> Storage[("Cloud Storage")]
```

---

## Project Structure

```text
webchat-realtime/
├── package.json                 # Monorepo root configuration & scripts
├── tsconfig.base.json           # Shared TypeScript base config
├── render.yaml                  # Render Infrastructure-as-Code deployment blueprint
├── vercel.json                  # Vercel SPA routing configuration
├── GLOSSARY.md                  # Domain terminology & GDG-HUST design vocabulary
├── image_gdg/                   # GDG-HUST brand assets (banner & logo)
├── docs/                        # ADRs (0001 - 0008), System Architecture & Agent guides
├── shared/                      # Shared Contracts package (@webchat/shared)
│   └── src/
│       ├── dtos.ts              # Data Transfer Objects & normalizeDirectChatPair
│       ├── enums.ts             # RoomRole, MessageType, MessageStatus
│       └── events.ts            # SOCKET_EVENTS constants & typed payloads
├── server/                      # Backend API & WebSocket Server (@webchat/server)
│   ├── prisma/
│   │   ├── schema.prisma        # Prisma database schema definition
│   │   └── schema.sql           # SQL DDL for PGlite in-memory initialization
│   ├── src/                     # Controllers, routes, socket handlers & storage adapters
│   └── tests/                   # 14 Backend integration & boundary test suites
└── client/                      # Frontend React SPA (@webchat/client)
    └── src/
        ├── components/          # Auth, Chat, Common, Dashboard, Media & Room UI
        ├── context/             # AuthContext & SocketContext
        ├── hooks/               # Custom hooks (messages, presence, typing, rooms)
        ├── utils/               # API client, deterministic 4-color avatar, notifications
        ├── test/setup.ts        # JSDOM test environment setup
        └── *.test.tsx           # 13 Client UI & behavior test suites
```

---

## Getting Started & Installation

### Prerequisites
- **Node.js** (v18 or higher)
- **NPM** (v9+)
- **PostgreSQL Database** (Optional for local dev/testing thanks to built-in **PGlite** in-memory fallback; recommended for persistent storage via local Postgres or free Neon/Supabase cloud DB)

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
Create `.env` configuration files (or copy from `.env.example` / `server/.env.example`):

* **`server/.env`** (or root `.env`):
  ```env
  PORT=4000
  NODE_ENV=development
  DATABASE_URL="postgresql://user:password@host:port/dbname?sslmode=require"
  JWT_SECRET="your_super_secret_jwt_key"
  STORAGE_PROVIDER="local" # Options: local | supabase (supabase also needs SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_STORAGE_BUCKET)
  # Optional: GIPHY_API_KEY="your-giphy-api-key"
  ```
  *(Note: If `DATABASE_URL` is omitted or set to `memory:`, the server automatically boots with an in-memory **PGlite** PostgreSQL instance initialized from `server/prisma/schema.sql`.)*

### 4. Database Migration (When Using External PostgreSQL)
Run Prisma migrations to initialize your external PostgreSQL database schema:
```bash
npm run db:migrate --workspace=server
```

### 5. Run in Development Mode
Start both the backend server and frontend client concurrently:
```bash
npm run dev
```
* **Frontend**: `http://localhost:5173`
* **Backend API / WebSocket**: `http://localhost:4000`

---

## Running Tests

Run the entire test suite (14 backend integration suites + 13 frontend UI suites):
```bash
npm test
```

Or run backend and frontend test suites individually:
```bash
# Backend integration & socket tests (runs on in-memory PGlite)
npm run test:server

# Frontend React UI & responsive behavior tests
npm run test:client
```

---

## Secret scanning

This repository is public, so secrets must never be committed. Real values live only in your gitignored `.env` and in the Render dashboard; `render.yaml` declares every secret with `sync: false` and holds no values.

A [gitleaks](https://github.com/gitleaks/gitleaks) pre-commit hook in `.githooks/pre-commit` blocks a commit whose staged changes contain a secret. Set it up once per clone:

1. Install gitleaks 8.19 or newer so it is on your `PATH`:
   - Windows: `winget install --id Gitleaks.Gitleaks` (or `scoop install gitleaks`)
   - macOS: `brew install gitleaks`
   - Linux: download a release binary from <https://github.com/gitleaks/gitleaks/releases>
2. Point git at the repository's hooks directory (this only changes this clone's `.git/config`):
   ```bash
   git config core.hooksPath .githooks
   ```

The hook refuses to commit if gitleaks is missing. To scan the whole working tree or the git history by hand:
```bash
gitleaks dir . --redact   # current files
gitleaks git . --redact   # every commit
```

Rules come from `.gitleaks.toml` (the gitleaks defaults plus an allowlist for fake test fixtures in `server/tests/`). Findings that already exist in git history are recorded in `.gitleaksignore`; history is not rewritten, and those keys are treated as compromised and rotated. If gitleaks flags a real secret, do not add it to `.gitleaksignore`: remove it from the change and rotate it.

---

## Free-Tier Deployment Strategy

This application is architected to run completely free of charge on modern cloud free-tiers (supporting both **Decoupled** and **Unified Single-Host** deployment modes):
1. **Frontend**: Deployed as a static SPA bundle on **Vercel** (`vercel.json`), or served directly from Express when `client/dist` is built (`npm run build`).
2. **Backend**: Hosted as a Web Service on **Render** (`render.yaml`, includes `/health` checks and built-in UI reconnection banners for Render's cold-start sleep behavior).
3. **Database & Storage**: Managed PostgreSQL database on **Neon / Supabase** and file attachments stored in **Supabase Storage Buckets** (`attachments`).

---

## Documentation

For deep technical dives into our design patterns, data models, domain glossary, and architectural decision records (ADRs `0001`–`0008`), please check out:
- [System Architecture Documentation](docs/adr/SYSTEM_ARCHITECTURE.md)
- [Domain Glossary (GDG-HUST)](GLOSSARY.md)

---

## License

Distributed under the [MIT License](LICENSE).
