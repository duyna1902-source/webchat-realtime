# 02: Persistent Detail View Across Sidebar Tab Navigation

**What to build:**
Decouple the right-hand detail workspace from the sidebar's browsing tab so that an ongoing conversation is preserved when browsing other tabs. When an active Direct Chat or Room Chat is open, clicking between the Direct Chats and Rooms tabs in the sidebar allows browsing the alternative list while keeping the active conversation open and active in the detail pane. The detail pane only switches when a specific conversation or room is clicked from the list. When no conversation is open (idle state), switching tabs updates the placeholder to match the active tab. In addition, the sidebar remains completely stationary without any layout shift when switching tabs.

**Blocked by:** 01: Desktop Dual-Pane Layout & Fixed Sidebar Width

**Status:** ready-for-agent

- [ ] When an active Direct Chat is open on desktop, clicking the Rooms tab in the sidebar switches the sidebar list to rooms while keeping the Direct Chat open in the detail workspace.
- [ ] When returning to the Direct Chats tab after browsing rooms without picking a room, the previously active Direct Chat remains selected and visually highlighted.
- [ ] When browsing the Rooms tab with an active Direct Chat open, clicking a specific room cleanly switches the detail workspace to that Room Chat and clears the direct chat selection.
- [ ] When an active Room Chat is open on desktop, clicking the Direct Chats tab in the sidebar preserves the Room Chat in the detail workspace until a specific direct chat is clicked.
- [ ] When no conversation is active, switching between Direct Chats and Rooms tabs in the sidebar updates the detail pane placeholder between the Direct Chat placeholder ("Real-Time Direct Messaging") and the Room Chat placeholder ("Room Chat").
- [ ] Toggling between Direct Chats and Rooms tabs produces zero horizontal layout shift or width flickering in the sidebar.
