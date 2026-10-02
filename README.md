# Log

A responsive item list with a separate dated conversation log for each item. Add, rename, and delete items; choose Me or Other when saving text. Me appears on the left and Other is indented. Dates use the browser's timezone and display MM-DD ddd. Original timestamps are assigned by the database and cannot be edited through the client.

Backend: Supabase project `bnaimitzvah` (`fgomaujsdblpzxhnnqrg`). Dedicated tables: `elliot_log_items_v1` and `elliot_log_records_v1`. Each signed-in user can access only their own items and records. Use an existing email/password account in this project. Deleting an item removes its records.

## Build

Run `npm ci`, `npm run check`, and `npm run build`. Serve `dist/` using a static server. The committed browser key is a publishable key; no service-role credentials are used. Database schema is in `schema.sql` and has already been applied to the project. Do not rerun it against existing tables.

Sites hosting is configured in `.openai/hosting.json`.
