# Spec: Desktop Dual-Pane Layout and Persistent Conversation Navigation

Status: ready-for-agent

## Problem Statement

When users access the Web Chat application on laptops and desktop computers (viewports >= 768px), the layout suffers from visual instability and navigation disruptions:
1. Upon initial login without an active conversation selected, the conversation sidebar expands to 100% viewport width, completely hiding the right-hand workspace area and failing to display the intended side-by-side dual-pane layout.
2. Clicking a conversation causes the sidebar to abruptly collapse from full width to a narrower width, causing an unsettling layout jump.
3. Switching between the Direct Chats and Rooms tabs in the sidebar triggers subtle horizontal width shifting because the sidebar lacks a recognized fixed width constraint in the CSS compilation.
4. When a user has an active Direct Chat open and switches to the Rooms tab in the sidebar to browse available rooms, the right-hand pane immediately resets to an empty Room Chat placeholder, abruptly evicting their ongoing conversation and disrupting their reading or drafting flow.

Desktop users require a rock-solid Dual-Pane Layout that opens directly into the two-column view (matching the idle placeholder design), maintains a strictly stationary sidebar width across all tab switches, and preserves the active conversation in the right pane when browsing alternative tabs until an explicit new conversation is chosen.

## Solution

1. **Dual-Pane Desktop Layout (Fixed 352px Sidebar)**:
   - Configure the standard `88` spacing scale (`22rem` / 352px) in the frontend Tailwind CSS build configuration so that `md:w-88` is properly compiled and applied.
   - Constrain full-width (`w-full`) strictly to mobile viewports (< 768px), guaranteeing that laptops and desktops immediately render a fixed 352px sidebar on the left and a flexible detail pane on the right from initial load.

2. **Idle Placeholder Alignment**:
   - On desktop when no conversation is active (`activeChatId === null` and `activeRoomId === null`), the right detail pane renders the empty state placeholder matching the active sidebar tab:
     - Direct Chats tab: Displays "Real-Time Direct Messaging" placeholder.
     - Rooms tab: Displays "Room Chat" placeholder.

3. **Persistent Detail View Across Sidebar Tab Navigation**:
   - Decouple the detail pane's rendered view from the sidebar's browsing tab whenever an active conversation exists.
   - If an active Direct Chat is open, the detail pane maintains the Direct Chat workspace even when the user clicks the Rooms tab to inspect rooms in the sidebar.
   - If an active Room Chat is open, the detail pane maintains the Room Chat workspace even when the user clicks the Direct Chats tab in the sidebar.
   - When the user returns to the active conversation's tab in the sidebar without selecting anything else, the current conversation remains visually highlighted and selected.
   - When the user explicitly clicks a conversation or room in the alternative tab, the detail pane updates cleanly to the newly selected chat.

4. **Zero Mobile Regression**:
   - Retain 100% of the mobile Master-Detail navigation, Dynamic Viewport Height (`100dvh`), mobile Back button, and floating action button (FAB) behaviors without alteration.

## User Stories

1. As a desktop user opening the application on my laptop, I want to see the sidebar and detail pane rendered side-by-side immediately, so that the screen is balanced and ready for interaction.
2. As a desktop user on initial load with no conversation selected, I want the detail pane to show the Direct Chat placeholder when the Direct Chats tab is active, so that I receive clear guidance on how to start a conversation.
3. As a desktop user with no conversation selected, I want switching between Direct Chats and Rooms tabs in the sidebar to smoothly update the right-hand placeholder between Direct Chat and Room Chat placeholders, so that the empty state remains contextually relevant.
4. As a desktop user, I want the sidebar on my laptop to remain fixed at 352px width at all times, so that opening or closing conversations never produces an abrupt layout jump.
5. As a desktop user, I want the sidebar width to remain perfectly stationary when toggling between Direct Chats and Rooms tabs, so that there is zero layout twitching.
6. As a desktop user actively chatting in a Direct Chat, I want to click the Rooms tab in the sidebar to browse rooms without losing my open Direct Chat in the right pane, so that I can check room listings without interrupting my current conversation.
7. As a desktop user browsing the Rooms tab while a Direct Chat is active, I want to switch back to the Direct Chats tab and see my current Direct Chat still selected and highlighted, so that I know exactly who I am talking to.
8. As a desktop user browsing the Rooms tab while a Direct Chat is active, I want to click on a specific room to switch the detail view to that room, so that I can transition to group messaging when desired.
9. As a desktop user actively chatting in a Room Chat, I want to click the Direct Chats tab in the sidebar to browse my direct conversations while keeping the Room Chat visible in the right pane, so that I can reference private message timestamps without leaving the room discussion.
10. As a desktop user browsing Direct Chats while a Room Chat is active, I want to click a specific direct chat to switch the detail pane to that chat, so that I can begin private messaging.
11. As a mobile user, I want the single-pane Master-Detail navigation to remain unchanged on screens smaller than 768px, so that my mobile experience remains completely intact.
12. As a mobile user, I want the mobile Back button to remain visible and functional in the chat header, so that I can exit active chats back to the conversation list on my phone.
13. As a mobile user, I want the floating action button to remain available on the mobile conversation list, so that I can quickly start a chat or create a room on my phone.
14. As a user resizing my browser between mobile and desktop viewport widths, I want the layout to adapt smoothly between single-pane and dual-pane without page reload or Socket.io disconnection.
15. As a desktop user browsing alternative tabs in the sidebar, I want real-time incoming messages, typing notifications, and presence changes for the open conversation to continue streaming live in the detail pane, so that real-time communication is uninterrupted.

