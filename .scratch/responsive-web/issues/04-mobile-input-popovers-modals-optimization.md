# 04: Mobile Input, Popovers & Modals Optimization

**What to build:**
Optimize message composition controls and interactive dialog modals for mobile screens. Ensure the textarea input uses a minimum 16px font size (`text-base sm:text-sm`) on mobile devices to prevent iOS Safari auto-zoom, while constraining its multi-line height expansion to `max-h-24` so it never covers message thread history. Constrain the emoji picker popover width to `max-w-[calc(100vw-1.5rem)]` to prevent viewport overflow. Standardize all modals (`CreateRoomModal`, `RoomMembersModal`, `GifSearchModal`, `ImageLightboxModal`) to have a maximum height of `90dvh`, flexible padding (`p-3 sm:p-4`), and minimum touch hit targets of 40px for comfortable finger tapping.

**Blocked by:** 02: Direct Chat Mobile Header & Back Navigation, 03: Room Chat Mobile Header & Back Navigation

**Status:** ready-for-agent

- [ ] Textarea input enforces a minimum font size of 16px on mobile viewports (`text-base sm:text-sm`) to prevent automatic browser zoom on iOS.
- [ ] Textarea input expands gracefully with a strict maximum height of `max-h-24` on mobile devices.
- [ ] Input bar action buttons (attachment, emoji, GIF) and send button maintain a single-line horizontal layout on 360px mobile viewports without wrapping.
- [ ] Emoji picker popover is constrained to `max-w-[calc(100vw-1.5rem)]` preventing horizontal screen overflow on mobile.
- [ ] Modals across room creation, member management, GIF search, and image lightbox enforce `max-h-[90dvh]` with scrollable inner containers.
- [ ] Modal action buttons and member list rows offer at least 40px touch-friendly hit areas.
