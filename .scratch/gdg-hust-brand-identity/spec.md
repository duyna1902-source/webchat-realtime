# Spec: GDG-HUST Brand Identity, Zero-Shift Auth, and Ultra-Compact Chat Experience

Status: ready-for-agent

## Problem Statement

The application previously used generic "Web Chat Real-Time" branding and a uniform indigo purple theme inherited from default starter templates. 

From the user's perspective:
1. **Generic Branding & Tab Identity**: The authentication screen and dashboard top header displayed "Web Chat Real-Time" with a plain chat icon, failing to communicate the community identity of **Google Developer Groups On Campus - Hanoi University of Science and Technology (GDG-HUST)**. Browser tab titles and favicons retained default markers.
2. **Asset Sizing Issues**: Raw GDG community assets contained over 70% transparent and white padding margins, causing rendered logos to appear unreadably small, blurry, and squished.
3. **Redundant Auth Navigation**: The authentication screen contained both top mode tabs (`[Sign In] [Create Account]`) and a redundant bottom toggle text link ("Don't have an account? Create an account"), adding visual noise.
4. **Auth Layout Bouncing (Layout Shift)**: Toggling between "Sign In" (2 input fields) and "Create Account" (3 input fields) caused the card bounding box to dynamically expand and jump vertically across both desktop and mobile viewports, creating an unstable, jarring experience.
5. **Clipped / Disappearing Create Button**: On mobile and laptop screens with constrained heights, the "Create Account" button on the registration form was pushed below the card boundary or clipped out of view.
6. **Bloated Multi-Line Header & Redundant Profile Bar**: In narrow mobile viewports, the top navigation bar wrapped awkwardly across multiple lines ("GDG-" on line 1, "HUST" on line 2; "Socket" on line 1, "Connected" on line 2; "Sign" on line 1, "Out" on line 2), while a duplicate 70px-tall user profile row was stacked directly underneath in the sidebar. This header chrome consumed over half of the mobile viewport, severely crowding the actual chat workspace.
7. **Mobile Blank Screen on Conversation Open**: When opening a conversation on mobile devices or narrow screens, layout CSS collisions caused the message detail pane to render as a blank white screen rather than displaying conversation messages with a back navigation control.

The community requires a robust, responsive brand makeover that matches the validated behavior in `prototype-gdg-hust.html`, establishes GDG-HUST as the primary identity, applies official Google color tokens, guarantees zero-shift authentication, slims the header to maximize chat space, and provides flawless mobile master-detail navigation.

## Solution

1. **Pre-Processed High-Resolution Brand Assets**:
   - Deploy tightly cropped, high-resolution WebP brand assets (`logo-gdg-clean.webp` for the `<>` bracket mark and `gdg-hust-lockup-clean.webp` for the full campus lockup) to eliminate empty padding margins.
   - Update website `<title>` to "GDG-HUST" and favicon to the GDG `<>` bracket mark.

2. **Auth Screen: Variant B with Rigid Zero-Shift Architecture**:
   - **Solid Google Blue Header Block**: 160px height with solid Google Blue (`#4285F4`) background, housing a 56×56px white rounded badge (`rounded-2xl`) displaying the sharp GDG `<>` mark, followed by the crisp title **GDG-HUST** and subtitle *"Google Developer Groups on Campus • Hanoi University of Science and Technology"*.
   - **Single Tab Switcher**: Rounded pill toggle `[ Sign In ] [ Create Account ]` at the top of the card body. The redundant bottom link text is completely removed.
   - **Strict Zero-Shift Layout ("Giữ nguyên")**: The authentication card is locked to a rigid height (540px on desktop, maximum 90vh on mobile). Both Sign In and Create Account form panels share a 275px container. The primary action button (`Sign In to GDG-HUST →` and `Create GDG-HUST Account →`) is pinned to the exact same vertical coordinates. Toggling between modes produces strictly 0px layout displacement on both desktop and mobile viewports.
   - **Guaranteed Button Visibility**: The Create Account button is 100% visible in the viewport, never clipped or pushed off screen.

