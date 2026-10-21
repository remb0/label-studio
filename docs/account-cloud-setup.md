# Optional Label Studio cloud account setup

Guest use is always available; without environment variables the Account page shows a configuration message. This implementation uses Supabase Auth magic links and a per-user JSON snapshot in Postgres (not a shared local account).

1. Create a Supabase project and configure Authentication -> URL Configuration: add the published Label Studio origin to the redirect allowlist, including / paths.
2. Run `docs/cloud-schema.sql` in Supabase SQL Editor.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` during the Vite build. The anon key is a public client key, **never use a service_role key**.
4. Deploy and request a magic link from the Account page. Keep the email confirmation requirement enabled. HTTPS is required in production.
5. Cloud sync is deliberately manual. **Save to cloud** uploads local labels and preferences. **Load from cloud** explicitly overwrites local labels/settings after a confirmation; export a backup first. This avoids accidental overwrites and requires no background processing.

## Limitations
- A cloud snapshot is a single JSON document, not an automatic multi-device conflict resolver. Its practical size is limited by the Supabase/PostgREST request limits; large embedded images may increase it greatly.
- Auth session is stored in this browser's localStorage for magic-link restoration and refresh. Avoid shared devices. Logging out removes this app's session.
- Cloud account deletion, billing and legal/privacy policies must be handled by the operator before production public signup.
- Configure rate limits, CAPTCHA/abuse protection and email SMTP deliverability in Supabase.
