# 01: Desktop Dual-Pane Layout & Fixed Sidebar Width

**What to build:**
Ensure that when the web application loads on desktop and laptop viewports (screens at or wider than 768px), the layout immediately renders two side-by-side columns: a fixed 352px sidebar on the left and an idle placeholder in the detail workspace on the right, matching the expected initial two-column view without expanding the sidebar to 100% viewport width. Furthermore, ensure that clicking into any conversation keeps the sidebar width strictly fixed at 352px so there is zero layout jumping or width snapping.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] On desktop/laptop viewports (>= 768px), the sidebar renders with a fixed width of 352px (`22rem` / `w-88`) immediately upon initial page load without an active conversation.
- [ ] On desktop/laptop viewports, the sidebar never expands to full width (`w-full`), which is strictly restricted to mobile viewports (< 768px).
- [ ] On initial load with no conversation selected, the right-hand detail workspace renders side-by-side with the sidebar, displaying the Direct Chat empty state placeholder ("Real-Time Direct Messaging").
- [ ] Clicking to select an active Direct Chat or Room Chat keeps the sidebar width rock-solid at 352px without any horizontal layout shift, collapsing, or snapping.
- [ ] Mobile single-pane master view (< 768px) continues to render full width (`w-full`) when no chat is active.
