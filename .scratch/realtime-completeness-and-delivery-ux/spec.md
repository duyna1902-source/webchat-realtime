# Spec: Real-Time Completeness, Delivery Status UX, and Document Preview

Status: ready-for-agent

## Problem Statement

While the foundational features across all three technical requirement levels of the GDG-HUST real-time messaging platform are present, several critical user-facing and real-time lifecycle gaps remain:
1. **Invisible & Ambiguous Delivery Status (`Sent`, `Delivered`, `Seen`)**: Outgoing message bubbles use a Google Blue background while the read status indicator also uses Google Blue text, causing `Read Receipt` indicators to become completely invisible against the bubble background. Furthermore, tiny checkmarks without text labels fail to clearly distinguish `Sent`, `Delivered`, and `Seen`, and messages sent while a recipient is offline (`SENT`) never automatically upgrade to `DELIVERED` when the recipient comes back online.
2. **Missing Unread Count Badges & Blank Media Previews in Sidebar**: Although the backend calculates unread message counts for each `Direct Chat` and `Room Chat`, the conversation sidebar does not render `Unread Count Badge` pills or update them in real time. Additionally, when the latest message in a conversation is an image, document, or GIF without a text caption, the sidebar preview renders an empty blank line or a raw URL instead of a friendly media description.
3. **Disconnected Background Room Chat Events & Notifications**: Users only join a `Room Chat` socket channel when actively viewing that room and leave the channel as soon as they switch to another conversation. As a result, users miss real-time `Room Message` updates, `Unread Count Badge` increments, and background notifications for other rooms they belong to. Moreover, when a `Room Member` is added, kicked, or when an `OWNER` deletes a room, affected users do not immediately see the room added or removed from their sidebar or active view.
4. **Incomplete Notification Context**: Audio pings only fire when the entire browser tab is hidden, providing no subtle audio feedback when a user is actively looking at Conversation A while a new message arrives in Conversation B.
5. **Lack of In-App Document Preview**: Unlike image attachments which support an in-app lightbox, clicking a document `Attachment` forces a file download rather than offering an in-app `Document Preview` modal for readable formats (`PDF`, `TXT`, `MD`, `CSV`, `JSON`, `XML`) and a structured summary view for binary files.
6. **Partial Catch-up Sync, Ephemeral Temp File Leaks, and Residual Legacy Colors**: Sidebar conversation lists and presence states do not refresh automatically upon socket reconnection after prolonged network loss, `Catch-up Sync` skips conversations that had zero messages prior to disconnection, cloud storage uploads leave temporary files behind on local disk, and several secondary media/attachment components still use legacy indigo color classes instead of `Google Palette Semantics`.

## Solution

Deliver a cohesive completeness and UX upgrade across the real-time protocol and frontend workspace:
1. **Checkmark-Free English Delivery Status & Single-Watermark Read Receipts (Variant B)**:
   - Replace all checkmark icons with minimalist, single-language English inline status text and mini-avatars rendered directly **below** outgoing message bubbles on the light canvas background:
     - **`SENT`**: Minimalist inline text **`Sent`** (`text-[11px] text-google-grey700/80`) rendered below the latest outgoing message when not yet delivered.
     - **`DELIVERED`**: Minimalist inline text **`Delivered`** (`text-[11px] font-semibold text-google-grey700`) rendered below the latest outgoing message when delivered.
     - **`READ` (`Seen`)**: Minimalist inline text **`Seen`** paired with the recipient's 16px circular **Mini-Avatar** (`text-[11px] font-semibold text-google-blue`) rendered **only below the latest outgoing message that has status `READ`**. When a newer outgoing message is seen by the recipient, the `Seen` indicator below any older message **disappears** and moves to the newest seen message.
   - In `Room Chat`, display **`Sent`** below the latest outgoing message when `readers.length === 0`, and render **`Seen by N`** alongside up to 3 stacked 16px **Mini-Avatars** of readers (with a tooltip listing reader usernames) below messages matching those members' `lastReadMessageId` (automatically disappearing from older messages as members read newer messages).
   - In the conversation sidebar, prefix outgoing last messages with `You: ` and display a compact status indicator (`Sent`, `Delivered`, or recipient Mini-Avatar for `Seen`) without checkmarks.
   - Automatically upgrade pending `SENT` direct messages to `DELIVERED` on the server as soon as the recipient connects, notifying the sender in real time via a `direct:delivered` event.

