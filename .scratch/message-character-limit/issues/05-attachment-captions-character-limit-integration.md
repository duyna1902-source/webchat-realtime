# 05: Attachment Captions Character Limit & Counter Integration

**What to build:**
Extend the message character limit and visual counter to attachment captions across Direct Chat and Room Chat. When a user selects an image or document to upload, the attachment caption input adopts the same two-tier `rounded-2xl` container, character limits (4000 for Direct Chat & Room Leaders, 2000 for Room Members), and live counter (`X/4000` or `X/2000`). Counter colors follow Google Palette Semantics (Google Grey <90%, Google Yellow >=90%, Google Red 100%), and the send button is disabled if the caption exceeds the limit. Backend socket handlers for both direct and room messages validate `content.length` on attachment messages (where `attachmentUrl` is present), ensuring no anti-spam bypass exists through attachment captions.

**Blocked by:** 02: Room Chat Role-Based Character Limits (Tracer Bullet).

**Status:** claimed

- [ ] Attachment caption input in Direct Chat displays a live counter formatted as `X/4000`.
- [ ] Attachment caption input in Room Chat displays a role-aware counter (`X/2000` for members, `X/4000` for leaders).
- [ ] Caption counter adheres to Google Palette color thresholds (<90% grey, >=90% yellow, 100% red).
- [ ] Caption textarea enforces `maxLength` and trims pasted text exceeding the remaining limit.
- [ ] Send button is disabled if the attachment caption exceeds the character limit.
- [ ] Backend socket handlers reject attachment messages whose caption exceeds the allowed character quota with an error callback.
- [ ] Mobile responsive layout and touch targets are maintained for the attachment preview and caption input area.
- [ ] Automated tests verify end-to-end socket validation for attachment captions and frontend caption counter behavior.
