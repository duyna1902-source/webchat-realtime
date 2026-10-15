# 04: Mobile Master-Detail Navigation and Google Material Chat Experience

**What to build:** Implement seamless, error-free mobile conversation navigation and elevate the in-conversation experience with Google Material conventions. On mobile viewports (`window.innerWidth < 768px`), clicking any direct conversation or room immediately hides the sidebar and renders the chat detail pane with complete message history, active partner header, and an interactive message composer, with guaranteed zero blank white screen states. The chat header on mobile features a prominent Back button `←` that restores the conversation list. In both Direct Chat and Room Chat, outgoing message bubbles render in Google Blue `#4285F4` with white text, while incoming message bubbles render in soft Google Grey `#F1F3F4` with `#202124` text. Avatars for users without custom images dynamically cycle through the four Google brand colors (Blue, Red, Yellow, Green) via deterministic hashing. Conversation search inputs and message composers adopt rounded pill shapes (`rounded-full`) with Google Blue focus rings.

**Blocked by:** 01: Setup Cropped Brand Assets and Google Design Tokens, 03: Ultra-Compact Dashboard Header and Maximal Chat Workspace

**Status:** resolved

- [x] In mobile viewports, tapping any conversation item seamlessly displays the chat detail view with full message history and composer, with zero blank white screens.
- [x] Mobile chat view renders a prominent Back button `←` in the header that returns the user to the conversation list upon clicking.
- [x] Outgoing message bubbles render in Google Blue `#4285F4` with white typography.
- [x] Incoming message bubbles render in Google Grey `#F1F3F4` with high-contrast `#202124` typography.
- [x] Fallback user avatars deterministically assign one of the 4 Google brand colors (Blue, Red, Yellow, Green) based on username initials.
- [x] Search inputs and message drafting inputs utilize rounded pill styling (`rounded-full`) and Google Blue focus rings.
- [x] Automated tests verify mobile master-detail navigation transitions, bubble color classes, and avatar color assignments.

## Answer

### Implementation Overview
1. **Deterministic Google Brand Color Avatar Utility**:
   - Implemented `getDeterministicAvatarColor(identifier)` and `getAvatarColorClass(identifier)` in `client/src/utils/avatarColor.ts`.
   - Maps user identifiers/initials deterministically to the 4 canonical Google brand colors: Blue (`#4285F4`, `bg-google-blue text-white`), Red (`#EA4335`, `bg-google-red text-white`), Yellow (`#FBBC04`, `bg-google-yellow text-google-grey900`), and Green (`#34A853`, `bg-google-green text-white`).
   - Integrated into `Sidebar.tsx`, `ChatArea.tsx`, `RoomChatArea.tsx`, and `RoomMembersModal.tsx`.

2. **Google Material Chat Experience**:
   - Outgoing message bubbles in both `ChatArea.tsx` and `RoomChatArea.tsx` render in Google Blue `#4285F4` (`bg-google-blue`) with white typography (`text-white`).
   - Incoming message bubbles render in soft Google Grey `#F1F3F4` (`bg-google-grey100`) with high-contrast `#202124` (`text-google-grey900`) typography and subtle border (`border border-google-grey200`).
   - Typing indicator dots styled with `bg-google-blue` pulsing animation.
   - Message composers, search inputs, and send buttons adopt rounded pill styling (`rounded-full`) with Google Blue focus rings (`focus-within:border-google-blue focus-within:ring-2 focus-within:ring-google-blue/20` and `focus:ring-google-blue focus:border-google-blue`).

3. **Mobile Master-Detail Navigation & Zero Blank White Screens**:
   - In `Dashboard.tsx`, mobile viewports (< 768px) dynamically toggle between full-width conversation list (`Sidebar.tsx`) and full-width chat detail pane (`ChatArea.tsx` / `RoomChatArea.tsx`) via `isChatActive` state.
   - Guaranteed zero blank white screens: tapping any conversation item immediately mounts the active conversation detail with complete header, message history, and interactive composer.
   - Prominent Back button `←` (`MobileBackButton.tsx`) using `ArrowLeft` with touch-friendly circular Google styling (`rounded-full hover:bg-google-grey100`) triggers `onBack` to restore the conversation list.
   - Desktop viewports (>= 768px) strictly preserve the dual-pane side-by-side layout with fixed 352px sidebar (`md:w-88`).

4. **Automated Verification**:
   - Added unit tests in `client/src/utils/avatarColor.test.ts` (5 tests).
   - Added integration tests in `client/src/components/chat/GoogleChatExperience.test.tsx` (7 tests).
   - All 91 client tests and 110 server tests pass cleanly with zero regressions.
