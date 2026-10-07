# Codex-open-dot

**Customized and maintained by Mohammad Aqib — Full Stack Developer.**

Codex-open-dot is a personal AI agent app for macOS, based on [Open Dot by Composio Community](https://github.com/composio-community/open-dot), with custom model providers, durable tasks, approval controls, knowledge search and workflows. This repository contains Mohammad Aqib's enhanced edition. Original upstream work remains credited to its authors.

## What is included

- Custom Chat Completions and Responses providers: endpoint, API key, display name and real model/deployment IDs; encrypted credential storage and connection diagnostics.
- Durable tasks with explicit recovery, a task dashboard, time-zone-aware schedules and missed-run policies.
- Model usage accounting, configurable budgets and loop limits, conservative retries and approvals bound to exact actions.
- PDF/DOCX/text knowledge imports with source references; editable personal, dot and project memory.
- Model routing, MCP/HTTP tool connections, reusable workflows, browser recovery and command-based quality checks.
- Bounded specialist handoffs, voice interruption/transcripts, backup/restore, authenticated remote mode, roles and activity history.

See [implementation details and limits](docs/ENHANCEMENTS.md) and the [verified task checklist](ENHANCEMENT_PLAN.md). Hosted deployment, live provider/voice validation, notarization and an automatic update feed remain separate setup steps.

## Install on macOS

The local Apple Silicon build is `dist/Codex-open-dot-0.2.0-arm64.dmg`. Open the disk image and copy **Codex-open-dot.app** to your Applications folder. This development build is ad-hoc signed, not Apple-notarized. If macOS asks for confirmation, use its normal Open or Privacy & Security flow; do not disable Gatekeeper.

On Mohammad Aqib's Mac, the app is installed in `~/Applications/Codex-open-dot.app`. Launch it from Finder or Spotlight.

1. Open **Settings → Setup and diagnostics**.
2. Add an API provider. Under **Custom API providers**, enter the provider's base URL, authentication mode, key and exact deployed model ID, then use **Test connection**.
3. Create a dot, choose its model and instructions, and send a first message.
4. Connect optional app integrations and enable only the permissions that dot needs.

No credentials are bundled. API usage is billed by the selected provider. Microsoft-hosted, DeepSeek-hosted and local models require a compatible Chat Completions or Responses endpoint; arbitrary API protocols are not automatically supported.

The desktop app stores data in `~/Library/Application Support/Codex-open-dot/`. Closing the window keeps work running; quitting or sleeping the Mac interrupts local execution. For a continuous server, see [SERVER.md](docs/SERVER.md).

## Develop from source

Requirements: Node.js 24, pnpm 10.33.2 and Google Chrome (or Playwright Chromium for browser tools).

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3100`. Configure credentials in Settings. Development data is stored in `.data/`, which Git ignores. The original `DOTS_*` and `OPEN_DOT_*` environment variable names remain supported for compatibility; see `.env.example`.

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm desktop:build
```

The last command builds the Apple Silicon app and DMG. [MAC.md](docs/MAC.md) explains packaging. The tests use temporary databases and mocked providers; they do not claim to certify every real API or website.

## Prepare your GitHub repository

Use **Codex-open-dot** as the repository name. Keep the upstream Git history and attribution. The local upstream remote points to the original repository; add your own destination as `origin` when ready. Nothing is uploaded automatically.

Commit source, documentation and `pnpm-lock.yaml`. Do not commit `.env.local`, `.data/`, credentials, backups, `node_modules/`, `.desktop/` or `dist/`. Build artifacts can be distributed separately after the applicable licensing and release requirements are resolved.

## Author and attribution

**Mohammad Aqib — Full Stack Developer**

Custom-edition developer and maintainer.

Based on Composio Community's Open Dot. See [ATTRIBUTION.md](ATTRIBUTION.md) for the exact upstream revision and [the original README](docs/UPSTREAM_README.md) for historical context. Its statements describe the upstream app, not necessarily this edition.

This independent project is not an official OpenAI Codex product and is not affiliated with or endorsed by OpenAI or Composio.

## License

[LICENSE.md](LICENSE.md) applies MIT terms only to original contributions by Mohammad Aqib, to the extent he holds the relevant rights. No upstream license file was found in the imported revision or the repository checked on 2026-10-04. Upstream code and third-party dependencies are not relicensed by this file. Customization and renaming do not make the entire upstream codebase exclusively ours; confirm upstream permissions before redistributing the combined project as a separately licensed release.