2. **Real-Time Unread Count Badges & Friendly Media Snippets**:
   - Render a prominent Google Blue `Unread Count Badge` (`99+` when exceeding 99) and bold message preview text on any `Direct Chat` or `Room Chat` row in the sidebar with `unreadCount > 0`.
   - Increment `unreadCount` in real time when messages arrive from other users in inactive conversations, and reset `unreadCount` to `0` immediately when opening the conversation or emitting a `Read Receipt`.
   - Format captionless media messages in sidebar previews as `📷 Sent an image` (for images), `📎 <filename>` (for documents), and `✨ Sent a GIF` (for GIFs).

3. **Persistent Background Room Subscriptions & Membership Lifecycle Sync**:
   - Automatically subscribe each authenticated user's socket to all `Room Chat` channels they are a member of upon connection, and maintain those subscriptions across UI tab/conversation switches.
   - Broadcast membership additions (`JOIN`), removals (`KICK`), leaves (`LEAVE`), role changes (`ROLE_CHANGE`), and room deletions (`DELETE`) to both the room channel and targeted user channels so the sidebar updates immediately and active views close gracefully to the idle placeholder if the user is kicked or the room is deleted.

4. **Context-Aware Notifications**:
   - When notifications are enabled and a message arrives from another user:
     - If the browser tab is hidden, play the audio notification ping and trigger an HTML5 browser notification.
     - If the browser tab is visible and the message belongs to a conversation other than the currently open conversation, play the discreet audio ping and increment the `Unread Count Badge` without spawning a redundant OS popup.

5. **In-App Document Preview Modal**:
   - Clicking a document `Attachment` in any chat opens a `Document Preview` modal:
     - Renders `PDF` files inline via an embedded frame viewer.
     - Fetches and renders text-based documents (`TXT`, `MD`, `CSV`, `JSON`, `XML`) in a formatted, scrollable code/text viewer.
     - Displays a structured file metadata card with a prominent **"Download to view"** action for binary office/archive formats (`DOCX`, `XLSX`, `PPTX`, `ZIP`, etc.), while providing a direct Download button across all document types.

6. **Full Reconnection Sync, Temp File Cleanup & Google Palette Alignment**:
   - Refresh sidebar conversation lists (`Direct Chat` and `Room Chat`) and execute `Catch-up Sync` on socket reconnection even when the open conversation previously had zero messages.
   - Automatically delete temporary local upload files after cloud storage adapters (`Cloudinary` / `Supabase`) finish uploading.
   - Replace all remaining legacy indigo color classes in attachment cards, preview bars, emoji pickers, GIF modals, and loading screens with `Google Palette Semantics`.

## User Stories

