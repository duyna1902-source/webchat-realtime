# 04: Emoji Picker Capacity Guard & Unicode Boundary Protection

**What to build:**
Protect character limits against multi-code unit Unicode characters and emoji insertions across Direct Chat and Room Chat. When selecting an emoji from the emoji picker popover, calculate whether `currentText.length + emoji.length <= activeLimit`. If inserting the emoji would push the message past the character quota, suppress the insertion and show a brief feedback indicator ("Character limit reached"). Properly handle complex Unicode emoji sequences (such as family or skin-tone modified emojis that consume up to 7 UTF-16 code units) so they are counted accurately. Additionally, ensure that when oversized pasted text is trimmed to the character limit, surrogate pairs are never split in half, preventing Unicode replacement character corruption.

**Blocked by:** 02: Room Chat Role-Based Character Limits (Tracer Bullet).

**Status:** resolved

- [x] Clicking an emoji in the emoji picker popover checks remaining character capacity before inserting.
- [x] If inserting an emoji would exceed the limit (e.g. at 3999/4000 or 1999/2000 with a 2-code-unit emoji), the insertion is blocked and input text remains intact.
- [x] A brief visual feedback message or tooltip indicates that the character limit has been reached when emoji insertion is blocked.
- [x] Multi-codepoint complex emojis (e.g. 👨‍👩‍👧‍👦) are counted correctly against the character limit.
- [x] Truncating pasted text at the boundary safely preserves complete Unicode characters without splitting surrogate pairs.
- [x] Automated tests verify emoji insertion guard behavior at character boundaries and Unicode safety.

## Answer

### Implementation Details
1. **Unicode Surrogate Pair Boundary Protection (`client/src/utils/unicode.ts`)**:
   - Implemented `truncateUnicodeSafe(text: string, maxLength: number): string`.
   - Protects against splitting UTF-16 surrogate pairs (U+10000 to U+10FFFF) by detecting if `maxLength` lands between a high surrogate (`0xD800-0xDBFF`) and a low surrogate (`0xDC00-0xDFFF`).
   - Backs off by 1 code unit when a cut would bisect a pair, preventing Unicode replacement character (`\uFFFD`) corruption.
   - Verified with unit tests covering ASCII, BMP, surrogate pair emojis, skin-tone modifiers (`👍🏽`), and multi-codepoint ZWJ sequences (`👨‍👩‍👧‍👦`).

2. **Paste Boundary Truncation (`ChatArea.tsx` & `RoomChatArea.tsx`)**:
   - Updated `handlePaste` in both Direct Chat and Room Chat to use `truncateUnicodeSafe(pastedText, remainingQuota)`.
   - If paste is attempted with zero remaining quota, suppressed with immediate feedback.

3. **Emoji Picker Capacity Guard & Visual Feedback (`ChatArea.tsx` & `RoomChatArea.tsx`)**:
   - In `handleSelectEmoji`, calculated exact remaining capacity accounting for active text selection: `inputText.length - replacedLength + emoji.length > maxLimit`.
   - If inserting the emoji exceeds `maxLimit` (e.g. at 3999/4000 or 1999/2000 with a 2-code-unit emoji, or with multi-codepoint sequences), the insertion is suppressed, input text remains intact, and a visual feedback alert `"Character limit reached"` is displayed for 3 seconds.
   - Clears the error alert automatically on subsequent valid input or typing.
   - Added complex emojis (`👍🏽`, `👨‍👩‍👧‍👦`) to `EmojiPickerPopover.tsx` for direct user selection and test coverage.

### Test Verification
- `client/src/utils/unicode.test.ts`: 6 tests passing.
- `client/src/components/chat/RichMedia.test.tsx`: 12 tests passing, including 5 new integration tests under `describe('Ticket 04: Emoji Picker Capacity Guard & Unicode Boundary Protection')`:
  * Paste truncation preserves Unicode surrogate pairs without splitting.
  * Blocks emoji insertion and displays "Character limit reached" feedback when capacity is full in Direct Chat.
  * Blocks emoji insertion when remaining capacity is 1 but emoji consumes 2 code units.
  * Counts multi-codepoint complex emojis accurately against character limit (e.g. 11 code units for `👨‍👩‍👧‍👦`).
  * Blocks emoji insertion in Room Chat when MEMBER hits 2000-character limit and shows feedback.
- Full test run across server and client workspaces:
  * Server: 14 test files passed (122 tests).
  * Client: 14 test files passed (127 tests).
  * 0 failures, 100% clean pass.
