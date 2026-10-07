import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
const dir = mkdtempSync(path.join(os.tmpdir(), "dot-auth-"));
process.env.DOTS_DATA_DIR = dir;
process.env.DOTS_SERVER_MODE = "1";
process.env.DOTS_ADMIN_PASSWORD = "a-long-test-password-123";
process.env.DOTS_WORKSPACE_ID = "one";
const a = await import("../src/server/auth.ts");
test("sessions enforce credentials, workspace isolation, roles and logout", () => {
  assert.equal(a.login("admin", "wrong"), null);
  const token = a.login("admin", process.env.DOTS_ADMIN_PASSWORD);
  assert.equal(a.principal(token).role, "owner");
  process.env.DOTS_WORKSPACE_ID = "two";
  assert.equal(a.principal(token), null);
  process.env.DOTS_WORKSPACE_ID = "one";
  a.addMember("viewer", "long-password-for-viewer", "viewer");
  const v = a.login("viewer", "long-password-for-viewer");
  assert.equal(a.permits(a.principal(v).role, "member"), false);
  a.disableMember("viewer", "admin");
  assert.equal(a.principal(v), null);
  a.logout(token);
  assert.equal(a.principal(token), null);
});
test("origin checks block cross-origin and unconfigured remote hosts", () => {
  assert.equal(
    a.safeOrigin(
      "http://localhost:3100",
      "https://evil.test",
      "localhost:3100",
    ),
    false,
  );
  assert.equal(a.safeOrigin("http://evil.test", null, "evil.test"), false);
  assert.equal(
    a.safeOrigin(
      "http://localhost:3100",
      "http://localhost:3100",
      "localhost:3100",
    ),
    true,
  );
});
process.on("exit", () => rmSync(dir, { recursive: true, force: true }));
