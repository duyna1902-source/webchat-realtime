# 05: Responsive Dialog Modals & Constrained Media Popovers

**What to build:**
Constrain all overlay and modal elements to safe mobile viewport dimensions. The emoji picker popover bounds its maximum width (`max-w-[calc(100vw-1.5rem)]`) and adjusts orientation so it never clips past smartphone screen boundaries. Modals for Room Creation (`CreateRoomModal`), Member Management (`RoomMembersModal`), and Animated GIF Search (`GifSearchModal`) enforce a maximum height of `90dvh` (`max-h-[90dvh]`) with internal scrollable bodies, responsive padding (`p-3 sm:p-4`), and minimum 40px touch hit-targets on close, submit, and member list action buttons.

**Blocked by:** 02: Mobile Header Back Navigation for Direct & Room Chats

**Status:** ready-for-agent

- [ ] Emoji picker dropdown enforces `max-w-[calc(100vw-1.5rem)]` and stays inside viewport bounds on small screens.
- [ ] `GifSearchModal` adapts to mobile screen with `max-h-[90dvh]`, responsive grid columns, and touch-friendly item selection.
- [ ] `CreateRoomModal` and `RoomMembersModal` fit within `max-h-[90dvh]` with scrollable list containers and touch-friendly actions (>= 40px).
- [ ] Close buttons across all dialogs provide accessible padding and minimum 40px touch targets.
- [ ] Existing rich media tests in `RichMedia.test.tsx` and room tests in `RoomChat.test.tsx` continue to pass without regression.
