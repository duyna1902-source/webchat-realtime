Status: ready-for-agent

# Specification: Web Chat Real-Time

## Problem Statement

Users require a dependable, instant web messaging solution to communicate both privately in pairs and collaboratively in groups directly from modern web browsers. Existing lightweight or demonstration chat solutions often fail to handle network dropouts gracefully, lack persistent message history, mix direct messaging logic with group chat governance in messy codebases, require paid infrastructure, or require disruptive database migrations as requirements expand from basic chat to attachments, read receipts, and synchronization.

## Solution

A full-stack, browser-accessible real-time messaging platform built as a clean TypeScript Monorepo (`client`, `server`, and `shared`), deployed entirely on free-tier cloud infrastructure (Render for persistent WebSockets, Vercel for frontend hosting, and Neon/Supabase for PostgreSQL). The system strictly decouples the domain entities and event logic between Direct Chat and Room Chat, while shipping a comprehensive database schema on day one that supports all three technical specification levels:
1. **Level 1 (Prerequisites)**: Two-way real-time Direct Chat, persistent message history, and secure JWT-based user authentication.
2. **Level 2 (Encouraged Standards)**: Room Chat with member governance (Owner, Admin, Member), real-time Presence (Online/Offline) with grace periods, Typing Indicators, and rich media support (Emoji and GIF search).
3. **Level 3 (Advanced Standards)**: Attachment handling (images with client preview and documents up to 10MB) via external free cloud storage, dual-layer offline recovery (Socket.io Connection State Recovery + REST Catch-up Sync), Read Receipts tracked per participant/member, and browser-level Web Notifications.

## User Stories

1. As a prospective user, I want to register a new account with a unique username, email, and secure password, so that I can establish my identity on the platform.
2. As a registered user, I want to log in using my credentials and receive a secure JWT token, so that my authenticated session is recognized across both REST endpoints and real-time socket connections.
3. As a logged-in user, I want my active browser session to persist securely, so that I do not need to log in again upon refreshing the page.
4. As a user, I want to see a list of other registered users, so that I can initiate a Direct Chat with someone.
5. As a user, I want to initiate or open an existing Direct Chat with another specific user, so that we have a private space dedicated exclusively to our communication.
6. As a participant in a Direct Chat, I want to send a text Direct Message and have it immediately delivered to the recipient in real time without refreshing the page.
7. As a participant in a Direct Chat, I want to see an immediate delivery status (Sent, Delivered, Read) on my outgoing Direct Messages, so that I know the progress of my message delivery.
8. As a user opening a Direct Chat, I want to view the recent message history loaded automatically (defaulting to the latest 50 messages), so that I can understand the context of the conversation.
9. As a user reviewing conversation history, I want the interface to automatically load older messages as I scroll to the top of the chat window (Cursor-based Pagination), so that I can browse complete historical dialogues smoothly without lagging the browser.
10. As a participant in a Direct Chat, I want to see a real-time Typing Indicator when the other person is actively typing, so that I know they are composing a response.
11. As a recipient in a Direct Chat, I want my viewing of incoming Direct Messages to automatically emit a Read Receipt, updating the sender's interface that their messages have been read.
12. As a user, I want to see real-time Presence indicators (Online / Offline and last seen timestamp) for my contacts, so that I know who is currently available.
13. As a user who refreshes the browser or experiences momentary packet loss, I want my Presence to remain Online during a 5-second grace period, so that my status does not flicker erratically for others.
14. As a user, I want to create a new Room Chat by providing a room name and optional description, so that I can host discussions with multiple people.
15. As the creator of a Room Chat, I want to be assigned the `OWNER` Room Role automatically, so that I maintain ultimate governance over the room settings and membership.
16. As a Room Chat `OWNER`, I want to promote or demote members to or from the `ADMIN` Room Role, so that I can delegate room moderation responsibilities.
17. As an `OWNER` or `ADMIN` of a Room Chat, I want to add registered users as Room Members, so that the group can expand.
18. As an `OWNER` of a Room Chat, I want to remove any Room Member or delete the room, so that I can maintain room safety and lifecycle.
19. As an `ADMIN` of a Room Chat, I want to remove regular `MEMBER` users from the room, so that I can enforce group rules.
20. As a regular `MEMBER` of a Room Chat, I want to view all Room Members and voluntarily leave the room at any time, so that I control my own participation.
21. As a Room Member, I want to send a Room Message and have it broadcast instantaneously to all active members of that room.
22. As a Room Member, I want to see real-time Typing Indicators indicating which specific members are typing in the room.
23. As a Room Member, I want the room to track my `lastReadMessageId` when I scroll through room messages, so that unread message counters reflect accurately.
24. As a user composing a message in any chat, I want to select and insert standard emojis from an integrated Emoji Picker, so that I can express tone and emotion.
25. As a user composing a message, I want to search and select animated GIFs via an integrated GIF search engine, so that I can send expressive animated media.
26. As a user, I want to select an image or document from my device to send as an Attachment, so that I can share media and work files.
27. As a user preparing to send an image Attachment, I want to see an immediate client-side thumbnail preview before confirming the send action, so that I can verify I selected the correct file.
28. As a user, I want the system to enforce a strict 10MB file size limit with friendly validation, so that oversized uploads do not fail unexpectedly or exhaust network bandwidth.
29. As a user whose internet disconnects for a short interval (under 2 minutes), I want the system to leverage Socket.io Connection State Recovery to restore buffered messages seamlessly upon reconnection.
30. As a user who experiences prolonged network loss or closes the laptop lid, I want the application to automatically trigger Catch-up Sync via a REST API query when connectivity returns, so that no messages sent during downtime are missed.
31. As a user with the chat window minimized or in a background browser tab, I want to receive an HTML5 Web Notification and a discreet audio ping when a new message arrives, so that I stay informed of incoming communications.

