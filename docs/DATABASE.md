# CaseMate categorized database

Canonical workspace: `H:\IXDS754\IXDS754-Backend`.

## Tables

| Table | Purpose |
| --- | --- |
| user_accounts | Username, display name, profile metadata |
| password_credentials | Existing PBKDF2-SHA256 password hash, salt, algorithm and iterations; never plaintext passwords |
| login_sessions | Session owner, expiration and SHA-256 token hash |
| uploaded_records | Upload batches, recognition text, owner and revision inputs |
| uploaded_files | Every individual original file and its Supabase Storage path |
| medical_reports | Generated sections, source references, warnings and revision |
| indicator_extractions | Per-upload extraction cache and warnings |
| indicators | Catalog of raw source indicator labels |
| measurements | Each numeric result, unit, examination date, patient label, reference range and source quote; the source for Compare past charts |
| app_settings | Internal application metadata, such as demo seed version |
| migration_audits | Completed backfill counts and migration identifier |

Original image and PDF bytes remain in the private `casemate-records` Storage bucket. Bilingual display aliases are defined in `IndicatorHistory.tsx`; the catalog preserves source labels. Chart lines are calculated from measurements, not stored as duplicate image/data copies. There are no real payments, human-review orders or reviewer accounts, so those tables are not fabricated.

## Migration and cutover

1. Execute `supabase/migrations/202610220001_split_business_tables.sql` in the project SQL editor. It runs transactionally, copies existing data, validates each migrated key, and never removes legacy rows. Re-running skips completed backfill.
2. Deploy `data_store.tsx`, and the auth/record/report route files that import it. The RPC interface preserves existing frontend API payloads; no app login password reset is required.
3. Verify existing login/session, uploaded originals, report loading and Compare past. Inspect counts in `migration_audits` and normalized tables.
4. Keep `kv_store_ba71e98d` as a pre-cutover backup. It stops receiving new application writes after deployment. Do not delete it or switch back to it without reconciling post-cutover changes.

All categorized tables, the compatibility view and RPCs are inaccessible to `anon` and `authenticated`. Only the Edge Function service role can use them; routes resolve the custom user session and filter by owner. Do not add public-read policies to credential, session, upload or medical-data tables. The compatibility view is a server-only API bridge, not a second copy of business data.

A record update invalidates its indicator extraction and measurement rows transactionally. Re-index in Compare past to regenerate data from the new OCR text. Saving an extraction replaces its measurement rows atomically, so an invalid ownership reference rolls back the entire write.

The migration is tested with a temporary PGlite PostgreSQL database using synthetic fixtures: hash/session preservation, individual files, chart dates, legacy retention, idempotence, RPC grants, wildcard-safe prefix queries, owner mismatch rollback, OCR invalidation and session deletion.


## Applied migration verification (2026-10-22)

The production migration and Edge Function cutover completed. All 114 legacy entries were verified, 153 historical measurement rows matched the backup, and all 11 new tables had RLS enabled with no `anon`/`authenticated` SELECT grants. An existing account logged in using its unchanged password; its new session appeared only in `login_sessions`. The existing upload list and Compare past chart loaded from the new tables.

Reproduce isolated SQL tests from the repository root:

```powershell
npm.cmd install --prefix tmp/db-migration-test --no-save --package-lock=false @electric-sql/pglite
node scripts/test-database-migration.cjs
```

These tests use synthetic data in memory and do not connect to production.