1. As a sender in a `Direct Chat`, I want to see a clear **`Sent`** label below my latest outgoing message when the recipient is offline, so that I know the server has recorded my message without relying on ambiguous checkmarks.
2. As a sender in a `Direct Chat`, I want my outgoing message status label to automatically change from **`Sent`** to **`Delivered`** the moment my offline partner connects to the platform, so that I have real-time confirmation that their device received the message.
3. As a sender in a `Direct Chat`, I want to see **`Seen`** paired with my partner's 16px circular **Mini-Avatar** below my latest seen outgoing message — and have the `Seen` indicator automatically disappear from older messages when my partner sees a newer message — so that `Read Receipt` status is a clean, unmistakable watermark.
4. As a sender in a `Room Chat`, I want to see a **`Sent`** label below my latest outgoing message when no other members have read it yet, so that I know my room message was posted.
5. As a participant in a `Room Chat`, I want to see **`Seen by N`** alongside stacked **Mini-Avatars** of the members who have read up to that message below the bubble (moving down and disappearing from older messages as members read newer messages), so that I can immediately tell how many and which teammates have seen my update.
6. As a user glancing at the conversation sidebar, I want my own latest messages to be prefixed with `You: ` and paired with a compact `Sent`, `Delivered`, or Mini-Avatar `Seen` indicator, so that I can track delivery progress directly from the conversation list.
7. As a user viewing the conversation sidebar, I want to see a Google Blue `Unread Count Badge` and bold preview text on any `Direct Chat` or `Room Chat` that has unread messages, so that I can spot pending conversations at a glance.
8. As a user actively chatting in one conversation while a message arrives in another `Direct Chat` or `Room Chat`, I want the `Unread Count Badge` on that other conversation to increment in real time and move to the top of the list, so that I never miss background activity.
9. As a user clicking on a `Direct Chat` or `Room Chat` that has an `Unread Count Badge`, I want the badge to clear to zero immediately upon opening the conversation, so that the unread state accurately reflects my reading progress.
10. As a user viewing the sidebar when the latest message is an image, document, or GIF without a text caption, I want to see a descriptive label (`📷 Sent an image`, `📎 filename.pdf`, or `✨ Sent a GIF`), so that the preview line is never blank or cluttered with raw URLs.
11. As a member of multiple `Room Chat` spaces, I want to receive real-time messages, unread badge updates, and notifications from all of my rooms even while I am viewing a `Direct Chat` or a different room, so that switching views never disconnects me from my groups.
12. As a user who has just been added to a `Room Chat` by an owner or admin, I want the new room to appear in my `Rooms` sidebar list immediately in real time without refreshing the browser, so that I can join the discussion right away.
13. As a `Room Member` who is removed (`KICK`) from a `Room Chat` while viewing it, I want the room to be removed from my sidebar and my detail pane to transition cleanly back to the idle placeholder, so that I am not stuck in a broken or unauthorized view.
14. As a `Room Member` viewing a `Room Chat` when the `OWNER` deletes the room (`DELETE`), I want the room to disappear from my sidebar and close back to the idle placeholder automatically in real time, so that all members stay synchronized with the room lifecycle.
15. As a user with notifications enabled who has the browser tab minimized or in the background, I want to receive both an HTML5 browser notification and a gentle audio ping when a new `Direct Message` or `Room Message` arrives from someone else, so that I am alerted while working in other applications.
16. As a user with notifications enabled who is actively viewing Conversation A in the foreground tab when a message arrives in Conversation B, I want to hear a gentle audio ping and see Conversation B's `Unread Count Badge` increment without an intrusive OS popup notification, so that I am notified smoothly.
17. As a user clicking on a `PDF` document `Attachment` in a conversation, I want an in-app `Document Preview` modal to open and render the PDF pages inline alongside a Download button, so that I can read the document without leaving the chat.
18. As a user clicking on a text-based document `Attachment` (`TXT`, `MD`, `CSV`, `JSON`, `XML`) in a conversation, I want the `Document Preview` modal to display the formatted text content inline with a Download button, so that I can inspect logs, notes, or data files immediately.
19. As a user clicking on a binary office or archive `Attachment` (`DOCX`, `XLSX`, `PPTX`, `ZIP`) in a conversation, I want the `Document Preview` modal to display complete file metadata (name, size, format badge) and a clear **"Download to view"** button, so that every document interaction is consistent and predictable.
20. As a user whose network connection drops and reconnects after a prolonged outage, I want both the sidebar conversation lists (including `Presence` and `Unread Count Badge` counts) and the active conversation's missed messages to synchronize automatically, even if the active conversation had zero messages before the outage.
21. As a system administrator deploying the server on free-tier cloud infrastructure with external cloud storage enabled, I want temporary uploaded files on the server disk to be deleted automatically after cloud upload completes, so that ephemeral server disk space is never exhausted.
22. As a GDG-HUST community member interacting with attachment cards, composer previews, emoji pickers, and GIF search modals, I want all interactive highlights and badges to use official `Google Palette Semantics` (`google-blue`, `google-grey`), so that the visual identity is 100% consistent across every component.

## Implementation Decisions

- **Protocol Extension for Delivery Status & Room Lifecycle (`@webchat/shared`)**:
  - Add `DIRECT_DELIVERED: 'direct:delivered'` to the shared socket event constants and define `DirectDeliveredPayload` (`{ directChatId: string; deliveredToUserId: string }`).
  - Extend `RoomMemberChangePayload['action']` union type to include `'DELETE'` alongside `'JOIN' | 'LEAVE' | 'KICK' | 'ROLE_CHANGE'`.

