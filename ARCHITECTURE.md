# Independent AutoFix site

Production input is `src/pages`, local assets and feature modules. `npm run build` produces `standalone` without HTTP requests or reading `source-archive`/`dist`. Archives and extraction tools are migration evidence, not runtime dependencies.

`src/app/independent.js` is the single page entry. Features export `mount`; services own network access. Consultation receives its service from the entry point. Board and blog readers access local snapshots. Imweb layout class names and vendor styles remain to preserve the original appearance; no Imweb SDK executes.

External boundaries:
- Consultation uses the original FormSubmit destination and checks HTTP/application success. Real email delivery is unverified; no synthetic submission was sent.
- `/pro` reservation buttons navigate to the existing Promotors Firebase site (`#reserve`). Its existing Supabase project remains authoritative; this site does not copy credentials, sessions or private records.
- `/car` navigates to the existing auction application. Auction health is not implied by the link.
- Blog and two public board articles are local snapshots. Automatic refresh and an independent board editor are not implemented. The original private article is not exported.

Production domain/DNS and search registration have not been switched. Preview uses noindex/robots exclusion. Domain cutover requires URL/redirect and operational reception verification.

Run `npm run build`, `node tools/check-independent.mjs`, then the dev server and `PUBLIC_DIR=standalone npm run check`. Browser comparison verifies layout and destinations; mocks cannot prove email delivery or Supabase writes.
