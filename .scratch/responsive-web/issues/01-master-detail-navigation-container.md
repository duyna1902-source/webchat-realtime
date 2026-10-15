# 01: Master-Detail Navigation Container & Viewport 100dvh

**What to build:**
Enable adaptive Master-Detail display behavior in the main dashboard workspace. On mobile viewports (< 768px), display only the conversation list when no chat is selected, and display the full-width chat area when an active conversation or room is selected. On desktop viewports (>= 768px), preserve the dual-pane split view (sidebar on left, chat on right). Update the main container height unit to Dynamic Viewport Height (`100dvh`) to prevent viewport jumping when mobile browser chrome and software keyboards appear. Condense the top global header on mobile by hiding lengthy username greetings and simplifying socket status and notification toggles to compact icons/dots.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Main dashboard layout uses `100dvh` instead of `100vh`.
- [ ] On mobile viewports (< 768px) with no active chat selected, the conversation sidebar occupies 100% of the screen width and the chat area is hidden.
- [ ] On mobile viewports (< 768px) with an active direct chat or room chat selected, the sidebar is hidden and the chat area occupies 100% of the screen width.
- [ ] On desktop viewports (>= 768px), both the conversation sidebar and the chat workspace render side-by-side simultaneously.
- [ ] The global top navigation header condenses on mobile: username greeting is hidden and socket connection indicator / notification toggles render as compact icons without causing the header to wrap or overflow.
- [ ] Socket connection, active hooks, and message state remain mounted and active without page reload or connection loss during viewport or view transitions.
