# 01: Setup Cropped Brand Assets and Google Design Tokens

**What to build:** Establish the foundational visual assets and styling design tokens for the Google Developer Groups (GDG) brand system. The web application displays "GDG-HUST" in the browser tab title, renders the official GDG `<>` code bracket symbol as the browser favicon, provides high-resolution, tightly cropped static brand images (`logo-gdg-clean.webp` and `gdg-hust-lockup-clean.webp` with zero excessive padding) through the public asset pipeline, and exposes central Google color design tokens (Google Blue `#4285F4`, Google Red `#EA4335`, Google Yellow `#FBBC04`, Google Green `#34A853`, and neutral Google surface greys) with the primary brand color mapped to Google Blue.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Browser document title in `client/index.html` is updated to "GDG-HUST".
- [x] Browser favicon link references the official cropped GDG `<>` bracket mark image.
- [x] High-resolution cropped GDG brand images (`logo-gdg-clean.webp` and `gdg-hust-lockup-clean.webp`) are deployed into `client/public/assets/brand/`.
- [x] Styling configuration (`client/tailwind.config.js`) defines semantic Google palette tokens (`google-blue`, `google-red`, `google-yellow`, `google-green`, `google-grey`) and aliases the primary application theme to Google Blue.
- [x] Client application builds cleanly without CSS or asset packaging errors (`npm run build` or Vite build check).

## Answer

### Implementation Summary
1. **Brand Assets Deployment**:
   - Deployed high-resolution, cropped brand assets to `client/public/assets/brand/`:
     - `logo-gdg-clean.webp`: Sharp GDG `<>` bracket mark with zero extra padding.
     - `gdg-hust-lockup-clean.webp`: Full GDG on Campus Hanoi University of Science and Technology lockup.
2. **Browser Identity (`client/index.html`)**:
   - Updated browser document `<title>` to `"GDG-HUST"`.
   - Updated favicon to `/assets/brand/logo-gdg-clean.webp`.
3. **Google Palette Tokens (`client/tailwind.config.js`)**:
   - Defined semantic Google palette tokens:
     - `google-blue`: `#4285F4`, `google-blue-hover`: `#3367D6`, `google-blue-subtle`: `#E8F0FE`
     - `google-red`: `#EA4335`, `google-red-subtle`: `#FCE8E6`
     - `google-yellow`: `#FBBC04`, `google-yellow-subtle`: `#FEF7E0`
     - `google-green`: `#34A853`, `google-green-subtle`: `#E6F4EA`
     - `google-grey50`: `#F8F9FA`, `google-grey100`: `#F1F3F4`, `google-grey200`: `#E8EAED`, `google-grey300`: `#DADCE0`, `google-grey700`: `#5F6368`, `google-grey900`: `#202124`
   - Aliased `primary` application tokens to Google Blue `#4285F4`.
4. **Verification**:
   - Created test suite `client/src/BrandAssetsTokens.test.ts` verifying all token mappings, title, favicon, and brand asset presence.
   - Built and packaged via `npm run build --workspace=client` with zero errors.
