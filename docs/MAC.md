# Mac development and packaging

Use Node 24 and pnpm 10.33.2. Run `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm desktop:build`.

The enhanced app has its own bundle ID and product name so it can coexist with the upstream app. Start with Settings → Setup and diagnostics, configure a provider, then create a dot. Custom Chat Completions endpoints use buffered replies; Responses endpoints stream. Local model endpoints can use HTTP only on loopback.

Closing the window keeps the app running. Quitting or sleeping the Mac interrupts local work. Review interrupted tasks in the Task dashboard. Continuous off-device operation needs the server deployment in SERVER.md.

Builds remain ad-hoc signed until a maintainer configures Apple Developer signing and notarization. An automatic update feed has not been enabled because no release repository or signing identity has been chosen. Do not advertise unsigned builds as notarized or silently install updates.

Live model, microphone, browser login and external app tests require your own credentials and permissions. The automated suite uses temporary databases and mock endpoints instead.

The custom app name is **Codex-open-dot**, its bundle identifier is `dev.mohammadaqib.codexopendot`, and its data directory is `~/Library/Application Support/Codex-open-dot/`. Local installation uses `~/Applications/Codex-open-dot.app`.
