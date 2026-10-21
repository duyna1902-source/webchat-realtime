# Spec: Anti-Spam Message Character Limit with Visual In-Box Counter

Status: ready-for-agent

## Problem Statement

In real-time group and direct messaging systems, users can submit arbitrarily long blocks of text in a single transmission. This creates several acute problems:
1. Malicious or careless users can flood chat threads with giant walls of text (spam/copypasta), displacing real conversations and degrading the messaging experience for everyone in the room.
2. Huge message payloads strain server resources, database storage, and network bandwidth when broadcasting to active socket clients.
3. Users composing messages have zero feedback regarding allowable length, leading to surprise failures or message clipping if arbitrary backend limits are reached.
4. Input fields that attempt to display counters often suffer from visual clipping, where the counter text overlaps message content or gets hidden behind input boundaries when users write multi-line messages.

Users need clear, real-time visual feedback on their character usage directly inside the input area without obstructing their message text, with sensible anti-spam limits based on conversation type and room governance roles.

## Solution

Implement an end-to-end **Message Character Limit** mechanism across Direct Chat and Room Chat with real-time visual feedback:
- **Direct Chat**: Maximum 4000 characters for both participants per message.
- **Room Chat**: Role-differentiated limits:
  - `OWNER` and `ADMIN`: Maximum 4000 characters per message.
  - `MEMBER`: Maximum 2000 characters per message.
- **In-Box Visual Counter with Anti-Clipping Architecture**:
  - A small, unobtrusive counter line (e.g., `123/2000` or `0/4000`) positioned inside the lower-right area of the input container.
  - A two-tier flex container (`rounded-2xl`) that separates the auto-expanding textarea (top tier, with independent scrolling) from the counter bar (bottom tier), guaranteeing 100% text visibility with zero overlap or clipping.
  - Color cues following Google Palette Semantics: neutral Google Grey under 90%, Google Yellow at 90% or above, and Google Red at 100% or when exceeding quota.
- **Comprehensive Multi-Layer Defense**:
  - Hard cap on client input (`maxLength`) and automatic truncation on paste.
  - Emoji picker insertion protection preventing emoji insertion if it exceeds remaining capacity.
  - Strict database-backed backend validation on Socket.io event handlers, rejecting any oversized payloads via callback ack.
  - Resilient handling of real-time role demotions: preserving user drafts while disabling sending until edited down.
  - Shared source of truth for limit constants across client and server packages.
  - Full consistency between pure text messages and attachment captions.

## User Stories

1. As a Direct Chat participant, I want to type messages up to 4000 characters, so that I can express detailed thoughts in private conversations without arbitrary truncation.
2. As a Direct Chat participant, I want to see a counter displaying `0/4000` when the message input is empty, so that I immediately know my maximum allowed message length.
3. As a Direct Chat participant, I want the counter to update in real time as I type (e.g., `150/4000`), so that I always know how many characters I have used.
4. As a Direct Chat participant, I want the counter to turn yellow when I reach 3600 characters (90% of limit), so that I am visually warned that I am nearing the maximum capacity.
5. As a Direct Chat participant, I want the counter to turn red when I reach 4000 characters, so that I know I have hit the absolute limit.
6. As a Direct Chat participant, I want the input field to prevent typing beyond 4000 characters, so that I never send a message that gets unexpectedly cut off.
7. As a Direct Chat participant, when I paste text exceeding my remaining character allowance, I want the text to be automatically truncated to fit the 4000-character ceiling, so that my input is not corrupted or rejected.
8. As a Room Chat member with the `MEMBER` role, I want my message length limited to 2000 characters, so that the group is protected against disruptive spam walls.
9. As a Room Chat member with the `MEMBER` role, I want to see a counter formatted as `X/2000`, so that I am clearly aware of the member character quota.
10. As a Room Chat member with the `MEMBER` role, I want the counter to turn yellow at 1800 characters (90%) and red at 2000 characters, so that I receive immediate visual feedback as I compose long texts.
11. As a Room Chat room owner or administrator (`OWNER` or `ADMIN`), I want an expanded character quota of 4000 characters, so that I can post comprehensive guidelines, announcements, and summaries.
12. As a Room Chat room owner or administrator, I want to see a counter formatted as `X/4000` reflecting my elevated role privileges, so that I know my higher quota is active.
13. As a user composing a multi-line message that expands the input up to its maximum vertical height, I want the textarea to scroll independently above the character counter, so that my typed sentences are never obscured or clipped by the counter text.
14. As a Room Chat user who gets demoted from `ADMIN` to `MEMBER` while actively drafting a 2500-character message, I want my drafted text preserved in the input box with the counter showing `2500/2000` in red and the send button disabled, so that I can manually edit down my message without losing what I wrote.
15. As a user adding an image or document attachment with a caption, I want the caption to obey the exact same character limits and counter rules, so that attachment captions cannot be exploited as an anti-spam loophole.
16. As a user inserting emojis via the emoji picker popover, I want the emoji insertion to be gracefully blocked if inserting the emoji's code points would push the message past the character ceiling, so that emojis cannot break the limit.
17. As an anti-spam system operator, I want the backend socket handlers to strictly validate incoming message lengths against the sender's actual database role, so that malicious users attempting to bypass client-side checks with direct socket payloads are completely blocked with an explicit error response.
18. As a mobile user, I want the counter and input box to remain legible, comfortable to tap, and responsive on narrow smartphone screens, so that mobile usability is completely preserved.
19. As a user attempting to send an empty message or a message exceeding the character limit, I want the send button to be visibly disabled and unclickable, so that I am not allowed to perform invalid actions.

## Implementation Decisions

