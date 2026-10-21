# 02: Room Chat Role-Based Character Limits (Tracer Bullet)

**What to build:**
Implement role-differentiated message character limits for Room Chat end-to-end. Backend socket handlers retrieve the sender's actual database role for the room: `OWNER` and `ADMIN` are allowed up to 4000 characters, while `MEMBER` is capped at 2000 characters. Any room message violating its role's threshold is rejected with an error acknowledgment callback and dropped from database storage. The Room Chat input area adopts the approved two-tier `rounded-2xl` layout, dynamically calculating the active character quota from the user's room role: displaying `X/2000` for members and `X/4000` for owners/admins. Counter transitions to Google Yellow at 90% (1800 for members, 3600 for leaders) and Google Red at 100% (2000 for members, 4000 for leaders). Textarea enforces `maxLength` and paste trimming based on the active role limit, and maintains all mobile responsiveness guarantees.

**Blocked by:** 01: Direct Chat 4000-Character Limit & Anti-Clipping UI (Tracer Bullet).

**Status:** ready-for-agent

- [ ] Room Chat socket handler retrieves sender's `RoomMember.role` and enforces limits: 4000 characters for `OWNER` and `ADMIN`, 2000 characters for `MEMBER`.
- [ ] Messages exceeding the sender's role threshold are rejected with an error callback and not saved to the database.
- [ ] Room Chat input container adopts the two-tier `rounded-2xl` layout with textarea on top and counter on bottom.
- [ ] Counter dynamically reflects user role: displays `X/2000` for `MEMBER` and `X/4000` for `OWNER` / `ADMIN`.
- [ ] Counter color transitions to Google Yellow at 90% (1800 for member, 3600 for leader) and Google Red at 100% (2000 for member, 4000 for leader).
- [ ] Textarea binds `maxLength` to the active role quota and trims pasted text exceeding the quota.
- [ ] Send button is disabled when input is empty or exceeds the active role limit.
- [ ] Textarea auto-expands up to `max-h-24` with independent scroll without text clipping or counter collision.
- [ ] Mobile responsive font sizing (`text-base sm:text-sm`) and 40px touch targets are preserved.
- [ ] Automated integration tests verify backend role quota enforcement and frontend component role-aware counter behavior.
