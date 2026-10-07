import { NextResponse, type NextRequest } from "next/server";
import { principal, safeOrigin, tokenFromCookie } from "./server/auth";
export function proxy(request: NextRequest) {
  const p = request.nextUrl.pathname;
  if (
    !safeOrigin(
      request.url,
      request.headers.get("origin"),
      request.headers.get("host"),
    )
  )
    return new NextResponse("Origin not allowed", { status: 403 });
  if (p === "/login" || p === "/api/auth/login") return NextResponse.next();
  let user;
  try {
    user = principal(tokenFromCookie(request.headers.get("cookie")));
  } catch {
    return new NextResponse("Authentication is not configured", {
      status: 503,
    });
  }
  if (!user)
    return p.startsWith("/api/") || request.headers.has("next-action")
      ? new NextResponse("Sign in required", { status: 401 })
      : NextResponse.redirect(new URL("/login", request.url));
  if (
    user.role === "viewer" &&
    !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
    p !== "/api/auth/logout" &&
    (p.startsWith("/api/") || !request.headers.has("next-action"))
  )
    return new NextResponse("Read-only member", { status: 403 });
  if (
    user.role !== "owner" &&
    (p === "/settings" || p.startsWith("/api/admin"))
  )
    return new NextResponse("Owner access required", { status: 403 });
  const r = NextResponse.next();
  r.headers.set("X-Content-Type-Options", "nosniff");
  r.headers.set("X-Frame-Options", "DENY");
  r.headers.set("Referrer-Policy", "same-origin");
  return r;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