- **Single Source of Truth in Shared Constants**: Define centralized limit constants in the shared package accessible by both client and server modules:
  ```typescript
  export const MESSAGE_LIMITS = {
    DIRECT: 4000,
    ROOM_LEADER: 4000, // OWNER and ADMIN
    ROOM_MEMBER: 2000, // MEMBER
  } as const;
  ```
- **Backend Socket Enforcement**:
  - Direct message socket handler validates `content.length <= MESSAGE_LIMITS.DIRECT`.
  - Room message socket handler queries the sender's current `RoomMember` record in the database, determines whether the role is `OWNER`, `ADMIN`, or `MEMBER`, and validates `content.length` against the respective limit.
  - Rejection contract: Any incoming socket message exceeding the limit fails with callback acknowledgment `{ success: false, error: '...' }` without persisting to the database or broadcasting to clients.
- **Two-Tier Input Architecture for Anti-Clipping**:
  - Replace the single-line capsule container with a `rounded-2xl` container structured in a vertical flexbox layout:
    - **Top Tier**: `<textarea>` element configured with auto-growing height up to `max-h-24`, overflow-y auto, and full horizontal expansion.
    - **Bottom Tier**: An auxiliary status bar containing the character counter aligned to the far right (`text-[11px] font-medium leading-none pb-0.5 pt-1 text-right`).
  - This structural separation guarantees that even with long paragraphs and scrollbars, the textarea text cannot intersect or obscure the counter.
- **Hard Cap & Paste Handling**:
  - The textarea element binds `maxLength={maxLimit}`.
  - A custom change/paste listener calculates remaining capacity and trims oversized clipboard text if necessary.
- **Emoji Picker Capacity Guard**:
  - Before inserting selected emojis into the textarea at the current cursor position, verify that `currentText.length + emoji.length <= maxLimit`. If it exceeds, suppress insertion.
- **Visual Feedback & Google Palette Semantics**:
  - Normal state (< 90%): `text-google-grey700`.
  - Near limit (≥ 90% and < 100%): Google Yellow (`text-amber-500` / `#FBBC04`).
  - At limit or exceeded (≥ 100%): Google Red (`text-google-red` / `#EA4335`).
- **Dynamic Role Adaptation**:
  - Room chat components evaluate the active user's room role from the active room state or room details, reactively adjusting the limit between 2000 and 4000 characters.
  - The send button disabled state incorporates `inputText.length > maxLimit`.
- **Attachment Captions Alignment**:
  - Both pure text and file caption inputs utilize the same input component or state management, sharing the identical character limit and counter rules.
- **Mobile Responsiveness & Touch Optimization (Variant A on Mobile)**:
  - The `<textarea>` strictly maintains base font sizing `text-base sm:text-sm` (16px font size on mobile viewports under 768px) to eliminate iOS Safari automatic viewport zooming on focus.
  - All surrounding action buttons (attachment paperclip, emoji toggle, GIF search, and send button) preserve minimum touch hit targets of 40px (`min-w-[40px] min-h-[40px]`).
  - Vertical expansion remains strictly bounded to `max-h-24` (96px) with dynamic auto-height so that long multi-line drafts never swallow the mobile chat history.
  - The two-tier `rounded-2xl` input container flexes cleanly within the mobile chat bar with zero horizontal overflow and seamless virtual keyboard compatibility (`100dvh`).

## Testing Decisions

- **Testing Philosophy**:
  - Tests must only inspect observable external behavior (user input reactions, DOM counter strings, button disabled states, socket event acknowledgments) and never private implementation details.
- **Testing Seams**:
  - **Seam 1 - Backend Socket Protocol Seam**:
    - Exercise `direct:send` and `room:send` events using real Socket.io client connections against test server instances.
    - Test payloads within limits pass and persist.
    - Test payloads exceeding limits (e.g. 4001 characters for direct/admin, 2001 for member) fail with `{ success: false }` and error descriptions.
    - Prior art: `server/tests/direct-chat-socket.test.ts`, `server/tests/room-socket.test.ts`.
  - **Seam 2 - Frontend Component Interaction Seam**:
    - Render `ChatArea` and `RoomChatArea` via `@testing-library/react` within mock auth/socket contexts.
    - Verify counter displays initial values (`0/4000`, `0/2000`).
    - Verify counter updates on typing and changes color classes at ≥90% and 100%.
    - Verify `maxLength` attribute is set properly on `<textarea>`.
    - Verify send button is disabled when input exceeds limit or when demoted.
    - Verify emoji insertion is blocked when at character capacity.
    - Prior art: `client/src/components/chat/ResponsiveMobileInput.test.tsx`, `client/src/components/chat/DirectChat.test.tsx`, `client/src/components/room/RoomChat.test.tsx`.

## Out of Scope

- Custom per-room character limit configuration set by room owners.
- Message rate limiting / throttling (e.g. max N messages per minute) — this spec strictly governs per-message character length.
- Rich-text markdown token weighting (characters are counted as standard UTF-16 code units / JavaScript string length).
- Database schema changes (the existing `TEXT` columns in Prisma/PostgreSQL comfortably support 4000 characters).

## Further Notes

- An interactive prototype validating the UI anti-clipping architecture and counter state machine is available at `prototype-character-limit.html`. The prototype proves that Variant A (two-tier in-box flex container) completely eliminates text clipping while maintaining Google Palette color transitions.
- The project glossary [GLOSSARY.md](file:///d:/Project/webchat-realtime/GLOSSARY.md#L48-L50) has already been updated with the canonical definition for `Message Character Limit`.
- UI tokens strictly follow `Google Palette Semantics` to ensure brand consistency with the rest of the GDG-HUST Realtime Chat design system.