- **Server Auto-Delivery Upgrade & Persistent Room Channel Subscription**:
  - Upon user socket connection, query all `DirectMessage` records addressed to the connecting user (in chats where they are a participant and `senderId !== userId`) with status `SENT`, update them to `DELIVERED`, and emit `direct:delivered` to each corresponding sender's personal room (`user:${senderId}`).
  - Upon user socket connection, query all `RoomMember` memberships for the connecting user and automatically join their socket to every `room:${roomId}` channel.
  - When a new member is added to a room (`addRoomMember`), join any active sockets of the target user to `room:${id}` and emit `room:member_change` (`action: 'JOIN'`) to both `room:${id}` and `user:${targetUserId}`.
  - When a member is removed (`removeRoomMember`), emit `room:member_change` (`action: 'KICK'`) to `room:${id}` and `user:${targetUserId}`, then remove the target user's active sockets from `room:${id}`.
  - When a room is deleted (`deleteRoom`), emit `room:member_change` (`action: 'DELETE'`) to `room:${id}` before deleting the room record and clearing the `room:${id}` socket channel.

- **Ephemeral Upload File Cleanup**:
  - In the cloud storage upload flow (`Cloudinary` and `Supabase` adapters), wrap the remote upload call in a `try / finally` block that removes the temporary local file from disk (`fs.promises.unlink`) whenever a local file path exists, while leaving `LocalStorageAdapter` behavior unchanged.

- **Checkmark-Free Minimalist Status Labels & Single-Watermark Mini-Avatar Read Receipts (Variant B)**:
  - Remove `<Check />` and `<CheckCheck />` icons from message bubbles in both `Direct Chat` and `Room Chat`.
  - Compute the status watermark across `messages` in `Direct Chat`:
    - `lastReadOutgoingId`: the `id` of the last outgoing message (`senderId === currentUser.id`) with `status === MessageStatus.READ`.
    - `lastOutgoingId`: the `id` of the last outgoing message overall.
  - Render a dedicated minimalist status line immediately below outgoing message bubbles (`isMe`):
    - `SENT` (rendered only when `msg.id === lastOutgoingId`): `<div data-testid="status-sent" title="Sent">Sent</div>` styled as `mt-0.5 text-[11px] text-google-grey700/80`.
    - `DELIVERED` (rendered only when `msg.id === lastOutgoingId`): `<div data-testid="status-delivered" title="Delivered">Delivered</div>` styled as `mt-0.5 text-[11px] font-semibold text-google-grey700`.
    - `READ` (rendered **only** when `msg.id === lastReadOutgoingId`, so older seen messages hide their `Seen` indicator once a newer message is seen): `<div data-testid="status-read" title="Đã xem">...</div>` styled as `mt-1 flex items-center justify-end gap-1 text-[11px] font-semibold text-google-blue`, containing `<span>Seen</span>` and the partner's 16px circular initial/image Mini-Avatar.
  - In `Room Chat`, hide the 32px sender avatar circle on outgoing messages (`!isMe` only, aligning outgoing bubbles cleanly to the right edge), render `Sent` below the latest outgoing message (`msg.id === lastOutgoingRoomMsgId`) when `readers.length === 0`, and render `<div data-testid="room-message-read-indicator">` below any message where `readers.length > 0` showing `Seen by ${readers.length}` plus up to 3 stacked 16px Mini-Avatars of readers.

- **Real-Time Unread Count State & Sidebar Media Snippets**:
  - Pass `activeChatId` into the direct chats state hook and `activeRoomId` into the rooms state hook (or coordinate via dashboard selection handlers).
  - When `direct:receive` or `room:receive` fires for a conversation that is not currently active and `msg.senderId !== currentUser.id`, increment that item's `unreadCount` by 1.
  - When a user selects a conversation or when `direct:read` / `room:read` is emitted for the active conversation, reset that conversation's `unreadCount` to `0`.
  - Do not emit `room:leave` when merely switching the active conversation in the UI, so the client remains subscribed to all joined rooms in the background.
  - Create a shared helper to format sidebar `lastMessage` preview text: if `content` is non-empty (and `type !== EMOJI_GIF`), show `content`; if `type === IMAGE`, show `📷 Sent an image`; if `type === DOCUMENT`, show `📎 ${attachmentName || 'Document'}`; if `type === EMOJI_GIF`, show `✨ Sent a GIF`. Prefix with `You: ` when `senderId === currentUser.id`.