3. **Chat Dashboard: Variant A with Ultra-Compact Header & Maximal Chat Real Estate**:
   - **Slim Top Header (42px)**: Header height is locked to 42px (`h-11`).
   - **Single-Line Brand Lockup**: The GDG `<>` icon (28×28px) and "GDG-HUST" title are styled with `whitespace-nowrap font-bold text-sm tracking-tight text-gray-900`. The brand title is strictly guaranteed never to wrap or break across lines even on narrow viewports down to 320px.
   - **Minimalist Status & Actions**: Connection status is represented by a compact 8px pulsing green dot (`#34A853`) with optional text hidden on mobile. The user profile is a compact 24px initial avatar circle. Sign Out is an icon-only trigger on mobile.
   - **Elimination of Redundant Sidebar Profile Bar**: Remove the duplicate user profile header from the top of the sidebar. The sidebar starts immediately with the conversation type tabs (`[ Direct Chats ] [ Rooms ]`) and search bar, reclaiming ~70px of vertical space.
   - **Maximized Chat Area**: On mobile devices inside an active chat, top chrome is reduced to just ~84px total (42px top bar + 42px chat partner header), giving over 85% of visible screen height to messages and input.

4. **Reliable Mobile Master-Detail Conversation Navigation**:
   - When no conversation is active on mobile, the full-width conversation list is visible and the chat detail is cleanly unmounted/hidden.
   - Tapping any direct chat or room immediately transitions the view to the chat area, displaying complete message history, partner status, and an interactive message composer.
   - A prominent Back button `←` is always present in the chat header on mobile viewports; tapping it seamlessly returns to the conversation list.
   - Zero blank screens occur during selection, resizing, or state transitions.

5. **Official Google Color Palette & Material Token System**:
   - **Primary Action (Google Blue `#4285F4`)**: Primary buttons, active tabs, outgoing message bubbles, and input focus rings.
   - **Surfaces & Incoming Messages (Google Grey `#F1F3F4` / `#F8F9FA`)**: Incoming message bubbles use `#F1F3F4` with `#202124` text; canvas uses `#F8F9FA`.
   - **Success & Presence (Google Green `#34A853`)**: Online presence indicators, socket connected state.
   - **Destructive & Error (Google Red `#EA4335`)**: Sign out hover, room deletion, error alerts, disconnected status.
   - **Warning & Roles (Google Yellow `#FBBC04`)**: Room Owner/Admin badges, reconnecting status.
   - **4-Color Deterministic Avatars**: User avatar circles without custom images hash the username to deterministically display one of the four Google brand colors.

## User Stories

1. As a GDG-HUST community member, I want to see "GDG-HUST" in the browser tab and the GDG `<>` logo in the favicon, so that I can immediately identify the community chat tab among other open tabs.
2. As a member arriving at the login page, I want to see a solid Google Blue header with the official GDG `<>` logo and university subtitle, so that I feel assured of the chapter's official identity.
3. As a user on the authentication screen, I want a single unified pill toggle between "Sign In" and "Create Account" without redundant bottom links, so that authentication navigation is clean and uncluttered.
4. As a user toggling between "Sign In" and "Create Account" on a laptop, I want the card, header, tabs, and action button to remain completely stationary, so that my focus is not disrupted by layout jumps.
5. As a user toggling between "Sign In" and "Create Account" on a mobile phone, I want the form to switch instantly with zero vertical movement, so that the mobile interface feels native and stable.
6. As a new member registering an account, I want the "Create GDG-HUST Account" submit button to be fully visible without needing to hunt or scroll inside the card, so that registration is frictionless.
7. As an authenticated member on mobile, I want the top header to stay on a single compact line without wrapping "GDG-HUST" onto multiple lines, so that the header does not waste screen space.
8. As a mobile chat user, I want the socket status and logout controls in the top header to be compact and minimalist, so that horizontal space is preserved for the community brand.
9. As a mobile chat user, I want the redundant user profile bar at the top of the sidebar removed, so that I can see more conversations at once in my list.
10. As a mobile chat user clicking on a conversation, I want the message history and chat input to appear immediately instead of a blank white screen, so that I can read and reply to messages without error.
11. As a mobile chat user inside a conversation, I want a prominent Back button `←` in the chat header, so that I can return to the conversation list with a single tap.
12. As a mobile chat user, I want chat headers to be ultra-slim so that over 85% of my screen is dedicated to reading and composing messages.
13. As a chat participant sending a message, I want my message bubble to appear in Google Blue with white text, so that my own messages stand out clearly.
14. As a chat participant reading incoming messages, I want incoming bubbles to appear in soft Google Grey with dark text, so that reading conversations is comfortable and legible.
15. As a user browsing conversations, I want avatars without pictures to display across the four Google brand colors, so that conversation lists look vibrant and distinguishable.
16. As a user monitoring connection health, I want an active socket connection to show a subtle pulsing Google Green dot, so that connection health is visible without visual clutter.
17. As a desktop user, I want the dual-pane layout (sidebar + chat pane) to remain side-by-side with full height and zero regression, so that desktop productivity is maintained.
18. As a user switching between Direct Chats and Rooms, I want the active tab to highlight in Google Blue, so that my current context is immediately clear.

