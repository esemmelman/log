# Log

Live app: https://esemmelman.github.io/log/. Pushes to `main` automatically build and deploy through GitHub Pages.

The top entry box supports three modes:
- Click once to dictate. Speech is transcribed to text and saved after three seconds without speech input. Microphone permission and a browser supporting SpeechRecognition are required.
- Double-click (or press F2) to type. Press Enter to save. Escape stops dictation and keeps the transcript for editing.

- Triple-click to search saved entries. Press Escape to return to your draft.

Search filters all saved entries. Entries appear in descending date/time order, using the browser timezone. Existing entries from every previous item remain visible. New entries use a backing item named Log in the existing private tables. Audio recordings are not stored; the transcript is saved. Failed saves retain the text; press Enter to retry.

Sign in with an existing bnaimitzvah email/password account. Supabase project: `fgomaujsdblpzxhnnqrg`. Existing row-level policies keep each user's data private. No schema change is required.

## Build

Run `npm ci`, `npm run check`, and `npm run build`. Serve `dist/` using a static server. The committed key is publishable. Do not rerun `schema.sql` against existing tables.