- **In-App Document Preview Modal**:
  - Build a dedicated `DocumentPreviewModal` component triggered when clicking a document card or its preview button in a message bubble.
  - Determine preview mode from file extension / MIME type:
    - PDF (`.pdf`): render `<iframe src={url} title={name} />` inside the modal body.
    - Text (`.txt`, `.md`, `.csv`, `.json`, `.xml`): fetch text content from `attachmentUrl` and render inside a scrollable monospace `<pre>` container.
    - Other binary documents: render a clean metadata summary card with a prominent **"Download to view"** button.
  - Always include a top-right Download action and Close button in the modal header.

- **Reconnection Catch-Up & Google Palette Consistency**:
  - Subscribe `useDirectChats` and `useRooms` to the socket `connect` event to refresh conversation lists and presence states after reconnection.
  - Update `syncCatchup` in `useDirectMessages` and `useRoomMessages` so that if `messagesRef.current` is empty upon unrecovered reconnection, it fetches the initial message batch (`?limit=50`) instead of returning early.
  - Replace all legacy `indigo-*` classes across attachment cards, attachment preview bars, emoji picker popovers, GIF search modals, and app loading states with `google-blue` and `google-grey` tokens.
  - Preserve the existing top navigation bar (`<header>` in `Dashboard.tsx`: `[GDG Logo] GDG-HUST | Welcome, <username>!` on the left and `[Notification Bell] [● Connected] [User Avatar] [Sign Out]` on the right) completely unchanged.

## Testing Decisions

- **Definition of a Good Test**:
  - Tests must assert strictly on observable user behavior, rendered DOM elements, accessibility attributes, and real-time socket/HTTP contract boundaries — never on internal component state names or private helper functions.
- **Primary Testing Seams**:
  1. **Server Integration Seam (`server/tests/`)**:
     - Verify `SENT` $\rightarrow$ `DELIVERED` automatic transition and `direct:delivered` socket emission when an offline recipient connects (`read-receipts.test.ts` / `direct-chat-socket.test.ts`).
     - Verify automatic socket subscription to member rooms on connect, real-time `room:member_change` delivery to newly added or kicked users, and `action: 'DELETE'` broadcast on room deletion (`room-socket.test.ts`).
     - Verify temporary file cleanup after cloud storage adapter upload (`upload.test.ts`).
  2. **Client Component & Workspace Integration Seam (`client/src/`)**:
     - Verify checkmark-free minimalist `Sent`, `Delivered`, and `Seen [Mini-Avatar]` (`Read Receipt`) labels in `Direct Chat` (including single-watermark behavior where `Seen` disappears from older messages once a newer message is read), `Seen by N [Mini-Avatars]` in `Room Chat`, hiding the sender's own 32px avatar on outgoing `Room Chat` messages, and live transition on `direct:delivered` and `direct:read` (`ReadReceiptsPagination.test.tsx`).
     - Verify `Unread Count Badge` rendering, real-time increment on background messages, reset on selection, and friendly media snippet formatting (`📷 Sent an image`, `📎 ...`, `✨ Sent a GIF`) in the sidebar (`DirectChat.test.tsx` / `ResponsiveDashboard.test.tsx`).
     - Verify `Document Preview` modal opening and rendering for PDF, text, and binary document attachments (`Attachment.test.tsx`).
     - Verify context-aware audio ping and browser notification behavior for foreground inactive vs. background tabs, and full reconnection catch-up sync when a chat starts with 0 messages (`ReconnectionSync.test.tsx`).
- **Prior Art**:
  - Server integration tests in `server/tests/read-receipts.test.ts`, `server/tests/room-socket.test.ts`, and `server/tests/upload.test.ts`.
  - Client component integration tests in `client/src/components/chat/ReadReceiptsPagination.test.tsx`, `client/src/components/chat/Attachment.test.tsx`, and `client/src/components/common/ReconnectionSync.test.tsx`.

## Out of Scope

- Web Push API with background Service Workers and VAPID keys (notifications when the browser application is completely closed).
- Server-side document conversion (e.g. LibreOffice / third-party cloud transcoding of `.docx` or `.xlsx` into PDFs).
- Per-message emoji reaction badges or threaded message replies.

## Further Notes

- Uses domain terminology defined in `GLOSSARY.md` (`Delivery Status`, `Read Receipt`, `Unread Count Badge`, `Document Preview`, `Catch-up Sync`, `Google Palette Semantics`).
- Follows architectural decisions recorded in `docs/adr/0008-background-room-subscription-and-delivery-tracking.md`.