## Implementation Decisions

- **Cropped Static Brand Assets**:
  - Store `logo-gdg-clean.webp` and `gdg-hust-lockup-clean.webp` in `client/public/assets/brand/`.
  - Update `client/index.html` favicon link to `/assets/brand/logo-gdg-clean.webp` and document `<title>` to "GDG-HUST".

- **Central Google Color System Tokens**:
  - Extend the styling configuration (`client/tailwind.config.js`) with official Google color tokens:
    - `google-blue`: `#4285F4`, `google-blue-hover`: `#3367D6`, `google-blue-subtle`: `#E8F0FE`
    - `google-red`: `#EA4335`, `google-red-subtle`: `#FCE8E6`
    - `google-yellow`: `#FBBC04`, `google-yellow-subtle`: `#FEF7E0`
    - `google-green`: `#34A853`, `google-green-subtle`: `#E6F4EA`
    - `google-grey50`: `#F8F9FA`, `google-grey100`: `#F1F3F4`, `google-grey200`: `#E8EAED`, `google-grey300`: `#DADCE0`, `google-grey700`: `#5F6368`, `google-grey900`: `#202124`

- **AuthScreen Zero-Shift Architecture**:
  - The authentication card container is locked to a fixed height (`height: 540px; max-height: 90vh;`).
  - Header is fixed at 160px with `bg-[#4285F4]` and white badge (56×56px) displaying the cropped GDG `<>` mark.
  - The body container is fixed at 380px with a 40px tab switcher `[Sign In] [Create Account]`.
  - The form workspace is a 275px container with `position: relative`. Both `panel-signin` and `panel-register` use `position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: space-between;`.
  - Primary submit buttons are pinned to the bottom of each panel, ensuring that toggling between tabs maintains the exact same button Y-coordinate and produces 0px layout shift.
  - Redundant bottom toggle link ("Don't have an account? ...") is removed from the DOM.
  - Prototype reference snippet encoding the zero-shift structure:
    ```html
    <!-- Rigid Zero-Shift Form Container (from prototype-gdg-hust.html) -->
    <div class="auth-card-lock bg-white rounded-3xl shadow-xl border border-google-grey200 overflow-hidden shrink-0 flex flex-col relative" style="height: 540px; max-height: 90vh;">
      <div class="bg-google-blue px-6 py-5 text-center text-white shrink-0" style="height: 160px;">...</div>
      <div class="p-6 flex-1 flex flex-col justify-between" style="height: 380px;">
        <div class="flex p-1 bg-google-grey100 rounded-full mb-4 border border-google-grey200 shrink-0 h-10">...</div>
        <div class="relative flex-1" style="height: 275px;">
          <div id="panel-signin" class="absolute inset-0 flex flex-col justify-between">...</div>
          <div id="panel-register" class="absolute inset-0 flex flex-col justify-between hidden">...</div>
        </div>
      </div>
    </div>
    ```

