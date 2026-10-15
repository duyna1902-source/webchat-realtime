# 01: Master-Detail Navigation Container & Viewport 100dvh

**What to build:**
Enable adaptive Master-Detail display behavior in the main dashboard workspace. On mobile viewports (< 768px), display only the conversation list when no chat is selected, and display the full-width chat area when an active conversation or room is selected. On desktop viewports (>= 768px), preserve the dual-pane split view (sidebar on left, chat on right). Update the main container height unit to Dynamic Viewport Height (`100dvh`) to prevent viewport jumping when mobile browser chrome and software keyboards appear. Condense the top global header on mobile by hiding lengthy username greetings and simplifying socket status and notification toggles to compact icons/dots.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] Main dashboard layout uses `100dvh` instead of `100vh`.
- [x] On mobile viewports (< 768px) with no active chat selected, the conversation sidebar occupies 100% of the screen width and the chat area is hidden.
- [x] On mobile viewports (< 768px) with an active direct chat or room chat selected, the sidebar is hidden and the chat area occupies 100% of the screen width.
- [x] On desktop viewports (>= 768px), both the conversation sidebar and the chat workspace render side-by-side simultaneously.
- [x] The global top navigation header condenses on mobile: username greeting is hidden and socket connection indicator / notification toggles render as compact icons without causing the header to wrap or overflow.
- [x] Socket connection, active hooks, and message state remain mounted and active without page reload or connection loss during viewport or view transitions.

## Answer

Ticket 01 has been implemented and verified.

### Deliverables:
1. **Dynamic Viewport Height (`100dvh`)**: Updated the root container in `Dashboard.tsx` to `h-[100dvh]`.
2. **Master-Detail Layout**: Added responsive toggle styling via `isChatActive` and `className` prop to `Sidebar` (`w-full md:w-88` when idle, `hidden md:flex md:w-88` when active) and wrapped the chat workspace in `chat-area-container` (`hidden md:flex` when idle, `w-full flex` when active).
3. **No Unmounting**: Preserved continuous Socket listeners, message history, and typing state across viewport transitions.
4. **Condensed Header**: Realigned top navigation bar elements with responsive text suppression (`hidden sm:block`, `hidden sm:inline`, `hidden md:inline`) to prevent overflow on mobile.
5. **Automated Tests**: Added `ResponsiveDashboard.test.tsx` verifying responsive classes and layout switching under mobile and desktop modes. All 48 client tests pass.
