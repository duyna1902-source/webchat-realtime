# 01: Setup Cropped Brand Assets and Google Design Tokens

**What to build:** Establish the foundational visual assets and styling design tokens for the Google Developer Groups (GDG) brand system. The web application displays "GDG-HUST" in the browser tab title, renders the official GDG `<>` code bracket symbol as the browser favicon, provides high-resolution, tightly cropped static brand images (`logo-gdg-clean.webp` and `gdg-hust-lockup-clean.webp` with zero excessive padding) through the public asset pipeline, and exposes central Google color design tokens (Google Blue `#4285F4`, Google Red `#EA4335`, Google Yellow `#FBBC04`, Google Green `#34A853`, and neutral Google surface greys) with the primary brand color mapped to Google Blue.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Browser document title in `client/index.html` is updated to "GDG-HUST".
- [ ] Browser favicon link references the official cropped GDG `<>` bracket mark image.
- [ ] High-resolution cropped GDG brand images (`logo-gdg-clean.webp` and `gdg-hust-lockup-clean.webp`) are deployed into `client/public/assets/brand/`.
- [ ] Styling configuration (`client/tailwind.config.js`) defines semantic Google palette tokens (`google-blue`, `google-red`, `google-yellow`, `google-green`, `google-grey`) and aliases the primary application theme to Google Blue.
- [ ] Client application builds cleanly without CSS or asset packaging errors (`npm run build` or Vite build check).