- **Dashboard Slim Header & Maximal Chat Workspace**:
  - Top header is constrained to height 42px (`h-11`).
  - Brand block uses `whitespace-nowrap font-bold text-sm tracking-tight text-gray-900` with a 28×28px GDG `<>` mark. Line wrapping is strictly prevented.
  - Socket status badge uses a compact 8px green pulse dot with text hidden on mobile viewports.
  - Current user avatar is rendered as a 24px circle in the top header.
  - Duplicate user profile row in `Sidebar.tsx` is eliminated. The sidebar starts immediately with conversation mode tabs (`[Direct Chats] [Rooms]`) and search bar.
  - In mobile viewports (`window.innerWidth < 768px`), master-detail navigation is strictly mutually exclusive: when a chat is active, the sidebar is hidden (`display: none`), and the chat area takes 100% width with a Back button `←`. When no chat is active, the sidebar takes 100% width and the chat area is hidden.

- **Conversational Styling & Avatar Utility**:
  - Outgoing message bubbles use `bg-google-blue text-white rounded-2xl rounded-br-sm`.
  - Incoming message bubbles use `bg-google-grey100 text-google-grey900 rounded-2xl rounded-bl-sm border border-google-grey200`.
  - Initial-based avatars hash the user's username or ID to deterministically apply one of the 4 Google colors (`google-blue`, `google-red`, `google-yellow`, `google-green`).

## Testing Decisions

- **Testing Philosophy**:
  - Tests verify observable DOM contracts, layout stability, accessibility attributes, and responsive state transitions rather than private implementation details.
- **Target Seams**:
  - **AuthScreen Seam (`client/src/App.test.tsx` / `AuthScreen.test.tsx`)**:
    - Verify "GDG-HUST" title, chapter affiliation subtitle, and GDG logo image render in the header.
    - Verify `[Sign In]` and `[Create Account]` tabs toggle the respective forms.
    - Verify Create Account submit button is present and clickable in the registration panel.
    - Verify the absence of any redundant bottom toggle text link.
    - Verify form container dimensions remain constant during tab transitions.
  - **Dashboard & Header Seam (`client/src/components/dashboard/ResponsiveDashboard.test.tsx`)**:
    - Verify the top navigation bar renders the GDG `<>` logo and single-line "GDG-HUST" title with `whitespace-nowrap`.
    - Verify connection status renders a compact green indicator.
    - Verify logout button renders cleanly.
    - Verify sidebar does not render a duplicate user profile header.
  - **Mobile Master-Detail Seam (`client/src/components/chat/ResponsiveMobileInput.test.tsx`)**:
    - Verify clicking a conversation in mobile viewport hides the sidebar and renders the chat detail pane with messages.
    - Verify the Back button `←` is visible on mobile chat view and clicking it restores the conversation list.
    - Verify zero blank screen states exist during conversation activation.
  - **Chat Area Styling Seam (`client/src/components/chat/DirectChat.test.tsx`)**:
    - Verify outgoing message bubbles apply the Google Blue class.
    - Verify incoming message bubbles apply the Google Grey class.
    - Verify default avatar circles assign one of the 4 Google palette colors.
  - **Full Regression Seam**:
    - Execute `npm run test:client` to confirm all existing unit and integration tests continue to pass with zero regressions.

## Out of Scope

- Backend schema changes, database migrations, or server API endpoint alterations.
- Google OAuth 2.0 / Google Single Sign-On (SSO) integration (the task focuses strictly on UI/UX brand identity and styling).
- Structural changes to real-time Socket.io event protocols or payload schemas.
- Audio notification sound replacement.

## Further Notes

- Prototype implementation verified in [prototype-gdg-hust.html](file:///d:/Project/webchat-realtime/prototype-gdg-hust.html).
- Processed assets located at `d:/Project/webchat-realtime/image_gdg/logo-gdg-clean.webp` and `d:/Project/webchat-realtime/image_gdg/gdg-hust-lockup-clean.webp`.
