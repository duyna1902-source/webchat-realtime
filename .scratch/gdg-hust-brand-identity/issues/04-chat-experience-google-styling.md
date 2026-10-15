# 04: Mobile Master-Detail Navigation and Google Material Chat Experience

**What to build:** Implement seamless, error-free mobile conversation navigation and elevate the in-conversation experience with Google Material conventions. On mobile viewports (`window.innerWidth < 768px`), clicking any direct conversation or room immediately hides the sidebar and renders the chat detail pane with complete message history, active partner header, and an interactive message composer, with guaranteed zero blank white screen states. The chat header on mobile features a prominent Back button `←` that restores the conversation list. In both Direct Chat and Room Chat, outgoing message bubbles render in Google Blue `#4285F4` with white text, while incoming message bubbles render in soft Google Grey `#F1F3F4` with `#202124` text. Avatars for users without custom images dynamically cycle through the four Google brand colors (Blue, Red, Yellow, Green) via deterministic hashing. Conversation search inputs and message composers adopt rounded pill shapes (`rounded-full`) with Google Blue focus rings.

**Blocked by:** 01: Setup Cropped Brand Assets and Google Design Tokens, 03: Ultra-Compact Dashboard Header and Maximal Chat Workspace

**Status:** claimed

- [ ] In mobile viewports, tapping any conversation item seamlessly displays the chat detail view with full message history and composer, with zero blank white screens.
- [ ] Mobile chat view renders a prominent Back button `←` in the header that returns the user to the conversation list upon clicking.
- [ ] Outgoing message bubbles render in Google Blue `#4285F4` with white typography.
- [ ] Incoming message bubbles render in Google Grey `#F1F3F4` with high-contrast `#202124` typography.
- [ ] Fallback user avatars deterministically assign one of the 4 Google brand colors (Blue, Red, Yellow, Green) based on username initials.
- [ ] Search inputs and message drafting inputs utilize rounded pill styling (`rounded-full`) and Google Blue focus rings.
- [ ] Automated tests verify mobile master-detail navigation transitions, bubble color classes, and avatar color assignments.
