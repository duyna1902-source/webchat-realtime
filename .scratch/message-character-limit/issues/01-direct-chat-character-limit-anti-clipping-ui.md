# 01: Direct Chat 4000-Character Limit & Anti-Clipping UI (Tracer Bullet)

**What to build:**
Establish centralized message limit constants in the shared package (`DIRECT: 4000`, `ROOM_LEADER: 4000`, `ROOM_MEMBER: 2000`). Enforce a 4000-character ceiling on Direct Chat messages end-to-end. Backend socket handlers reject direct messages exceeding 4000 characters with an error acknowledgment callback and prevent database persistence. The Direct Chat input area transitions from a single-line capsule to the approved two-tier `rounded-2xl` container with an upper auto-expanding textarea (`max-h-24` with independent scroll) and a lower auxiliary status bar displaying a live character counter (`0/4000`). Counter color cues follow Google Palette Semantics: Google Grey under 90%, Google Yellow at >=90% (3600), and Google Red at 100% (4000). The textarea enforces a hard cap via `maxLength`, automatically trims pasted clipboard text to fit the 4000-character allowance, and disables the send button when empty or over limit. All mobile responsiveness standards (`text-base sm:text-sm` 16px font size to prevent iOS Safari auto-zoom, minimum 40px touch targets, zero horizontal overflow) are preserved.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] Shared constants export `MESSAGE_LIMITS` with `DIRECT: 4000`, `ROOM_LEADER: 4000`, and `ROOM_MEMBER: 2000`.
- [x] Direct Chat socket handler validates `content.length <= 4000` and rejects exceeding payloads via socket callback `{ success: false, error: ... }` without creating database records or broadcasting.
- [x] Direct Chat input container adopts the two-tier `rounded-2xl` layout with textarea on top and right-aligned counter on bottom.
- [x] Counter displays `0/4000` when input is empty and accurately updates as user types or pastes.
- [x] Counter text color transitions to Google Yellow (`text-amber-500` / `#FBBC04`) when character count reaches 3600 (90%) and Google Red (`text-google-red`) at 4000 (100%).
- [x] Textarea specifies `maxLength={4000}` and trims incoming clipboard paste text exceeding the remaining quota.
- [x] Send button is disabled when input has 0 characters or exceeds 4000 characters.
- [x] Multi-line input expands vertically up to 96px (`max-h-24`) with independent scrolling, ensuring typed text is never obscured or clipped by the counter.
- [x] Mobile responsive rules are maintained: 16px base font (`text-base sm:text-sm`), minimum 40px touch targets on buttons, and no horizontal overflow.
- [x] Automated tests cover backend socket rejection above 4000 characters and frontend component counter updates and layout behavior.

## Answer

### Implementation Summary
1. **Shared Package Constants (`@webchat/shared`)**:
   - Created `shared/src/constants.ts` declaring:
     ```typescript
     export const MESSAGE_LIMITS = {
       DIRECT: 4000,
       ROOM_LEADER: 4000,
       ROOM_MEMBER: 2000,
     } as const;
     ```
   - Re-exported in `shared/src/index.ts` and compiled with `npm run build --workspace=shared`.

2. **Backend Socket Enforcement (`server/src/socket/direct.handler.ts`)**:
   - Added validation against `MESSAGE_LIMITS.DIRECT` on `SOCKET_EVENTS.DIRECT_SEND`.
   - Incoming payloads exceeding 4000 characters are rejected with callback `{ success: false, error: 'Message exceeds character limit of 4000' }`, preventing database insertion and avoiding message broadcasting.
   - Verified via integration tests in `server/tests/direct-chat-socket.test.ts`.

3. **Frontend Two-Tier Anti-Clipping UI (`client/src/components/chat/ChatArea.tsx`)**:
   - Replaced single-line capsule container with two-tier `rounded-2xl` container:
     - Upper tier: Auto-growing `<textarea>` bounded to `max-h-24` (96px) with independent vertical scroll.
     - Lower tier: Dedicated auxiliary bar with `data-testid="char-counter"` right-aligned.
   - Implemented dynamic Google Palette color cues:
     - Neutral (<90% / <3600 chars): `text-google-grey700`.
     - Warning (>=90% / >=3600 chars): `text-amber-500 font-semibold` (Google Yellow).
     - Exceeded / Limit (>=100% / >=4000 chars): `text-google-red font-semibold` (Google Red).
   - Hard cap enforcement:
     - `maxLength={MESSAGE_LIMITS.DIRECT}` on textarea.
     - Custom `handlePaste` that checks remaining quota and cleanly trims clipboard text to fit.
     - Guard in `handleSelectEmoji` to block emoji appending if capacity is exceeded.
     - Send button disabled if input is empty (without attachment) or `inputText.length > MESSAGE_LIMITS.DIRECT`.
   - Mobile responsive standards preserved: 16px font (`text-base sm:text-sm`), min 40px touch targets, zero horizontal overflow.

### Test Results
- **Server Tests**: 14 test files, 118 tests passed (`vitest run`).
  - Added test: `rejects direct:send when message content exceeds MESSAGE_LIMITS.DIRECT (4000 chars)`.
  - Added test: `allows direct:send at exactly MESSAGE_LIMITS.DIRECT (4000 chars)`.
- **Client Tests**: 13 test files, 112 tests passed (`vitest run`).
  - Added test suite: `Direct Chat 4000-Character Limit & Anti-Clipping UI (Ticket 01)` in `DirectChat.test.tsx` verifying initial `0/4000`, color transitions at 3600 and 4000, send button disabled states, and clipboard paste trimming.
