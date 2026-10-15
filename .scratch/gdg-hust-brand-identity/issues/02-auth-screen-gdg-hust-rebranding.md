# 02: Auth Screen Variant B Rebranding with Zero-Shift Architecture

**What to build:** Transform the authentication interface into a branded GDG-HUST gateway following Variant B from the verified prototype. When visiting the login or registration view, users see a solid Google Blue `#4285F4` header block (160px height) housing a 56×56px white rounded badge displaying the sharp GDG `<>` code bracket mark, followed by the title "GDG-HUST" and chapter affiliation subtitle "Google Developer Groups on Campus • Hanoi University of Science and Technology". The form body provides a single rounded pill toggle `[ Sign In ] [ Create Account ]` at the top, and completely removes any redundant bottom toggle text link. The card container has a rigid height (540px), and both forms share an exact 275px container with the submit buttons (`Sign In to GDG-HUST →` and `Create GDG-HUST Account →`) pinned to the exact same vertical coordinates. Toggling between modes produces strictly 0px layout displacement (Zero Shift) on both laptop and mobile viewports, with the Create Account button fully visible and never clipped.

**Blocked by:** 01: Setup Cropped Brand Assets and Google Design Tokens

**Status:** resolved

- [x] Authentication card header renders a solid Google Blue `#4285F4` block (160px) with a 56×56px white rounded badge (`rounded-2xl`) containing the sharp GDG `<>` mark.
- [x] Primary title on the authentication card displays "GDG-HUST" and subtitle displays "Google Developer Groups on Campus • Hanoi University of Science and Technology".
- [x] Card contains a single pill toggle `[ Sign In ] [ Create Account ]` at the top of the form body; redundant bottom toggle text link is completely removed.
- [x] Card height is locked to 540px (max 90vh), with both Sign In and Create Account form panels sharing an exact 275px container.
- [x] Primary submit buttons for both tabs are pinned to the exact same vertical position, guaranteeing 0px layout shift when toggling tabs on both mobile and laptop viewports.
- [x] The "Create GDG-HUST Account" submit button is 100% visible on mobile and laptop screens, never pushed off-screen or clipped by overflow.
- [x] Automated integration tests verify rendered GDG-HUST text, logo attributes, zero-shift panel switching, and successful authentication flow.

## Answer

### Implementation Summary
1. **Solid Google Blue Header Block (160px)**:
   - Replaced generic chat header in `client/src/components/auth/AuthScreen.tsx` with a solid Google Blue (`#4285F4` / `bg-google-blue`) 160px block (`style={{ height: '160px' }}`).
   - Embedded a 56×56px (`w-14 h-14 rounded-2xl bg-white p-2 shadow-md`) badge displaying the tightly cropped GDG `<>` bracket mark (`/assets/brand/logo-gdg-clean.webp`).
   - Styled primary title "GDG-HUST" (`text-xl sm:text-2xl font-bold tracking-tight text-white`) and subtitle "Google Developer Groups on Campus • Hanoi University of Science and Technology" (`text-[11px] sm:text-xs text-blue-100 font-medium tracking-tight mt-1 max-w-[280px]`).

2. **Zero-Shift Rigid Container Architecture**:
   - Locked authentication card height to 540px (max 90vh) using `.auth-card-lock` and `style={{ height: '540px', maxHeight: '90vh' }}`.
   - Body container locked to 380px with a 40px rounded pill tab switcher (`[ Sign In ] [ Create Account ]`) with active/inactive state styling.
   - Removed all redundant bottom toggle links ("Don't have an account? ...", "Already have an account? ...").
   - Rigid form workspace locked to 275px (`data-testid="auth-form-container" style={{ height: '275px' }}`).
   - Panels `#panel-signin` and `#panel-register` use `absolute inset-0 flex flex-col justify-between`.
   - Submit buttons (`Sign In to GDG-HUST →` and `Create GDG-HUST Account →`) are pinned to the bottom of the 275px container, guaranteeing exact vertical alignment and 0px layout shift when toggling between tabs on all viewports.
   - "Create GDG-HUST Account" submit button is 100% visible and never pushed off-screen or clipped by overflow.

3. **Testing & Verification**:
   - Updated `client/src/App.test.tsx` with full GDG-HUST branding checks, zero-shift layout validation, tab switching, and successful login/registration flows.
   - Added unit test suite `client/src/components/auth/AuthScreen.test.tsx` asserting header dimensions, badge classes, rigid container sizes, tab switching, submit button pinning, and error alert behavior.
   - Executed `npm run test:client`: all 11 test files and 75 tests passed with 0 failures.
   - Executed `npm run build --workspace=client`: built cleanly with Vite and TypeScript compiler.

4. **Git Commit**:
   - Branch: `feature/gdg-02-auth-screen-rebranding` in `D:\Project\webchat-worktree-02`
   - Commit: `96346a4 feat(auth): rebrand auth screen with zero-shift architecture (Ticket 02)`
