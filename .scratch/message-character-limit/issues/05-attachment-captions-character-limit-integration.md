# 05: Attachment Captions Character Limit & Counter Integration

**What to build:**
Extend the message character limit and visual counter to attachment captions across Direct Chat and Room Chat. When a user selects an image or document to upload, the attachment caption input adopts the same two-tier `rounded-2xl` container, character limits (4000 for Direct Chat & Room Leaders, 2000 for Room Members), and live counter (`X/4000` or `X/2000`). Counter colors follow Google Palette Semantics (Google Grey <90%, Google Yellow >=90%, Google Red 100%), and the send button is disabled if the caption exceeds the limit. Backend socket handlers for both direct and room messages validate `content.length` on attachment messages (where `attachmentUrl` is present), ensuring no anti-spam bypass exists through attachment captions.

**Blocked by:** 02: Room Chat Role-Based Character Limits (Tracer Bullet).

**Status:** resolved

- [x] Attachment caption input in Direct Chat displays a live counter formatted as `X/4000`.
- [x] Attachment caption input in Room Chat displays a role-aware counter (`X/2000` for members, `X/4000` for leaders).
- [x] Caption counter adheres to Google Palette color thresholds (<90% grey, >=90% yellow, 100% red).
- [x] Caption textarea enforces `maxLength` and trims pasted text exceeding the remaining limit.
- [x] Send button is disabled if the attachment caption exceeds the character limit.
- [x] Backend socket handlers reject attachment messages whose caption exceeds the allowed character quota with an error callback.
- [x] Mobile responsive layout and touch targets are maintained for the attachment preview and caption input area.
- [x] Automated tests verify end-to-end socket validation for attachment captions and frontend caption counter behavior.

## Answer

### Implementation Details
1. **Server Socket Enforcements (`server/src/socket/direct.handler.ts` & `server/src/socket/room.handler.ts`)**:
   - In `direct:send`, `content.length` is strictly validated against `MESSAGE_LIMITS.DIRECT` (4000) regardless of whether an attachment is present (`attachmentUrl`). If the caption exceeds 4000 characters, the socket handler returns `{ success: false, error: 'Message exceeds character limit of 4000' }` via the acknowledgment callback, completely bypassing Prisma database writes and recipient socket emissions.
   - In `room:send`, the sender's membership role is determined dynamically (`OWNER`/`ADMIN` -> `MESSAGE_LIMITS.ROOM_LEADER` = 4000, `MEMBER` -> `MESSAGE_LIMITS.ROOM_MEMBER` = 2000). If the caption exceeds the sender's role quota, the handler acknowledges with `{ success: false, error: 'Message exceeds character limit of ...' }` without persisting to `RoomMessage` or broadcasting to the room channel.

2. **Backend Socket Automated Tests (`server/tests/attachment-message.test.ts`)**:
   - Added integration test suite `Attachment Captions Character Limit & Counter Integration (Ticket 05)`.
   - Verified that direct attachment messages with captions > 4000 characters fail with `{ success: false, error: 'Message exceeds character limit of 4000' }`, are not persisted to `directMessage`, and are not broadcast via `direct:receive`.
   - Verified that room attachment messages with member captions > 2000 characters fail with `{ success: false, error: 'Message exceeds character limit of 2000' }`, with zero DB persistence and no room broadcast.
   - Verified that room attachment messages with leader captions > 4000 characters fail with `{ success: false, error: 'Message exceeds character limit of 4000' }`.
   - Verified that room attachment messages with exact boundary captions (2000 for member, 4000 for leader) succeed and broadcast full attachment payloads cleanly.

3. **Frontend Mobile Responsiveness & Touch Targets (`client/src/components/chat/AttachmentPreview.tsx`)**:
   - Added `min-w-[40px] min-h-[40px] flex items-center justify-center` to attachment preview action buttons (`onCancel` and `onSend`) to guarantee compliance with the 40px touch hit target requirements on mobile viewports.
   - Maintained two-tier `rounded-2xl` layout and dynamic textarea height up to `max-h-24` in `ChatArea.tsx` and `RoomChatArea.tsx`, ensuring independent scrolling and preventing character counter overlap.

4. **Frontend Caption Counter & Boundary Enforcement (`client/src/components/chat/Attachment.test.tsx`)**:
   - Added comprehensive integration test suite `Attachment Captions Character Limit & Counter Integration (Ticket 05)` testing `ChatArea` and `RoomChatArea`.
   - Verified live counter display formatted as `0/4000` (Direct & Room Leader) and `0/2000` (Room Member) upon selecting an attachment file.
   - Verified Google Palette color transitions: `<90%` neutral Google Grey (`text-google-grey700`), `>=90%` Google Yellow (`text-amber-500`), and `100%` Google Red (`text-google-red`).
   - Verified clipboard paste trimming: pasting clipboard text that exceeds remaining caption quota truncates to the ceiling without corrupting input.
   - Verified send button state: enabled with an attachment and empty/valid caption, disabled when caption exceeds allowable quota.
   - Verified touch target sizing (`min-w-[40px] min-h-[40px]`) on both attachment preview cancel button and message send button.

### Test Results
- Server vitest suite: 14 test files passed, 126/126 tests passed.
- Client vitest suite: 13 test files passed, 122/122 tests passed.
- TypeScript build (`shared`, `server`, `client` with `vite build`): All 3 workspaces built with 0 errors.
