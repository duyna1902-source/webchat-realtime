# 03: Condensed Global Header for Small Screens

**What to build:**
Ensure the application's top navigation bar gracefully condenses on mobile viewports (< 640px / < 768px). The header collapses long user greeting text into an avatar/username badge and displays socket connection status and browser notification toggles as compact icons/dots. This guarantees that the top bar never overflows horizontally, wraps across multiple lines, or pushes critical controls off-screen on 360px portrait smartphone displays.

**Blocked by:** 01: Core Master-Detail Navigation & Dynamic Viewport Height

**Status:** ready-for-agent

- [ ] Top navigation bar fits comfortably within 360px width without horizontal scroll or wrapped rows.
- [ ] Notification toggle button displays as an icon-only button on mobile (`hidden md:inline` for text) with minimum 40px touch hit-target.
- [ ] Socket connection status displays an animated dot indicator on mobile (`hidden sm:inline` for verbose text label).
- [ ] User greeting text collapses gracefully on mobile devices.
- [ ] Sign Out button maintains a compact touch-friendly button without displacing other controls.
- [ ] Component tests verify responsiveness and rendering of header controls.
