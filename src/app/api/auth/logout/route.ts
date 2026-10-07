import { logout, tokenFromCookie } from "@/server/auth";
export async function POST(req: Request) {
  logout(tokenFromCookie(req.headers.get("cookie")));
  return new Response(null, {
    status: 303,
    headers: {
      Location: "/login",
      "Set-Cookie":
        "dot_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0",
    },
  });
}
