# 02: Auth Screen Variant B Rebranding with Zero-Shift Architecture

**What to build:** Transform the authentication interface into a branded GDG-HUST gateway following Variant B from the verified prototype. When visiting the login or registration view, users see a solid Google Blue `#4285F4` header block (160px height) housing a 56×56px white rounded badge displaying the sharp GDG `<>` code bracket mark, followed by the title "GDG-HUST" and chapter affiliation subtitle "Google Developer Groups on Campus • Hanoi University of Science and Technology". The form body provides a single rounded pill toggle `[ Sign In ] [ Create Account ]` at the top, and completely removes any redundant bottom toggle text link. The card container has a rigid height (540px), and both forms share an exact 275px container with the submit buttons (`Sign In to GDG-HUST →` and `Create GDG-HUST Account →`) pinned to the exact same vertical coordinates. Toggling between modes produces strictly 0px layout displacement (Zero Shift) on both laptop and mobile viewports, with the Create Account button fully visible and never clipped.

**Blocked by:** 01: Setup Cropped Brand Assets and Google Design Tokens

**Status:** ready-for-agent

- [ ] Authentication card header renders a solid Google Blue `#4285F4` block (160px) with a 56×56px white rounded badge (`rounded-2xl`) containing the sharp GDG `<>` mark.
- [ ] Primary title on the authentication card displays "GDG-HUST" and subtitle displays "Google Developer Groups on Campus • Hanoi University of Science and Technology".
- [ ] Card contains a single pill toggle `[ Sign In ] [ Create Account ]` at the top of the form body; redundant bottom toggle text link is completely removed.
- [ ] Card height is locked to 540px (max 90vh), with both Sign In and Create Account form panels sharing an exact 275px container.
- [ ] Primary submit buttons for both tabs are pinned to the exact same vertical position, guaranteeing 0px layout shift when toggling tabs on both mobile and laptop viewports.
- [ ] The "Create GDG-HUST Account" submit button is 100% visible on mobile and laptop screens, never pushed off-screen or clipped by overflow.
- [ ] Automated integration tests verify rendered GDG-HUST text, logo attributes, zero-shift panel switching, and successful authentication flow.
