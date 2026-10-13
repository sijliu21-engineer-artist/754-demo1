# Environment and build pathway

## Reproducible setup

Node.js 22, pnpm 10.34.3, VS Code and a browser are the baseline. Clone the repository, open the cloned folder, run `pnpm install --frozen-lockfile`, then `pnpm dev`. Read the server's Local URL. Use browser device emulation for mobile layout testing. Optional Deno and its VS Code extension support the backend's Deno imports.

`.vscode/settings.json` may contain a machine-specific Deno executable path: update it for your own computer. `.mise.toml` documents Node and pnpm versions. Preserve `.figma/make/site.json`; Vite imports it.

## Backend

Supabase hosts PostgreSQL, private original-file storage and Edge Functions. Required backend secrets are `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `DEEPSEEK_API_KEY`; configure them in the project's Secrets interface. Never expose service-role/DeepSeek keys in the frontend or repository.

Authorized maintainers can deploy using `deploy-backend.cmd` (Supabase CLI login required), or update all changed files in the existing Edge Function dashboard. Function name: `make-server-ba71e98d`. Verify health and account-protected endpoints after deployment. Source edits alone do not update deployed functions.

## Recovery

- Command unavailable: install Node/pnpm and restart VS Code.
- Port 8443 occupied: reuse the existing development server or deliberately configure another PORT.
- OCR too unclear: use a sharper image or selectable-text PDF.
- Report service failure: retain saved originals and retry generation.
- Deployment regression: use Git history to identify a known-good revision, review it and redeploy. GitHub and Supabase deployment state are separate.

## Member setup evidence

Each member should record OS/runtime versions, install/build results and a screenshot of the core user flow. No hosted frontend URL or instructor approval is implied by this document.
