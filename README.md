# Log

Live app: https://esemmelman.github.io/log/. GitHub Pages automatically builds and deploys updates pushed to `main` through `.github/workflows/pages.yml`.

A responsive item list with a separate dated conversation log for each item. Use the plus beside Items to add an item. Single-click an item to highlight it, then click Log to display its entries; double-click the item to reveal Change and Delete. Double-click Log to open a rich text entry field directly beneath Log, with previous entries below it, newest first. The toolbar supports undo/redo, text styles, headings, lists, alignment, and links. Choose Me or Other. Click Save to add an entry or Cancel to discard the draft. Entries never save automatically. Save or cancel before switching items, starting another entry, or signing out. Me appears on the left and Other is indented. Dates use the browser's timezone and display MM-DD ddd. h:mm am/pm. Original timestamps are assigned by the database and cannot be edited through the client. Keyboard equivalents: Enter on the item list reveals actions, and Shift+Enter on Log opens an entry.

Backend: Supabase project `bnaimitzvah` (`fgomaujsdblpzxhnnqrg`). Dedicated tables: `elliot_log_items_v1` and `elliot_log_records_v1`. Each signed-in user can access only their own items and records. Use an existing email/password account in this project. Deleting an item removes its records.

## Build

Run `npm ci`, `npm run check`, and `npm run build`. Serve `dist/` using a static server. The committed browser key is a publishable key; no service-role credentials are used. Database schema is in `schema.sql` and has already been applied to the project. Do not rerun it against existing tables.

Sites hosting is configured in `.openai/hosting.json`. The autosave update policy is recorded in `autosave-schema.sql` and has already been applied.