## Implementation Decisions

- **Tailwind Config Spacing Extension**: Add `'88': '22rem'` (352px) to `theme.extend.spacing` in the client build configuration to ensure `md:w-88` generates valid CSS utility rules.
- **Desktop Dual-Pane Width Stabilization**: Enforce `w-full md:w-88` on the Sidebar component so that full-width applies only to viewports under 768px and fixed 352px applies to viewports at or above 768px, eliminating initial full-width stretch on laptops.
- **Detail Pane Selection Decoupling**: Update the workspace rendering condition in the main dashboard:
  - If `activeChatId` is present, render `ChatArea` with the active Direct Chat.
  - If `activeRoomId` is present, render `RoomChatArea` with the active Room Chat.
  - If neither is present, render `ChatArea` placeholder when `activeTab === 'direct'` and `RoomChatArea` placeholder when `activeTab === 'room'`.
- **Explicit Cross-Tab Selection**: When selecting a conversation from the sidebar (e.g. clicking a Room while a Direct Chat is open), the selection handler clears the previous selection identifier and activates the new identifier, switching the detail view smoothly.
- **Preserved Component Mounting & Socket Lifecycles**: All visibility toggles rely strictly on CSS classes (`hidden md:flex`, `w-full flex`) without unmounting core components, preserving background socket events, message queues, and reconnection listeners.

## Testing Decisions

- **Test Quality Definition**: Tests must assert only on observable user behavior and accessibility attributes (verifying rendered component presence, container width classes, placeholder text, and seamless conversation retention during tab clicks) rather than testing internal state variables.
- **Tested Modules**:
  - Main Dashboard Component (`ResponsiveDashboard.test.tsx`):
    - Verify dual-pane layout on initial desktop load with 352px fixed sidebar and idle Direct Chat placeholder.
    - Verify placeholder toggle between Direct Chat and Room Chat when switching tabs without an active conversation.
    - Verify active Direct Chat remains visible in the detail pane when switching to the Rooms tab.
    - Verify selecting a Room from the Rooms tab replaces the Direct Chat with the selected Room Chat.
    - Verify mobile single-pane Master-Detail behavior remains 100% intact.
- **Prior Art**: Existing Master-Detail test suite in `client/src/components/dashboard/ResponsiveDashboard.test.tsx`.

## Out of Scope

- Backend schema changes, database migrations, or server-side API modifications.
- Socket.io event name changes or real-time payload format updates.
- Redesigning mobile layouts, drawer menus, or routing libraries.
- Multi-column split views (e.g. displaying three columns simultaneously).

## Further Notes

- Aligns with [GLOSSARY.md](file:///d:/Project/webchat-realtime/GLOSSARY.md) terms: `Direct Chat`, `Room Chat`, `Dual-Pane Desktop Layout`, and `Persistent Detail View`.
- Documents architectural decisions in [ADR 0006](file:///d:/Project/webchat-realtime/docs/adr/0006-mobile-responsive-master-detail-layout.md) and [ADR 0007](file:///d:/Project/webchat-realtime/docs/adr/0007-desktop-dual-pane-layout-and-persistent-detail-view.md).
