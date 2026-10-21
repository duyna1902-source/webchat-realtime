# 01: Direct Chat 4000-Character Limit & Anti-Clipping UI (Tracer Bullet)

**What to build:**
Establish centralized message limit constants in the shared package (`DIRECT: 4000`, `ROOM_LEADER: 4000`, `ROOM_MEMBER: 2000`). Enforce a 4000-character ceiling on Direct Chat messages end-to-end. Backend socket handlers reject direct messages exceeding 4000 characters with an error acknowledgment callback and prevent database persistence. The Direct Chat input area transitions from a single-line capsule to the approved two-tier `rounded-2xl` container with an upper auto-expanding textarea (`max-h-24` with independent scroll) and a lower auxiliary status bar displaying a live character counter (`0/4000`). Counter color cues follow Google Palette Semantics: Google Grey under 90%, Google Yellow at >=90% (3600), and Google Red at 100% (4000). The textarea enforces a hard cap via `maxLength`, automatically trims pasted clipboard text to fit the 4000-character allowance, and disables the send button when empty or over limit. All mobile responsiveness standards (`text-base sm:text-sm` 16px font size to prevent iOS Safari auto-zoom, minimum 40px touch targets, zero horizontal overflow) are preserved.

**Blocked by:** None (can start immediately).

**Status:** claimed

- [ ] Shared constants export `MESSAGE_LIMITS` with `DIRECT: 4000`, `ROOM_LEADER: 4000`, and `ROOM_MEMBER: 2000`.
- [ ] Direct Chat socket handler validates `content.length <= 4000` and rejects exceeding payloads via socket callback `{ success: false, error: ... }` without creating database records or broadcasting.
- [ ] Direct Chat input container adopts the two-tier `rounded-2xl` layout with textarea on top and right-aligned counter on bottom.
- [ ] Counter displays `0/4000` when input is empty and accurately updates as user types or pastes.
- [ ] Counter text color transitions to Google Yellow (`text-amber-500` / `#FBBC04`) when character count reaches 3600 (90%) and Google Red (`text-google-red`) at 4000 (100%).
- [ ] Textarea specifies `maxLength={4000}` and trims incoming clipboard paste text exceeding the remaining quota.
- [ ] Send button is disabled when input has 0 characters or exceeds 4000 characters.
- [ ] Multi-line input expands vertically up to 96px (`max-h-24`) with independent scrolling, ensuring typed text is never obscured or clipped by the counter.
- [ ] Mobile responsive rules are maintained: 16px base font (`text-base sm:text-sm`), minimum 40px touch targets on buttons, and no horizontal overflow.
- [ ] Automated tests cover backend socket rejection above 4000 characters and frontend component counter updates and layout behavior.
