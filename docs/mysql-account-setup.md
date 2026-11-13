# Label Studio accounts with MySQL

Guest use remains available when the account API is disabled. The production Docker Compose stack contains a private MySQL 8.4 service and a same-origin Node.js account API. The browser never receives database credentials and never connects directly to MySQL. Google sign-in is deliberately not implemented.

## Production setup

1. Copy `.env.example` to `.env` and replace `MYSQL_PASSWORD` with a long random password. Do not expose MySQL port 3306 publicly.
2. Set `PUBLIC_APP_URL` to the exact public HTTPS origin, for example `https://labels.example.nl`. This value is also used for origin checks and password-recovery links. Only an `https://` URL gets a `Secure` session cookie; on plain HTTP the cookie is sent without it (otherwise Safari/Firefox silently drop the session). Add other addresses of the same deployment (e.g. a LAN IP) to `ALLOWED_ORIGINS`, comma-separated.
3. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` and `SMTP_FROM`. Registration and login work without SMTP, but password-recovery email does not.
4. Start the stack with `docker compose up -d --build`. The API applies the idempotent schema in `server/schema.sql` when it starts.
5. Test registration, login, logout, account sync and password recovery with a non-admin test account.
6. Back up the named `label-studio-mysql` volume before upgrades. Test restoring that backup separately.

The frontend image is built with `VITE_ACCOUNT_API_URL=/api`. Nginx sends `/api/*` to the private API container. Authentication uses an opaque random session token in an HttpOnly, SameSite cookie; only its SHA-256 hash is stored in MySQL. Passwords use Node.js scrypt with a unique random salt.

## Local development

Run MySQL, export the `MYSQL_*` variables and `VITE_ACCOUNT_API_URL=/api`, then start `npm run dev:api` and `npm run dev` in separate terminals. Vite proxies `/api` to port 3000. Outside production any loopback origin (`localhost`, `127.0.0.1`) is accepted, so the Vite dev server on any port can log in.

## What is synced

- **Labels** are stored one row per label (`user_labels`). Each change carries the client edit time; the newest wins, a deletion is kept as a tombstone row and wins a tie. Only labels changed since the last sync are uploaded, in requests of at most 4 MB (one label may be up to 2 MB).
- **Preferences and settings** (theme, mode, UI scale, grid/rulers, language, favorites, mapping profiles, preferred printer model, print settings, per-model printer settings, per-model calibration start values, default copies) are one document in `user_settings` with a `revision`. A save based on an older revision is refused (`settings_conflict`); background sync then adopts the account's settings, while "Opslaan in account" deliberately overwrites them.
- A device that signs in for the first time adopts the account's settings and merges its own labels in.
- Bluetooth device IDs, per-device calibration, CSV rows and print jobs stay in the browser.
- Data saved by older versions (`user_studio_data`) is converted on the user's first sync.

Sync runs automatically a few seconds after a change, when the tab becomes visible and when the browser comes back online; it can be switched off per device on the account page, which also shows the last sync time.

## Account self-service

Signed-in users can change their password (other devices are signed out), download a JSON export of everything the account stores, and delete their account after re-entering the password. Deletion cascades to sessions, labels, settings, reports and proposals; labels in the browser stay.

## Community moderation

- New reports and model proposals always receive `moderation_status = pending`.
- Accounts whose e-mail address is listed in `ADMIN_EMAILS` (comma-separated) see a moderation panel on the account page to approve or reject them.
- The public endpoint aggregates only approved reports. Reports never activate executable printer protocol code.
- Treat a browser connection, data transfer and a physically correct print as separate evidence.

## Testing

`npm run test:api` runs the unit tests and, when `MYSQL_TEST_HOST` (plus `MYSQL_TEST_USER`, `MYSQL_TEST_PASSWORD`, `MYSQL_TEST_DATABASE`) points at a disposable database, a full account lifecycle test against MySQL. CI provides a MySQL 8.4 service for it. The account e2e test (`tests/e2e/account-sync.spec.ts`) uses an in-browser fake API.

## Operational limitations

- Rate limits are stored in MySQL (`rate_limits`), so they are shared between API replicas. The client address comes from `X-Forwarded-For`, which the bundled nginx overwrites; do not expose the API container directly.
- Public registration still needs monitoring, database backups, SMTP reputation and a privacy/retention policy.
