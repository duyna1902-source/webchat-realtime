# Spec: Dependency Vulnerabilities Reported by `npm audit`

Status: needs-triage

> Captured on 2026-11-10 while working on `.scratch/fresh-clone-dev/`. None of these vulnerabilities causes or blocks that defect. They are parked here so the maintainer can review and schedule them separately. Nothing has been changed yet.

## Problem Statement

`npm install` reports **12 vulnerabilities (6 moderate, 4 high, 2 critical)**. The headline numbers sound alarming, but most of them are in test and development tooling that never ships. Without an analysis of which ones actually reach the production server, it is hard to tell what needs fixing now and what can wait for a planned upgrade.

## Exposure Analysis

Each advisory was checked against how the code actually uses the package.

### Reachable in production: fix first

| Package | Severity | Exposure | Fix |
|---|---|---|---|
| `body-parser` 1.20.8 (via express 4.22.3) | high | **Exposed.** It is a DoS through trailing bytes after a compressed request body, and the server parses JSON with express's JSON body parser, which inflates compressed bodies by default. | Non-breaking: 1.20.9 |
| `sharp` 0.34.5 | high | **Partly exposed.** The bundled libvips, libheif and librsvg have CVEs, and sharp decodes user-uploaded images (metadata read and re-encode). The upload path checks magic bytes against an allowlist first, so only JPEG, PNG, GIF and WebP reach sharp. The libheif (HEIF) and librsvg (SVG) issues are therefore not reachable, but the libvips CVEs may be. | Major: 0.35.5 |

### In production dependencies, but this code is not affected

| Package | Severity | Why not affected | Fix |
|---|---|---|---|
| `multer` 2.x | high | The DoS needs an asynchronous `fileFilter`, and the server configures no `fileFilter`. | Non-breaking: 2.5.0 or later |
| `qs` 6.16.0 (via express) | moderate | The DoS is in `stringify` with `arrayFormat: 'comma'`, and express only uses `parse`. | Non-breaking |

### Development, test and build tooling only (not shipped)

| Package | Severity | Notes | Fix |
|---|---|---|---|
| `vitest` 2.x, `tinypool`, `@vitest/mocker`, `vite-node` | critical ×2, moderate | They need the Vitest UI server to be listening, or an attacker who controls worker options or registers mocks. | Major: vitest 5.x |
| `vite` 6.x, `esbuild` (vite's copy) | high, moderate | Dev-server issues: `fs.deny` bypasses (some specific to Windows), path traversal, `launch-editor` problems on Windows, and any website being able to send requests to the dev server. They matter when the dev server is reachable, which is the case on a developer machine (the maintainer works on Windows), and more so with `--host`. | Major, together with vitest |
| `postcss-selector-parser` 6.1.4 (via tailwindcss 3) | moderate | CPU exhaustion on hostile selectors; runs at build time only. | Non-breaking |
| `fast-uri` 3.1.8 (via ajv, via the Prisma CLI) | moderate | URI parsing issues inside the Prisma CLI tooling, not reached by the server at runtime. | Non-breaking |

## Proposed Solution

Three independent pieces of work, in priority order. Each can become its own ticket under this folder once triaged.

1. **Non-breaking fixes:** `npm audit fix` without `--force`. This covers body-parser, multer, qs, fast-uri and postcss-selector-parser. The only change is the lockfile, within existing semver ranges. Low risk, and it closes the one confirmed production DoS.
2. **sharp 0.34 to 0.35:** a major upgrade of an image library that handles untrusted input.
   - Check the 0.35 changelog for API or default changes that affect the upload pipeline: EXIF rotation, metadata stripping, the input pixel limit, format conversion.
   - Run the attachment and upload tests.
   - Confirm the native binary still installs under the root `allowScripts` setting, which currently disables sharp's install script.
3. **vitest 2 to 5, with vite:** a major upgrade of the test runner and the client dev server.
   - Expect configuration and API changes in both server and client test setups (environment and globals settings, mocking APIs, the PGlite-backed server setup).
   - Re-check the Vite proxy configuration for `/api`, `/socket.io` and `/uploads`.
   - Update the `allowScripts` entries for esbuild versions that change.

## User Stories

1. As a maintainer, I want the confirmed production DoS in `body-parser` closed, so that a single crafted request cannot exhaust the server.
2. As a maintainer, I want the low-risk non-breaking fixes applied in one small change, so that most of the audit noise goes away without risk.
3. As a maintainer, I want sharp upgraded to a version whose bundled libraries have no known CVEs, so that decoding user uploads does not expose the server to image-parser bugs.
4. As a maintainer, I want the sharp upgrade to keep metadata stripping, EXIF rotation and the pixel limit working, so that the upload privacy and decompression-bomb protections do not silently regress.
5. As a developer on Windows, I want the Vite dev server upgraded past its `fs.deny` and `launch-editor` issues, so that a malicious page I visit while developing cannot read files from my machine through the dev server.
6. As a maintainer, I want the test runner off versions with critical advisories, so that the audit report is clean and real regressions are not hidden among known noise.
7. As a maintainer, I want each upgrade to land separately, so that a regression is easy to trace to one dependency.

## Out of Scope

- The fresh-clone development fix in `.scratch/fresh-clone-dev/`. It is independent and must not wait for any of this.
- Upgrading express from 4 to 5, or tailwindcss from 3 to 4. Neither is needed to clear these advisories.
- Adding automated dependency scanning (Dependabot, `npm audit` in CI). Worth considering during triage, but it is not decided.

## Further Notes

- **How to recompute:** run `npm audit` (and `npm audit --json` for detail). Advisory data changes over time, so re-run it before acting on this list.
- **Usage claims to recheck at triage, if the code has changed since:**
  - no multer `fileFilter`
  - the JSON body parser is the default one
  - the magic-byte allowlist runs before sharp
