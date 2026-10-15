# Spec: Mobile Responsive Web with Master-Detail Navigation (Variant A)

Status: ready-for-agent

## Problem Statement

When using the Web Chat application on mobile devices (smartphones with portrait widths between 360px and 414px), the user interface is completely broken and unusable. The current layout forces a fixed two-column desktop layout (a 320px wide sidebar alongside a flexible chat window) across all screen sizes. On small mobile viewports, the conversation list takes up almost the entire screen width, compressing the active chat area into an unreadable and unclickable 40–50px margin. When an active conversation or room is opened, there is no back navigation button to return to the conversation list on mobile. In addition, standard 100vh containers jump and distort when mobile browser address bars and software virtual keyboards appear, and small font sizes trigger unwanted automatic iOS Safari page zooming. Users need the web chat application to operate smoothly and intuitively on laptops (preserving the dual-pane workflow) while providing a native-feeling single-pane messaging experience on mobile phones.

## Solution

Implement the **Variant A (Master-Detail Navigation)** architecture for the frontend user interface, modeled after proven mobile messaging applications like Telegram and WhatsApp:
- On desktop viewports (768px width and wider), maintain the classic dual-pane layout: conversation list on the left and active chat workspace on the right.
- On mobile viewports (under 768px width), switch to a single-pane Master-Detail view:
  - **Master View (Conversation List)**: Full-width list of direct chats and rooms with top segmented tabs (`Direct Chats` vs `Rooms`), real-time presence indicators, last message previews, search bar, and an accessible floating action button to create new chats or rooms.
  - **Detail View (Active Chat Workspace)**: Full-width conversation thread displayed when a chat or room is selected, featuring a prominent, touch-friendly Back button (`< Chats`) in the header that resets the selection state and seamlessly navigates back to the Master View.
- Adopt Dynamic Viewport Height (`100dvh`) to eliminate mobile browser chrome and keyboard jumping.
- Constrain all popovers (e.g. emoji picker) and modals (e.g. room creation, member management, GIF search) to safe viewport margins with touch-friendly hit targets (minimum 40px).
- Enforce a 16px minimum font size on mobile inputs to prevent iOS Safari auto-zoom.
- Strictly frontend presentation and responsive state: absolutely zero changes to backend services, database schemas, or real-time Socket.io protocol contracts.

## User Stories

1. As a mobile user, when I open the application on my phone, I want to see the conversation list occupy the full screen width, so that I have ample space to read contact names, latest message previews, and unread badges.
2. As a mobile user, I want segmented tab controls at the top of the conversation list to toggle smoothly between Direct Chats and Rooms, so that I can organize my messaging contexts with one tap.
3. As a mobile user, I want to tap on a direct chat from the list and have the chat workspace instantly take over the entire screen, so that message bubbles and attachments are easily readable without horizontal squashing.
4. As a mobile user, I want to tap on a room chat from the list and have the room discussion fill the entire screen, so that multi-user discussions and announcements are clear and accessible.
5. As a mobile user, I want a prominent, touch-friendly Back button (with a left arrow icon and "Chats" label) in the header of an active direct chat, so that I can effortlessly return to my conversation list.
6. As a mobile user, I want a prominent, touch-friendly Back button in the header of an active room chat, so that I can easily exit back to the room directory.
7. As a mobile user, I want a prominent Floating Action Button (FAB) at the bottom right of the conversation list, so that I can quickly initiate a new direct chat or create a new room with one thumb tap.
8. As a desktop user, I want the sidebar and chat area to continue displaying side-by-side simultaneously on my laptop, so that my existing desktop messaging workflow remains completely undisturbed.
9. As a desktop user, I do not want to see a mobile Back button cluttering the chat header on wide screens, so that the desktop user interface remains clean and desktop-native.
10. As a mobile user, I want the top navigation bar to condense gracefully on small screens (hiding verbose greeting text and displaying socket connectivity and notification toggles as compact badges/icons), so that the header never wraps or overflows horizontally.
11. As a mobile user, I want the message input textarea to have a font size of at least 16px, so that iOS Safari does not zoom in and displace the page layout when I focus to type.
12. As a mobile user, I want the message input textarea to have a reasonable maximum height (e.g. max 96px) when composing multi-line messages, so that long text does not completely cover previous conversation history.
13. As a mobile user, I want the emoji picker popover to dynamically bound its width (`max-w-[calc(100vw-1.5rem)]`), so that the emoji grid never clips outside the smartphone viewport.
14. As a mobile user, I want animated GIF search modals and member management modals to open with safe margins and a maximum height of `90dvh`, so that dialog headers, scrollable lists, and close buttons remain within reach.
15. As a mobile user, I want all interactive buttons, modal actions, and conversation list rows to offer at least a 40px touch area, so that I do not trigger unintended actions with touch gestures.
16. As a mobile user, I want the application height to utilize dynamic viewport height (`100dvh`), so that when the software keyboard opens and closes, the input bar stays properly pinned without screen distortion.
17. As a user rotating my tablet or resizing my browser window, I want the application to transition smoothly between single-pane (mobile) and dual-pane (desktop) without reloading or disconnecting the real-time Socket connection.
18. As an authenticated user, I want incoming live messages, typing indicators, and presence updates to continue streaming seamlessly in the background regardless of whether the mobile viewport is displaying the list or the active chat.

