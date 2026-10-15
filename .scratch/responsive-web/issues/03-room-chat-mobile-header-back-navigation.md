# 03: Room Chat Mobile Header & Back Navigation

**What to build:**
Provide a touch-friendly Back navigation button (`ChevronLeft` / `< Chats`) on the room chat header that is visible only on mobile screens (< 768px). When tapped by a mobile user, the button invokes a back callback (`onBack`) that clears the selected room identifier in the parent dashboard, returning the mobile user smoothly to the conversation list. The Back button is automatically hidden on desktop viewports (>= 768px). Component unit tests verify the button rendering and navigation behavior.

**Blocked by:** 01: Master-Detail Navigation Container & Viewport 100dvh

**Status:** ready-for-agent

- [ ] Room chat header component accepts an optional `onBack` callback property.
- [ ] On mobile viewports (< 768px), a Back button featuring a left arrow icon is rendered immediately preceding the room avatar/icon.
- [ ] On desktop viewports (>= 768px), the Back button is hidden (`md:hidden`).
- [ ] Clicking the Back button on mobile calls `onBack()`, resetting the active room identifier and returning the view to the room list.
- [ ] Unit tests for the room chat component verify the presence of the Back button under mobile styling and assert that the `onBack` callback is fired on click.
