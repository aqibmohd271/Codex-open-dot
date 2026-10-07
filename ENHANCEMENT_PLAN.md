# Codex-open-dot enhancement plan

Requested: 2026-10-04. Implement sequentially; preserve existing data and keep secrets out of Git.

Status legend: [ ] pending; [x] implemented and verified locally. External verification is recorded separately, never implied by a local test.

## Ordered checklist

- [x] 01 Custom API providers — encrypted keys, editable labels/endpoints/deployment names, Chat Completions and Responses adapters, connection test, manual models, capability settings. Verify mocked requests, tool calls, invalid endpoints and secret redaction.
- [x] 02 Recover interrupted work — durable run records and explicit recovery without replaying uncertain side effects. Verify restart and checkpoint behavior.
- [x] 03 Reliable schedules — time zones, missed-run policy and durable dispatch records. Verify restart, skipped/catch-up runs and invalid schedules.
- [x] 04 Task dashboard — durable status, progress, results and recovery controls. Verify all lifecycle states.
- [x] 05 Spending controls — usage accounting, configurable model prices, task/agent budgets and loop limits. Verify limits and unknown prices.
- [x] 06 Safer retries — bounded transient retries and side-effect execution ledger. Verify ambiguous outcomes are not repeated automatically.
- [x] 07 Better action approvals — precise arguments, immutable approved action, expiry and audit. Verify denied/expired/duplicate approval behavior.
- [x] 08 Searchable knowledge library — import documents and folders, scoped search and source citations. Verify extraction, limits and isolation.
- [x] 09 Editable memory — edit/delete and explicit personal/project scope. Verify prompt scope and persistence.
- [x] 10 Automatic model selection — explicit routing rules, cheap/strong choices and budget checks. Verify selection and unavailable providers.
- [x] 11 Custom tool connections — configurable MCP and HTTP tools with encrypted credentials and approval defaults. Verify protocol and failures.
- [x] 12 Reusable workflows — durable ordered steps and review gates. Verify stop/resume and failures.
- [x] 13 Better browser recovery — diagnose navigation/session failures and ask for takeover. Verify blocked pages and recovery.
- [x] 14 Quality checks — attach verification criteria and distinguish verified/unverified completion. Verify failed checks prevent verified success.
- [x] 15 Specialist agents — defined roles, bounded delegation and visible handoffs. Verify loops and concurrency limits.
- [ ] 16 Always-on operation — server runner, persistent data and deployment configuration. Verify local server lifecycle; live hosting needs an actual deployment.
- [x] 17 Remote access — authenticated sessions and authorization on every route/action/stream. Verify unauthenticated access, CSRF and expiration.
- [x] 18 Better voice experience — interruption handling, transcript consistency and handoff. Verify event handling; live audio needs credentials/device.
- [x] 19 Backup and restore — versioned exports, validation and transactional restore; credentials excluded. Verify round trip and malicious input.
- [ ] 20 Polished Mac app — onboarding, diagnostics, notifications and packaging. Verify build and UI; signing/notarization needs signing credentials.
- [x] 21 Shared workspaces — memberships, roles, scoped data and activity history. Verify cross-workspace access denial.

## Release verification

- [x] Type check, lint, meaningful automated tests and production build.
- [x] Inspect UI and relevant end-to-end flows.
- [x] Document required credentials, limitations and operational setup.
- [x] Review Git diff for secrets and unintended data changes.
- [ ] Clarify upstream license before redistribution; no LICENSE file found in downloaded repository.
- [ ] Publish to the user-selected GitHub repository (destination/visibility not yet provided).

## Execution log

- Downloaded upstream source to `~/Downloads/Codex-open-dot`; original source remains separate from Maryams.
- Created this checklist before implementation, then implemented the numbered features sequentially and revisited defects found during verification.
- 29 automated tests pass, including mock-provider task execution, approval replay prevention, missed-run deduplication, MCP discovery/calls, real PDF/DOCX extraction, scoped memory, transactional restore rollback, specialist limits, real verification commands and mocked voice interruption/races.
- Production build and TypeScript pass. ESLint passes with no warnings. Browser tests against the packaged standalone server pass: login, cross-origin denial, custom-provider save/test, chat completion, dashboard, workflows, member creation and viewer denial (including a forged action header).
- Inspected provider and populated task-dashboard screenshots. Screenshots and test-only databases are outside the repository.
- Item 16: persistent server configuration and authenticated standalone runner implemented and locally exercised. Docker is unavailable on this Mac; container build, HTTPS and live server deployment remain unverified.
- Item 20: onboarding, diagnostics and separate Mac package implemented. Signing/notarization and an automatic update feed remain pending; no release destination or Apple signing identity has been supplied.
- Checked items mean the documented local implementation passed its relevant checks. They do not mean every real provider, website, device or deployment has been certified. See `docs/ENHANCEMENTS.md` for practical limits.

- Mac release artifact: `dist/Codex-open-dot-0.2.0-arm64.dmg` (Apple Silicon, ad-hoc signed). Production build, deep/strict code-signature integrity check and DMG checksum verification passed. Apple notarization and an update feed remain pending.
- Packaged server root contains only the expected runtime directories/files; no runtime database or environment file was included. Secret-pattern review found no candidate private keys or live API keys in changed source.

## Custom branding and Mac installation — 2026-10-04

- [x] Renamed the project directory to `~/Downloads/Codex-open-dot` and the application to **Codex-open-dot**.
- [x] Updated the app bundle ID, package metadata, interface branding, sign-in page and integration display names.
- [x] Added README credit for **Mohammad Aqib — Full Stack Developer**.
- [x] Added `LICENSE.md` with MIT terms scoped to original custom contributions and `ATTRIBUTION.md` preserving upstream provenance. Upstream redistribution permissions remain unresolved.
- [x] Preserved Git history and renamed the original repository remote to `upstream`.
- [x] Rebuilt the Apple Silicon app/DMG; 29 automated tests, lint, production build/type checking and app signature verification passed.
- [x] Installed and launched `~/Applications/Codex-open-dot.app`. Visually verified the branded Settings screen.
- [x] Verified the installed app's database, writable storage, Node runtime and loopback server. Data is stored in `~/Library/Application Support/Codex-open-dot/`.
- [ ] Add the user's chosen API provider credentials in Settings and test a real model request. No credentials were bundled or entered during installation.
- [ ] Publish to the user's chosen GitHub repository after upstream licensing is resolved. No upload was performed.
