# 03: Real-Time Role Demotion Handling & Draft Preservation

**What to build:**
Handle dynamic real-time room role changes (promotions and demotions) while a user is actively composing a message in Room Chat. When an `ADMIN` or `OWNER` drafting a message between 2001 and 4000 characters is demoted to `MEMBER` via incoming socket events, their drafted text is strictly preserved rather than silently truncated or erased. The counter immediately switches to the member quota and highlights in red (e.g., `2450/2000`), an in-context warning notification informs the user that their draft exceeds the member quota, and the send button is disabled until they edit the message down to `<= 2000` characters. When a `MEMBER` is promoted to `ADMIN`, the counter seamlessly scales up to `/4000` without requiring a page reload.

**Blocked by:** 02: Room Chat Role-Based Character Limits (Tracer Bullet).

**Status:** ready-for-agent

- [ ] Demoting a user from `ADMIN`/`OWNER` to `MEMBER` while drafting >2000 characters preserves the entire drafted text in the textarea without data loss.
- [ ] Upon demotion with an oversized draft, the counter updates to show the exceeded ratio (e.g. `2450/2000`) styled with Google Red (`text-google-red`).
- [ ] The send button is disabled while the draft length exceeds the newly assigned role limit.
- [ ] A dismissible or contextual warning notice informs the user that their draft exceeds the 2000-character member limit.
- [ ] Editing the message down to 2000 characters or fewer automatically re-enables the send button and returns the counter to normal or warning state.
- [ ] Promoting a user from `MEMBER` to `ADMIN` while drafting immediately raises the counter limit to `/4000` without refreshing the page.
- [ ] Automated component tests verify draft preservation, counter color change, and send button disabled state across role transitions.
