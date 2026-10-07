import { login } from "@/server/auth";
export async function POST(req: Request) {
  if (Number(req.headers.get("content-length") ?? 0) > 4096)
    return new Response("Request too large", { status: 413 });
  try {
    const body = await req.text();
    if (body.length > 4096)
      return new Response("Request too large", { status: 413 });
    const f = new URLSearchParams(body),
      token = login(f.get("username") ?? "", f.get("password") ?? "");
    if (!token)
      return new Response(
        "Sign-in failed or too many attempts. Return to /login and try later.",
        { status: 401 },
      );
    return new Response(null, {
      status: 303,
      headers: {
        Location: "/",
        "Set-Cookie": `dot_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${(process.env.DOTS_PUBLIC_URL ?? req.url).startsWith("https:") ? "; Secure" : ""}`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Sign-in unavailable. Check server configuration.", {
      status: 503,
    });
  }
}
