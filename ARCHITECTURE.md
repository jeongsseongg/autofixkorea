# Independent AutoFix site

Production input is `src/pages`, local assets and feature modules. `npm run build` produces `out` without HTTP requests or reading `source-archive`/`dist`. Archives and extraction tools are migration evidence, not runtime dependencies.

`src/app/independent.js` is the single page entry. Features export `mount`; services own network access. Consultation receives its service from the entry point. Board and blog readers access local snapshots. Imweb layout class names and vendor styles remain to preserve the original appearance; no Imweb SDK executes.

External boundaries:
- The published version still uses FormSubmit. The working source now sends hero, quick, consultation and Promotors forms to a dedicated Supabase Edge Function with stable request IDs, validation and preserved inputs on failure.
- `autofix_consultations` and service-only RPCs are installed in the existing Promotors project. No anonymous read/write/RPC permissions exist. Public-key authentication succeeds while the table returns permission denied.
- Edge deployment was rejected by automatic approval review because the Telegram recipient is not confirmed. This frontend change is not published. Bot token/chat secrets, queue retry scheduling and real delivery verification remain pending; do not activate the frontend before these are ready.
- The handler stores receipts before notification and claims queued rows with a lease. Retry delivery is at least once: an ambiguous Telegram timeout can produce a repeated notification bearing the same receipt ID. Never claim exactly-once Telegram delivery.
- The Promotors form now has named fields, consent and a native submit action. This creates an AutoFix consultation; it does not create a booking in the separate Promotors app.
- `/car` navigates to the existing auction application. Auction health is not implied by the link.
- Blog and two public board articles are local snapshots. Automatic refresh and an independent board editor are not implemented. The original private article is not exported.

Production domain/DNS and search registration have not been switched. Preview uses noindex/robots exclusion. Domain cutover requires URL/redirect and operational reception verification.

Run `npm run build`, `node tools/check-independent.mjs`, `node tools/check-consultation.mjs`, `deno check supabase/functions/autofix-consultation/index.ts`, then the dev server and `PUBLIC_DIR=out npm run check`. Local checks pass. Browser inspection verifies the reservation form fields. DB write/deduplication tests could not run through the read-only MCP role; no production Telegram test was sent.
