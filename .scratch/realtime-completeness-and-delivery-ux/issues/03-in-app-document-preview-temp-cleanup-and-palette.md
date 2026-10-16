# 03: In-App Document Preview Modal, Ephemeral Temp File Cleanup & Google Palette Alignment

**What to build:** End-to-end in-app `Document Preview` modal for document attachments in `Direct Chat` and `Room Chat`, automatic cleanup of temporary local Multer files after external cloud storage uploads, and 100% alignment of secondary attachment/media/loading UI components with `Google Palette Semantics` while keeping the top navigation header unchanged.

When a user clicks on a document `Attachment` card in a message bubble, an in-app `Document Preview` modal (`DocumentPreviewModal`) opens instead of forcing an immediate blind download:
- For `PDF` documents (`.pdf`), the modal renders the PDF inline inside an embedded `<iframe>` viewer.
- For text-based documents (`.txt`, `.md`, `.csv`, `.json`, `.xml`), the modal fetches and displays the text content inside a scrollable, formatted monospace `<pre>` container.
- For binary office or archive formats (`.docx`, `.xlsx`, `.pptx`, `.zip`, etc.), the modal displays a structured file metadata summary card (filename, formatted file size, format badge) with a prominent **"Download to view"** button.
- Every document preview modal header provides both a direct **Download** action and a **Close** button.

On the server, when uploading an `Attachment` via external cloud storage adapters (`Cloudinary` or `Supabase`), the temporary local file written by Multer is always removed from disk (`fs.promises.unlink` inside a `try / finally` block) once the remote upload finishes or fails, preventing ephemeral disk space exhaustion. Across the frontend workspace, all remaining legacy `indigo-*` utility classes in attachment cards, composer preview bars, emoji pickers, GIF modals, and loading screens are replaced with `Google Palette Semantics` (`google-blue`, `google-grey`), while preserving the existing top navigation bar (`<header>` in `Dashboard.tsx`) completely unchanged.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Clicking a document `Attachment` in `Direct Chat` or `Room Chat` opens `DocumentPreviewModal` with header metadata, a Download button, and a Close button (including `Escape` key and backdrop click dismissal).
- [x] `DocumentPreviewModal` renders `.pdf` files inline via an `<iframe />`, fetches and renders `.txt`, `.md`, `.csv`, `.json`, and `.xml` files in a scrollable `<pre>` viewer, and renders a metadata summary card with a **"Download to view"** action for binary formats (`.docx`, `.xlsx`, `.pptx`, `.zip`).
- [x] Cloud storage upload adapters (`CloudinaryStorageAdapter` and `SupabaseStorageAdapter`) delete the temporary local file via `fs.promises.unlink` in a `finally` block after uploading, while `LocalStorageAdapter` retains the local file.
- [x] No legacy `indigo-*` classes remain in attachment cards, composer attachment preview bars, emoji picker popovers, GIF search modals, or loading screens; all use `google-blue` and `google-grey` tokens.
- [x] The top navigation bar in `Dashboard.tsx` (`[GDG Logo] GDG-HUST | Welcome, <username>!` on the left and `[Notification Bell] [● Connected] [User Avatar] [Sign Out]` on the right) remains 100% unchanged.
- [x] Server and client tests verify `DocumentPreviewModal` rendering across PDF, text, and binary document types and confirm temporary file cleanup after cloud upload.
