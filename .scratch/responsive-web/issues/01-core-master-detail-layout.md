# 01: Core Master-Detail Navigation & Dynamic Viewport Height

**What to build:**
Enable mobile users to navigate between the conversation list and the active conversation on small viewports (< 768px) in a native single-pane experience, while preserving the simultaneous dual-pane workspace for desktop users (>= 768px). When no chat or room is selected, the conversation list (Sidebar) fills the full mobile width. When a conversation is active, the chat workspace takes over the full mobile screen without unmounting components or disconnecting real-time Socket listeners. Full-height layouts adopt Dynamic Viewport Height (`100dvh`) to prevent jumps when browser chrome or virtual keyboards appear.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Full-height container elements use `h-[100dvh]` / `min-h-[100dvh]` rather than static `100vh`.
- [ ] On mobile viewports (< 768px), `Sidebar` is displayed full-width (`w-full`) when no chat is active.
- [ ] On mobile viewports (< 768px), `Sidebar` is hidden (`hidden md:flex`) when a direct chat or room chat is active.
- [ ] On mobile viewports (< 768px), `ChatArea` or `RoomChatArea` is full-width (`w-full flex-1`) when active, and hidden when no chat is active (`hidden md:flex`).
- [ ] On desktop viewports (>= 768px), `Sidebar` and `ChatArea`/`RoomChatArea` are both displayed side-by-side simultaneously.
- [ ] Components remain mounted during navigation so Socket.io connections, message history, and typing state are preserved.
- [ ] Component tests in `Dashboard.test.tsx` verify responsive visibility classes for both idle and active conversation states.
