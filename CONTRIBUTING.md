# Team collaboration

## Branches and commits

- `main`: shared reviewed baseline.
- `feature/<task>`: new functionality; `fix/<task>`: defects; `docs/<task>`: documentation.
- Start each task from current `main`. Keep each PR focused and use clear commit messages.
- Link the GitHub issue and the real Teamwork ticket in the PR. Do not invent ticket identifiers.

```powershell
git switch main
git pull --ff-only
git switch -c feature/your-task
# Edit and run the relevant checks.
git add <specific-files>
git commit -m "Describe the completed change"
git push -u origin feature/your-task
```

## Pull request and review

Open a PR into `main`, describe behavior and validation, and request another team member's review. Reviewers check the diff, run the affected user flow, and approve or request changes. Merge after peer approval and successful checks. No self-authored comments count as peer review. Do not force-push shared `main`.

## Conflict resolution

Merge current `main` into the feature branch. If Git reports a conflict, inspect both versions with the other contributor, resolve the marked sections, remove conflict markers, test, then commit the resolution. Use `git merge --abort` to abandon an unresolved merge. Demonstrate practice conflicts on dedicated branches; never create a conflict in production just for evidence.

## Files and privacy

Commit source, configuration and documentation. Never commit real medical records, passwords, session tokens, service-role/API secrets, `node_modules`, generated builds or temporary test artifacts. Do not change `.gitignore` to upload these. UI buttons alone do not establish implemented functionality; document known limitations.

## Ownership and permissions

The repository owner manages collaborators. Invited members must accept their invitation. Use peer review for changes to authentication, data access and AI integrations. GitHub permissions do not grant access to Supabase or its secrets.
