# 03: Full Desktop & Mobile Regression Verification

**What to build:**
Comprehensive end-to-end test verification asserting the observable behavior of the Desktop Dual-Pane Layout, stationary fixed-width sidebar, persistent detail view across tab transitions, and zero mobile regression. Ensures all unit tests, integration tests, and production build checks across client and server pass cleanly with zero failures.

**Blocked by:** 01: Desktop Dual-Pane Layout & Fixed Sidebar Width, 02: Persistent Detail View Across Sidebar Tab Navigation

**Status:** ready-for-agent

- [ ] Automated tests in `ResponsiveDashboard.test.tsx` verify the two-column layout on initial desktop load with 352px sidebar width and Direct Chat idle placeholder.
- [ ] Automated tests verify placeholder switching between Direct Chat and Room Chat when switching tabs without an active conversation on desktop.
- [ ] Automated tests verify that an open Direct Chat remains in the detail workspace when the user clicks the Rooms tab in the sidebar.
- [ ] Automated tests verify that clicking a room item while a Direct Chat is open switches the detail workspace to that room.
- [ ] Automated tests verify that mobile (< 768px) Master-Detail navigation, full-width list, full-width chat, Back button, and floating action button remain 100% functional.
- [ ] The complete test suite (`npm test`) passes across all client and server test suites with zero failures.
- [ ] Production build (`npm run build --workspace=client`) succeeds with valid compiled CSS including the fixed width utility rule.
