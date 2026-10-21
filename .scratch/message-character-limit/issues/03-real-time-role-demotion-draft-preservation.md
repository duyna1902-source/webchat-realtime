# 03: Real-Time Role Demotion Handling & Draft Preservation

**What to build:**
Handle dynamic real-time room role changes (promotions and demotions) while a user is actively composing a message in Room Chat. When an `ADMIN` or `OWNER` drafting a message between 2001 and 4000 characters is demoted to `MEMBER` via incoming socket events, their drafted text is strictly preserved rather than silently truncated or erased. The counter immediately switches to the member quota and highlights in red (e.g., `2450/2000`), an in-context warning notification informs the user that their draft exceeds the member quota, and the send button is disabled until they edit the message down to `<= 2000` characters. When a `MEMBER` is promoted to `ADMIN`, the counter seamlessly scales up to `/4000` without requiring a page reload.

**Blocked by:** 02: Room Chat Role-Based Character Limits (Tracer Bullet).

**Status:** resolved

- [x] Demoting a user from `ADMIN`/`OWNER` to `MEMBER` while drafting >2000 characters preserves the entire drafted text in the textarea without data loss.
- [x] Upon demotion with an oversized draft, the counter updates to show the exceeded ratio (e.g. `2450/2000`) styled with Google Red (`text-google-red`).
- [x] The send button is disabled while the draft length exceeds the newly assigned role limit.
- [x] A dismissible or contextual warning notice informs the user that their draft exceeds the 2000-character member limit.
- [x] Editing the message down to 2000 characters or fewer automatically re-enables the send button and returns the counter to normal or warning state.
- [x] Promoting a user from `MEMBER` to `ADMIN` while drafting immediately raises the counter limit to `/4000` without refreshing the page.
- [x] Automated component tests verify draft preservation, counter color change, and send button disabled state across role transitions.

## Answer

### Implementation Details
1. **Draft Preservation & Soft Hard-Cap**:
   - In `client/src/components/room/RoomChatArea.tsx`, dynamic `<textarea>` character enforcement binds `maxLength={Math.max(inputText.length, maxLimit)}`.
   - When a user drafting a message exceeding 2000 characters (e.g., 2450 characters) is demoted from `OWNER` or `ADMIN` to `MEMBER` (where `maxLimit = 2000`), the drafted text remains 100% intact without silent truncation or input clearing.
   - The user is prevented from typing additional characters while their draft exceeds or equals the limit, but can freely backspace/edit down.

2. **In-Context Warning Alert & Dismissal**:
   - Added a contextual warning alert (`data-testid="draft-demotion-warning"`) rendered in the input footer when `inputText.length > maxLimit && !isWarningDismissed`.
   - Styled with Google Red semantics (`bg-google-red-subtle border border-google-red/20 text-google-red rounded-xl`).
   - Includes a manual dismiss button (`X` icon) that sets `isWarningDismissed(true)`.
   - Automatically resets and disappears when the user edits their draft down to `<= 2000` characters, or when room roles transition.

3. **Disabled Send Button & Counter Reaction**:
   - Send button is disabled when `inputText.length > maxLimit`.
   - Counter immediately displays the exceeded quota (e.g., `2450/2000`) in `text-google-red font-semibold`.
   - Once edited down to `<= 2000`, the send button becomes active immediately and the counter returns to Google Yellow (if >= 1800) or Google Grey (< 1800).

4. **Dynamic Promotion Handling**:
   - When a `MEMBER` drafting a message (e.g., 1500 characters) is promoted to `ADMIN`, the quota immediately scales up from `2000` to `4000` (`1500/4000`) without requiring a page reload.

### Automated Test Coverage
- Enhanced `client/src/components/room/RoomChat.test.tsx` with comprehensive integration tests:
  - `preserves draft and displays demotion warning and disabled send button when demoted from ADMIN to MEMBER`
  - `clears demotion warning and enables send button when user edits draft down to <= 2000 chars`
  - `allows manually dismissing the draft demotion warning without altering the draft`
  - `seamlessly scales up counter to /4000 when promoted from MEMBER to ADMIN without page reload`
- Full test suites pass cleanly across both client and server:
  - Client: 13 test files passed, 120 tests passed.
  - Server: 14 test files passed, 122 tests passed.