## Implementation Decisions

- **Master-Detail Navigation Architecture**: The main application workspace toggles between Master (conversation list) and Detail (active direct chat or room chat) views based on viewport width (`md: 768px` breakpoint) and conversation selection state (`activeChatId` / `activeRoomId`).
- **CSS-Driven Visibility without Component Unmounting**: The Master and Detail views are controlled through responsive CSS utility classes (`hidden md:flex`, `flex w-full md:w-80 lg:w-88`, and `flex-1`) rather than conditional component mounting. This guarantees that Socket.io listeners, message cache, scroll positions, and typing state are never unmounted or re-initialized during navigation.
- **Mobile Header Back Button**: Both direct chat and room chat header components accept an optional `onBack` callback. When rendered on screens narrower than 768px (`md:hidden`), a `ChevronLeft` arrow button is displayed immediately adjacent to the partner or room avatar. Clicking this button triggers `onBack`, resetting the active conversation identifiers to null and restoring the full-width Master list.
- **Top Bar Condensation**: The global header collapses lengthy username greetings on small screens (`hidden sm:inline`) and displays socket connection indicators and notification toggles as icon-only or dot badges to maintain single-row alignment across all mobile screen sizes.
- **Dynamic Viewport Height & Keyboard Stabilization**: All full-height outer containers are updated from static viewport height (`100vh`) to Dynamic Viewport Height (`100dvh`), ensuring compatibility with iOS Safari toolbar transitions and Android virtual keyboard appearances.
- **Input Field iOS Auto-Zoom Prevention**: Input text fields and textareas apply base font sizing (`text-base sm:text-sm`) to ensure the font size is at least 16px on mobile devices, preventing iOS Safari from triggering disruptive automatic page zooms on focus.
- **Constrained Popovers & Touch Sizing**: Media popovers (emoji selector) enforce responsive maximum widths (`max-w-[calc(100vw-1.5rem)]`). Dialog modals across room creation, membership, and GIF search enforce `max-h-[90dvh]` with scrollable bodies, flexible padding (`p-3 sm:p-4`), and minimum touch heights of 40px for list items and action buttons.
- **Strict Frontend Boundary**: No modifications to server-side code, database schemas, API routes, or Socket.io event definitions.

## Testing Decisions

- **Test Quality Definition**: Tests must verify observable responsive behaviors from the user's perspective (evaluating whether the conversation list is visible full-width when no chat is selected, whether opening a conversation hides the list and displays the chat full-width on mobile, whether clicking the Back button returns to the conversation list, and whether desktop displays both panes simultaneously) without asserting on private internal mechanics.
- **Tested Modules**:
  - The main dashboard workspace: testing responsive visibility classes when switching between idle state and active conversation state.
  - The direct chat workspace: testing the presence of the mobile Back button and verification that triggering it invokes the back handler.
  - The room chat workspace: testing the presence of the mobile Back button and verification that triggering it invokes the back handler.
  - Existing regression test suite: all 45 existing unit and integration tests must continue to pass without regression.
- **Prior Art**: Existing component tests in `client/src/App.test.tsx`, `client/src/components/chat/DirectChat.test.tsx`, and `client/src/components/room/RoomChat.test.tsx` using Vitest and `@testing-library/react`.

## Out of Scope

- Native wrapper code (Capacitor/Cordova/React Native).
- Touch swipe gestures (e.g. swipe-to-go-back gesture animation).
- Introducing a client-side routing library (e.g. React Router).
- Backend database schema or Socket.io event modifications.

## Further Notes

- Documented in ADR 0006 (`docs/adr/0006-mobile-responsive-master-detail-layout.md`).
- Domain terminology added to `GLOSSARY.md` under `Master-Detail Navigation` and `Dynamic Viewport Height`.
- Interactive prototype validated via Variant A.