## Implementation Decisions

### 1. Monorepo Organization & Shared Contracts
- Structure codebase into three directories: `client/` (Vite, React, Tailwind CSS), `server/` (Node.js, Express, Socket.io, Prisma), and `shared/` (shared TypeScript definitions, DTOs, and event constants).
- Share contracts directly between client and server to guarantee compile-time type safety for all socket payloads and REST endpoints.
- Configure deployment roots independently: Vercel builds from `client/`, Render builds and runs from `server/`.

### 2. Complete Upfront Database Schema (Prisma on PostgreSQL)
- Deploy a unified schema covering all three specification levels from day one to eliminate future database schema migrations.
- Decouple Direct Chat and Room Chat into distinct tables:
  - `User`: Primary account record with authentication hashes and presence flags.
  - `DirectChat`: Explicit pair record with unique constraint on `(user1Id, user2Id)`.
  - `DirectChatParticipant`: Tracking join state and `lastReadMessageId` for 1-1 chats.
  - `DirectMessage`: Message record with content, `MessageType` (`TEXT`, `IMAGE`, `DOCUMENT`, `EMOJI_GIF`), optional attachment metadata, and `status` (`SENT`, `DELIVERED`, `READ`).
  - `Room`: Group entity with metadata and `ownerId`.
  - `RoomMember`: Member mapping with `RoomRole` (`OWNER`, `ADMIN`, `MEMBER`) and `lastReadMessageId`.
  - `RoomMessage`: Message record belonging to a Room with sender reference and attachment metadata.

### 3. Decoupled Socket.io Protocol
- Authenticate socket connection during the handshake via JWT token provided in the socket `auth` payload (`io.use` middleware).
- Partition event namespaces with explicit prefixes:
  - Direct Chat: `direct:send`, `direct:receive`, `direct:typing`, `direct:read`.
  - Room Chat: `room:join`, `room:leave`, `room:send`, `room:receive`, `room:typing`, `room:read`, `room:member_change`.
  - Presence: `presence:update`.

### 4. Cloud Attachment Storage & Media Constraints
- Upload image and document attachments to free-tier cloud storage (Cloudinary or Supabase Storage) rather than storing binaries in PostgreSQL or ephemeral server disk.
- Enforce a strict 10MB file limit on both client file-picker input and server upload endpoints.
- Generate client-side image preview thumbnails using object URLs prior to dispatch.

### 5. Dual-Layer Offline Synchronization
- Enable Socket.io Connection State Recovery with a 2-minute buffer window for transparent recovery from micro-disconnects.
- Implement REST Catch-up Sync endpoints (`GET /api/direct-chats/:id/messages?after=<lastMessageId>` and `GET /api/rooms/:id/messages?after=<lastMessageId>`) invoked upon reconnection after long disconnects or fresh tab launches.

### 6. Cursor-Based Pagination
- Serve chat message history in chunks of 50 messages, ordered chronologically, keyed by message timestamp/ID cursor (`?limit=50&before=<messageId>`).
- Trigger upward infinite scroll on the client to load earlier message batches smoothly without rendering overhead.

### 7. Presence Heartbeat with Grace Period
- Maintain an active socket connection registry per user on the server.
- Delay marking a user Offline by 5 seconds (`Presence Grace Period`) upon socket disconnection to prevent status flapping during browser refreshes or network handovers.

## Testing Decisions

### 1. Definition of a Good Test
- Tests must strictly evaluate observable external behavior, protocol compliance, and data contracts at integration boundaries.
- Tests must never assert internal implementation details (e.g. private controller helper functions or arbitrary state variable names).

### 2. Testing Seams
- **Primary Seam: Server Integration Boundary (API & Socket Server)**:
  - Test HTTP REST endpoints using an in-memory/test PostgreSQL instance.
  - Test real-time Socket.io flows using real `socket.io-client` instances connected over localhost against the authenticated test server.
  - Verify complete end-to-end flows: User registration -> Token issuance -> Socket handshake -> Direct message emit & receive -> Room member authorization -> Catch-up sync response -> Read receipt emission.
- **Secondary Seam: Client Component & Store Integration Boundary**:
  - Test chat container and message thread components with React Testing Library, verifying that incoming socket events update the message list, typing indicators render appropriately, and scrolling triggers pagination callbacks.

### 3. Prior Art & Conventions
- In this repository, integration tests are written in TypeScript using Vitest / Jest and Supertest, following strict arrange-act-assert structure.

## Out of Scope

- Real-time audio and video calling (WebRTC peer connections).
- End-to-end cryptographic encryption (E2EE) with client-side key exchange.
- Automated multilingual message translation.
- Message reaction badges / emoji reactions per message (emojis within message content are supported).
- Threaded message replies (nested sub-threads).

## Further Notes

- **Free-Tier Cold Starts**: Render's free web service enters sleep mode after 15 minutes of inactivity. When a cold instance wakes up, initial HTTP requests may take 30-50 seconds to respond. The frontend must display a non-blocking "Connecting to server..." connection status banner until the WebSocket handshake completes.
- **Web Notification Permissions**: Modern browsers require an explicit user interaction (click) to request the Web Notification API permission. The UI should prompt the user gently with an opt-in toggle rather than triggering the browser permission dialog unprompted on first page load.
