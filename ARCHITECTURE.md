# Independent AutoFix site

## Unified listings (2026-09-28)

`/listings/` is an isolated dealer portal. `autofix-listings` validates Supabase Auth on every request and checks current `autofix_dealers` approval. The first admin must be assigned to the owner's verified Auth user by an operator; signup never grants approval or admin. Legacy `autofix` uses a different Supabase project whose hostname did not resolve during this implementation. Legacy members/data have not been migrated and existing auction navigation is not switched yet.

`autofix-listing-ingest` accepts Telegram webhooks with `AUTOFIX_LISTING_TELEGRAM_SECRET`, or normalized email events with `AUTOFIX_LISTING_EMAIL_SECRET`. No secret means rejection. Both require a server-managed allowed sender in `autofix_listing_sources`. Email integration must verify its provider's signature and sender authentication before forwarding `{eventId,sender,text,photos:[{base64}]}`; that provider adapter is pending the receiving email account. Existing `AUTOFIX_TELEGRAM_BOT_TOKEN` can download Telegram photos, but the webhook is not registered until the bot/chat is confirmed.

Structured input fields are 차량명, 연식, 주행거리, 가격 (explicit 원/만원/억), 연료, 사고유형, 지역, 설명. Complete single-message submissions from auto-publish sources become published; incomplete/ambiguous submissions remain review-only. Telegram albums merge by source + media group and remain review-only until checked. Event retries deduplicate by channel + event ID; changed payloads conflict. Cross-channel vehicle duplicate detection and free-form AI extraction are not implemented.

Raw source messages remain service-only. Dealer-visible fields are separate. Photos are in private `autofix-listing-photos`; the API proxies each image only after current approval and listing-state validation. The browser receives no public photo URLs. New tables do not expose unrelated Promotors data.

Validation: `tools/check-listings.mjs` runs the migration in PGlite via `PGLITE_MODULE`, asserting normalization, album merge, deduplication and anon/pending/approved/suspended access including denied self-approval. Deno checks both Edge entrypoints. Activation still needs the email provider, selected Telegram ingress, owner admin assignment and real authenticated end-to-end intake/delivery verification.

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
