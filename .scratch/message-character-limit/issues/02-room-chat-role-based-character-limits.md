# 02: Room Chat Role-Based Character Limits (Tracer Bullet)

**What to build:**
Implement role-differentiated message character limits for Room Chat end-to-end. Backend socket handlers retrieve the sender's actual database role for the room: `OWNER` and `ADMIN` are allowed up to 4000 characters, while `MEMBER` is capped at 2000 characters. Any room message violating its role's threshold is rejected with an error acknowledgment callback and dropped from database storage. The Room Chat input area adopts the approved two-tier `rounded-2xl` layout, dynamically calculating the active character quota from the user's room role: displaying `X/2000` for members and `X/4000` for owners/admins. Counter transitions to Google Yellow at 90% (1800 for members, 3600 for leaders) and Google Red at 100% (2000 for members, 4000 for leaders). Textarea enforces `maxLength` and paste trimming based on the active role limit, and maintains all mobile responsiveness guarantees.

**Blocked by:** 01: Direct Chat 4000-Character Limit & Anti-Clipping UI (Tracer Bullet).

**Status:** resolved

- [x] Room Chat socket handler retrieves sender's `RoomMember.role` and enforces limits: 4000 characters for `OWNER` and `ADMIN`, 2000 characters for `MEMBER`.
- [x] Messages exceeding the sender's role threshold are rejected with an error callback and not saved to the database.
- [x] Room Chat input container adopts the two-tier `rounded-2xl` layout with textarea on top and counter on bottom.
- [x] Counter dynamically reflects user role: displays `X/2000` for `MEMBER` and `X/4000` for `OWNER` / `ADMIN`.
- [x] Counter color transitions to Google Yellow at 90% (1800 for member, 3600 for leader) and Google Red at 100% (2000 for member, 4000 for leader).
- [x] Textarea binds `maxLength` to the active role quota and trims pasted text exceeding the quota.
- [x] Send button is disabled when input is empty or exceeds the active role limit.
- [x] Textarea auto-expands up to `max-h-24` with independent scroll without text clipping or counter collision.
- [x] Mobile responsive font sizing (`text-base sm:text-sm`) and 40px touch targets are preserved.
- [x] Automated integration tests verify backend role quota enforcement and frontend component role-aware counter behavior.

## Answer

### Implementation Summary
1. **Backend Role Quota Validation (`server/src/socket/room.handler.ts`)**:
   - In `SOCKET_EVENTS.ROOM_SEND`, evaluated sender's `RoomMember.role` retrieved from the database.
   - Assigned `MESSAGE_LIMITS.ROOM_LEADER` (4000 characters) for `OWNER` and `ADMIN`, and `MESSAGE_LIMITS.ROOM_MEMBER` (2000 characters) for `MEMBER`.
   - Incoming payloads exceeding the role threshold are immediately rejected via acknowledgment callback `{ success: false, error: 'Message exceeds character limit of ...' }` and dropped without database insertion or broadcast.

2. **Frontend Dynamic Role Quota & Anti-Clipping Container (`client/src/components/room/RoomChatArea.tsx`)**:
   - Evaluated active user role dynamically from `roomDetails.members`, fallback `activeRoom.role`, or `activeRoom.ownerId`.
   - Converted the single capsule input container into the approved two-tier `rounded-2xl` flex container with the `<textarea>` on the top tier and the auxiliary counter bar (`data-testid="char-counter"`) on the bottom tier.
   - Dynamic counter formatted as `{charCount}/{maxLimit}` with Google Palette Semantics:
     - Neutral `text-google-grey700` below 90%.
     - Google Yellow `text-amber-500 font-semibold` at $\ge$ 90% (1800 for members, 3600 for leaders).
     - Google Red `text-google-red font-semibold` at 100% or above (2000 for members, 4000 for leaders).
   - Set dynamic `maxLength={maxLimit}` on the textarea.
   - Added `handlePaste` to automatically slice clipboard text that exceeds remaining capacity.
   - Guarded emoji picker insertion against exceeding `maxLimit`.
   - Disabled send button when input is empty/whitespace-only (without file attachment) or when `inputText.length > maxLimit`.
   - Preserved `text-base sm:text-sm` (preventing iOS zooming) and minimum 40px touch targets for mobile responsiveness.

3. **Automated Test Coverage**:
   - **Backend Socket Tests (`server/tests/room-socket.test.ts`)**:
     - Verified rejection of messages > 2000 characters for `MEMBER` with error callback and zero DB persistence.
     - Verified acceptance and broadcast of messages at exactly 2000 characters for `MEMBER`.
     - Verified acceptance and broadcast of messages up to 4000 characters for both `OWNER` and `ADMIN`.
     - Verified rejection of messages > 4000 characters for both `OWNER` and `ADMIN` with error callback and zero DB persistence.
   - **Frontend Component Tests (`client/src/components/room/RoomChat.test.tsx`)**:
     - Verified counter displays `0/2000` with `maxLength="2000"` for `MEMBER`, and `0/4000` with `maxLength="4000"` for `OWNER` and `ADMIN`.
     - Verified color transitions from grey to yellow at 90% (1800 member, 3600 leader) and red at 100% (2000 member, 4000 leader).
     - Verified send button disable logic on empty input, whitespace, and length > limit.
     - Verified clipboard paste trimming to active quota for member (2000) and leader (4000).

### Test Results
- Server test suite: 14 test files, 122 tests passed (100%).
- Client test suite: 13 test files, 116 tests passed (100%).
- Full `npm test`: clean pass across server and client.
