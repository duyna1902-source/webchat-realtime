# 04: Emoji Picker Capacity Guard & Unicode Boundary Protection

**What to build:**
Protect character limits against multi-code unit Unicode characters and emoji insertions across Direct Chat and Room Chat. When selecting an emoji from the emoji picker popover, calculate whether `currentText.length + emoji.length <= activeLimit`. If inserting the emoji would push the message past the character quota, suppress the insertion and show a brief feedback indicator ("Character limit reached"). Properly handle complex Unicode emoji sequences (such as family or skin-tone modified emojis that consume up to 7 UTF-16 code units) so they are counted accurately. Additionally, ensure that when oversized pasted text is trimmed to the character limit, surrogate pairs are never split in half, preventing Unicode replacement character corruption.

**Blocked by:** 02: Room Chat Role-Based Character Limits (Tracer Bullet).

**Status:** ready-for-agent

- [ ] Clicking an emoji in the emoji picker popover checks remaining character capacity before inserting.
- [ ] If inserting an emoji would exceed the limit (e.g. at 3999/4000 or 1999/2000 with a 2-code-unit emoji), the insertion is blocked and input text remains intact.
- [ ] A brief visual feedback message or tooltip indicates that the character limit has been reached when emoji insertion is blocked.
- [ ] Multi-codepoint complex emojis (e.g. 👨‍👩‍👧‍👦) are counted correctly against the character limit.
- [ ] Truncating pasted text at the boundary safely preserves complete Unicode characters without splitting surrogate pairs.
- [ ] Automated tests verify emoji insertion guard behavior at character boundaries and Unicode safety.
