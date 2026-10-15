# 04: Mobile Message Input iOS Auto-Zoom Prevention & Touch Targets

**What to build:**
Optimize the message input and action bar for mobile touchscreens. The message input textarea enforces a minimum 16px font size on mobile viewports (`text-base sm:text-sm`) to prevent iOS Safari from automatically zooming into the page and displacing the layout upon focus. The textarea bounds its expansion with a maximum height (max 96px, `max-h-24`) and vertical scrollbar so lengthy drafts do not obscure conversation history. All interactive buttons (send, attachment picker, emoji, GIF) meet the 40px touch hit-target standard.

**Blocked by:** 02: Mobile Header Back Navigation for Direct & Room Chats

**Status:** ready-for-agent

- [ ] Message input textareas across direct chat and room chat use `text-base sm:text-sm` (ensuring at least 16px on mobile).
- [ ] Textarea auto-expansion is capped at `max-h-24` (96px) with scrollable overflow.
- [ ] Send, Attachment, Emoji, and GIF buttons offer at least a 40x40px touch hit area (`min-w-[40px] min-h-[40px]`).
- [ ] Message input bar remains securely pinned to the bottom of the viewport using dynamic viewport layout.
- [ ] Component tests in `DirectChat.test.tsx` and `RoomChat.test.tsx` verify input rendering and typing interactions.
