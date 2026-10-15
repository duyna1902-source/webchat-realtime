# 03: Ultra-Compact Dashboard Header and Maximal Chat Workspace

**What to build:** Rebrand and streamline the persistent dashboard navigation to maximize visible chat workspace while preventing awkward text wrapping on mobile screens. The top header is locked to a slim 42px height (`h-11`). In the top-left, the generic chat icon is replaced by a 28×28px GDG `<>` code bracket mark, accompanied by the primary application title "GDG-HUST" styled with `whitespace-nowrap font-bold text-sm tracking-tight text-gray-900` so that it stays strictly on a single line on mobile without wrapping. Connection status is represented by a compact 8px pulsing green dot (`#34A853`) with text hidden on mobile, the current user is shown via a 24px avatar circle, and logout is an icon-only button on mobile. The redundant duplicate user profile row at the top of the sidebar is completely removed, reclaiming ~70px of vertical space so the sidebar starts immediately with conversation tabs and the search bar.

**Blocked by:** 01: Setup Cropped Brand Assets and Google Design Tokens

**Status:** claimed

- [ ] Top navigation bar height is constrained to a slim 42px (`h-11`).
- [ ] Brand lockup renders the 28×28px GDG `<>` code bracket logo and "GDG-HUST" title on a single line with `whitespace-nowrap`, never wrapping into multiple lines on mobile screens down to 320px.
- [ ] Optional user greeting ("Welcome, {username}!") is styled in Google Blue and hidden on narrow mobile screens to preserve horizontal space.
- [ ] Socket connection status renders as a compact 8px pulsing green dot (with text label hidden on mobile).
- [ ] Logout button renders as a clean icon button on mobile with Google Red hover styling.
- [ ] The redundant duplicate user profile header in `Sidebar.tsx` is eliminated, allowing conversation tabs and search to start directly at the top.
- [ ] Automated tests verify header branding, single-line typography, and sidebar layout without regressions.
