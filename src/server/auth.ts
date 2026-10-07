import "server-only";
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { db } from "./db";
export type Role = "owner" | "member" | "viewer";
export type Principal = { username: string; role: Role };
export const authEnabled = () =>
  process.env.DOTS_SERVER_MODE === "1" ||
  Boolean(process.env.DOTS_ADMIN_PASSWORD);
export const workspaceId = () => process.env.DOTS_WORKSPACE_ID || "personal";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
function passwordHash(
  password: string,
  salt = randomBytes(16).toString("hex"),
) {
  return salt + ":" + scryptSync(password, salt, 32).toString("hex");
}
function validPassword(password: string, stored: string) {
  try {
    const [salt, value] = stored.split(":");
    const actual = scryptSync(password, salt, 32),
      expected = Buffer.from(value, "hex");
    return (
      expected.length === actual.length && timingSafeEqual(actual, expected)
    );
  } catch {
    return false;
  }
}
function table() {
  const d = db();
  d.exec(
    "CREATE TABLE IF NOT EXISTS members(username TEXT PRIMARY KEY,password_hash TEXT NOT NULL,role TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1);CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,username TEXT NOT NULL,workspace TEXT NOT NULL,expires_at INTEGER NOT NULL);CREATE TABLE IF NOT EXISTS login_attempts(username TEXT NOT NULL,at INTEGER NOT NULL);",
  );
  if (!d.prepare("SELECT username FROM members LIMIT 1").get()) {
    const p = process.env.DOTS_ADMIN_PASSWORD;
    if (!p || p.length < 16)
      throw new Error("Set a 16+ character initial administrator password");
    d.prepare(
      "INSERT INTO members(username,password_hash,role) VALUES(?,?,?)",
    ).run("admin", passwordHash(p), "owner");
  }
  return d;
}
export function login(username: string, password: string): string | null {
  if (username.length > 100 || password.length > 1024) return null;
  const d = table(),
    now = Date.now();
  d.prepare("DELETE FROM login_attempts WHERE at<?").run(now - 900000);
  if (
    Number(
      d
        .prepare("SELECT COUNT(*) AS n FROM login_attempts WHERE username=?")
        .get(username)?.n,
    ) >= 10
  )
    return null;
  d.prepare("INSERT INTO login_attempts VALUES(?,?)").run(username, now);
  const u = d
    .prepare("SELECT * FROM members WHERE username=? AND enabled=1")
    .get(username);
  if (!u || !validPassword(password, String(u.password_hash))) return null;
  d.prepare("DELETE FROM login_attempts WHERE username=?").run(username);
  const token = randomBytes(32).toString("hex");
  d.prepare("DELETE FROM sessions WHERE expires_at<?").run(now);
  d.prepare("INSERT INTO sessions VALUES(?,?,?,?)").run(
    hash(token),
    username,
    workspaceId(),
    now + 43200000,
  );
  return token;
}
export function principal(token: string | null): Principal | null {
  if (!authEnabled()) return { username: "local", role: "owner" };
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const r = table()
    .prepare(
      "SELECT m.username,m.role FROM sessions s JOIN members m ON m.username=s.username WHERE s.token_hash=? AND s.workspace=? AND s.expires_at>? AND m.enabled=1",
    )
    .get(hash(token), workspaceId(), Date.now());
  return r ? { username: String(r.username), role: r.role as Role } : null;
}
export function logout(token: string | null) {
  if (token)
    table().prepare("DELETE FROM sessions WHERE token_hash=?").run(hash(token));
}
export const permits = (actual: Role, required: Role) =>
  ({ viewer: 0, member: 1, owner: 2 })[actual] >=
  { viewer: 0, member: 1, owner: 2 }[required];
export function safeOrigin(
  url: string,
  origin: string | null,
  host: string | null,
) {
  try {
    const p = process.env.DOTS_PUBLIC_URL,
      t = new URL(p || url);
    if (!p && !["localhost", "127.0.0.1", "[::1]"].includes(t.hostname))
      return false;
    return host === t.host && (!origin || new URL(origin).origin === t.origin);
  } catch {
    return false;
  }
}
export const tokenFromCookie = (cookie: string | null) =>
  cookie
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("dot_session="))
    ?.slice(12) ?? null;
export function addMember(username: string, password: string, role: Role) {
  if (
    !/^[a-zA-Z0-9._-]{1,60}$/.test(username) ||
    password.length < 16 ||
    password.length > 1024 ||
    !["owner", "member", "viewer"].includes(role)
  )
    throw new Error("Use a valid username, 16+ character password and role");
  table()
    .prepare("INSERT INTO members(username,password_hash,role) VALUES(?,?,?)")
    .run(username, passwordHash(password), role);
}
export function members() {
  return table()
    .prepare("SELECT username,role,enabled FROM members ORDER BY username")
    .all()
    .map((r) => ({ ...r }));
}
export function disableMember(username: string, actor: string) {
  if (username === actor) throw new Error("You cannot disable yourself");
  const d = table();
  const user = d
    .prepare("SELECT role FROM members WHERE username=?")
    .get(username);
  if (
    user?.role === "owner" &&
    Number(
      d
        .prepare(
          "SELECT COUNT(*) AS n FROM members WHERE role='owner' AND enabled=1",
        )
        .get()?.n,
    ) <= 1
  )
    throw new Error("Keep at least one owner");
  d.prepare("UPDATE members SET enabled=0 WHERE username=?").run(username);
  d.prepare("DELETE FROM sessions WHERE username=?").run(username);
}
