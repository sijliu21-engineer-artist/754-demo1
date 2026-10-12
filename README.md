# CaseMate — Sprint 2 Alpha

Medical-record web app built with React, TypeScript and Vite. Users upload images/PDFs, retain originals, generate concise summaries and ask questions about records saved to their account. This is a browser app, not a published native iOS/Android app.

## Run locally (Windows / VS Code)

1. Install Node.js 22 and open this repository folder in VS Code.
2. Open a terminal and run:

```powershell
npm.cmd install -g pnpm@10.34.3
pnpm.cmd install --frozen-lockfile
pnpm.cmd dev
```

3. Open the Local URL printed by Vite (normally http://localhost:8443). Keep the terminal running. Restart VS Code after installing Node if commands cannot be found.
4. Register a test account; use synthetic medical documents for evaluation.

The frontend connects to the existing Supabase project configured in `utils/supabase/info.tsx`. Its public anon key is a client identifier, not a service-role secret. Running the frontend does not deploy backend changes.

## Alpha review

Test login → select one or several images/PDFs → upload → OCR → saved originals → generated summary → AI question → logout/login → retained records. Each upload batch creates one upload record and one report entry, even when it contains several originals. Failed report generation can be retried without re-uploading saved originals.

Current limits: 10 files per batch, 8 MB per file, 24 MB per batch; PDF limit 60 pages. Summary selection omits some results; verify against originals. OCR, redaction and AI responses require further evaluation; use synthetic data for this public repository's demonstrations.

## Project structure

| Path | Purpose |
| --- | --- |
| `src/App.tsx` | Navigation and primary UI |
| `src/components/` | Report, original-file and other UI components |
| `src/lib/recognition.ts` | Browser PDF text extraction and OCR |
| `supabase/functions/server/` | Account/session, upload, report and chat APIs |
| `utils/supabase/info.tsx` | Frontend project connection |
| `.figma/make/` | Figma scaffold configuration referenced by Vite |
| `docs/` | Architecture, setup and contribution evidence guides |
| `.github/` | PR/issue templates and automated checks |

## Checks

```powershell
pnpm.cmd exec tsc --noEmit
pnpm.cmd build
```

With Deno installed:

```powershell
deno check --config supabase/functions/deno.json supabase/functions/server/index.tsx
deno test --allow-env --config supabase/functions/deno.json supabase/functions/server/report_routes_test.ts supabase/functions/server/record_routes_test.ts
```

## Collaboration and deployment

See [CONTRIBUTING.md](CONTRIBUTING.md), [environment setup](docs/ENVIRONMENT.md), [architecture decisions](docs/ARCHITECTURE.md), and [evidence checklist](docs/SPRINT2-EVIDENCE.md). Backend secrets belong in Supabase Edge Function Secrets, never in Git. The repository alone is not a deployed frontend preview.
