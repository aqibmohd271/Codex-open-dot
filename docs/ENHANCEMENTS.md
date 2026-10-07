# Codex-open-dot — usage and verification

Source: `~/Downloads/Codex-open-dot`. This checkout is separate from the Maryams project. Start with `pnpm dev`, open `http://localhost:3100`, and visit Settings → Setup and diagnostics. The local app is restricted to loopback. Use the authenticated server configuration in SERVER.md for remote access.

## Providers and budgets

Settings → Custom API providers accepts a display name, base URL, actual model/deployment names, authentication mode (Bearer, api-key, or none), API format (Chat Completions or Responses), and capability flags. Keys are encrypted using the existing local vault and are never returned to the browser. Changing an endpoint requires reentering its key. Test connection makes a small, potentially billable model request. Model discovery is optional; manually entered IDs work for deployment-specific services.

Microsoft-hosted and DeepSeek-hosted deployments can be connected when their endpoint implements one of these supported formats. A friendly label is arbitrary; the model/deployment ID must be real and available to that key. Legacy Azure endpoints requiring an `api-version` query parameter, arbitrary noncompatible protocols, custom headers beyond the two authentication modes, and cloud identity/OAuth are not implemented. Chat Completions replies are buffered. Hosted OpenAI visual-computer/search tools are not sent to other providers; ordinary function tools remain available when supported. Image/tool capabilities must be confirmed for the actual deployment.

Spending controls use your configured input/output prices in dollars per million tokens. They reserve estimated request costs before sending, retain uncertain charges, record reported token usage, and enforce task/daily-per-dot limits plus step/output limits. Unknown prices block requests when enforcement is enabled. Prices and provider billing must be kept in sync. This is an application guard, not a provider billing guarantee. Connection tests and third-party service fees are outside the ledger. Strict limits reject attachments/opaque history and disable live voice because these costs cannot yet be bounded reliably. Set provider-side limits as well. Automatic selection uses explicit text-length/keyword rules, with manual dot choices taking precedence.

## Tasks, actions and workflows

The task dashboard shows progress, outcomes, errors, parent handoffs and verification evidence. Restarted work is marked interrupted. Resume creates a reviewed continuation that checks earlier outcomes. It does not silently repeat external actions. Stop cancels queued work and expires pending approvals.

Schedules use an explicit time zone. Choose skip or catch-up for missed runs; catch-up coalesces a backlog into one run. Durable dispatch records prevent duplicate claims. Run only one application process per data directory.

Temporary read failures retry with bounded backoff. Side-effect execution records retain completed outputs and block uncertain repeats. This cannot supply exactly-once delivery for every external service; uncertain outcomes require checking the destination. Approvals show exact arguments, expire after 24 hours and are bound to the proposed call. Removing tool access before approval prevents execution.

Workflows save ordered instructions and optional review gates. Runs retain their definition and earlier results. Specialist dots run normal durable tasks with their own tools/approvals: at most two active delegations, five handoffs per parent and no nested specialist delegation. Browser recovery recognizes common login, CAPTCHA and changed-element failures, then asks for help and reinspection. It cannot repair every site automatically.

The verification command tool records command output and exit status. Tasks with recorded failed checks are failed; tasks without checks are labeled unverified. Agents must choose relevant checks. A passing command alone does not certify an entire generated artifact.

## Knowledge, memory and tools

Import PDF, DOCX, supported text/source files, or a folder into a dot's knowledge library. Limits: 10 MB per file, 200 PDF pages, one million extracted characters and 100 files per folder selection. Search is scoped full-text keyword search with source links and locations. Scanned PDFs need OCR elsewhere; this implementation does not generate embeddings or perform OCR.

Memories can be viewed, edited and deleted. Dot-only memories remain local; personal memories are shared across dots in this instance; project memories are visible to dots assigned the same project ID. This is agent context scoping, not user-level secrecy in a shared instance.

Custom tool connections support Streamable HTTP MCP discovery/calls and fixed HTTP JSON POST tools, scoped to a dot, with encrypted Bearer credentials and approval by default. Local stdio MCP, OAuth and API-schema generation are not implemented. Configure trusted endpoints; tool/document content is untrusted input.

## Voice, sharing and backup

Voice supports interruption, transcripts, manual reconnection, stale-call protection and duplicate event/handoff suppression. It still uses OpenAI Realtime. Mocked event tests pass; live microphone, audio quality and provider behavior need a real session.

Server mode supports owners, trusted member/operators and read-only viewers. Owners manage credentials and users. Members can operate agents and may consequently execute approved commands; give this role only to trusted operators. One deployment is one shared workspace. Separate workspaces require separate data volumes, IDs and hostnames. Sessions are workspace-bound, expire after 12 hours and are revoked on member disable. The activity history records authorized action attempts, not a guarantee that each operation succeeded. See SERVER.md for HTTPS deployment.

Backup exports chats, tasks, memories, rules, routines, workflows, knowledge, attachment files, budget settings and routing preferences. It excludes provider/tool credentials, website passwords, login accounts/sessions, browser profiles, runtime computers and their filesystem contents. Restore requires an empty workspace and runs transactionally; restored dots are paused, schedules disabled, action cards expired and routing disabled pending reconnection. Secrets typed into messages/files may still appear in backups, so protect the export. Attachment limit: 100 MB; upload limit: 160 MB.

## Remaining external release work

The automated suite and UI smoke use temporary data and local mock endpoints. Real model/deployment compatibility, live voice, real browser sessions, Docker image build, hosted availability and Apple signing/notarization need their corresponding environment or credentials. No automatic update feed is configured. No upstream LICENSE file was found; confirm redistribution rights before publishing a fork or installer. GitHub destination and visibility are still required for publication.
