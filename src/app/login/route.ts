export async function GET() {
  return new Response(
    `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in · Codex-open-dot</title></head><body style="font:16px system-ui;max-width:420px;margin:12vh auto;padding:24px"><h1>Codex-open-dot</h1><p>Sign in to your workspace.</p><form action="/api/auth/login" method="post"><label>Username<input name="username" autocomplete="username" required style="display:block;padding:12px;margin:8px 0"></label><label>Password<input name="password" type="password" autocomplete="current-password" required style="display:block;padding:12px;margin:8px 0"></label><button>Sign in</button></form></body></html>`,
    {
      headers: {
        "Content-Type": "text/html",
        "Cache-Control": "no-store",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
      },
    },
  );
}
