# 02: Mobile Header Back Navigation for Direct & Room Chats

**What to build:**
Provide a prominent, touch-friendly Back button (`< Chats`) in the headers of both direct chats and room chats on mobile screens (< 768px). When tapped, the back button invokes an `onBack` handler that clears the active conversation state in `Dashboard`, effortlessly returning the mobile user to the full-width conversation list (Master view). On desktop viewports (>= 768px), the back button is completely hidden (`md:hidden`) to maintain a clean desktop appearance.

**Blocked by:** 01: Core Master-Detail Navigation & Dynamic Viewport Height

**Status:** ready-for-agent

- [ ] `ChatArea` and `DirectChat` render a Back button (`ChevronLeft` icon and optional "Chats" text) in the header on mobile (< 768px) with `md:hidden`.
- [ ] `RoomChatArea` and `RoomChat` render a Back button in the header on mobile (< 768px) with `md:hidden`.
- [ ] Back button provides a minimum touch area of 40x40px with accessible `aria-label="Back to chats"`.
- [ ] Clicking the Back button resets `activeChatId` and `activeRoomId` to `null` in `Dashboard`, displaying the Master view.
- [ ] Desktop screens (>= 768px) do not display the back button.
- [ ] Component tests in `DirectChat.test.tsx` and `RoomChat.test.tsx` verify back button rendering and callback invocation on click.
