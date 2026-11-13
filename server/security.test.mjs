import test from "node:test";
import assert from "node:assert/strict";
import {
  hashToken,
  originAllowed,
  passwordHash,
  passwordMatches,
} from "./security.mjs";

test("password hashes are salted and verify only the original password", async () => {
  const first = await passwordHash("correct horse battery staple");
  const second = await passwordHash("correct horse battery staple");
  assert.notEqual(first, second);
  assert.equal(
    await passwordMatches("correct horse battery staple", first),
    true,
  );
  assert.equal(await passwordMatches("wrong password", first), false);
  assert.equal(
    await passwordMatches("correct horse battery staple", "invalid"),
    false,
  );
});

test("session tokens are stored as deterministic SHA-256 hashes", () => {
  assert.equal(hashToken("secret").length, 64);
  assert.equal(hashToken("secret"), hashToken("secret"));
  assert.notEqual(hashToken("secret"), hashToken("other"));
});

test("only the public origin is accepted in production", () => {
  const allowed = new Set(["https://labels.example.nl"]);
  assert.equal(
    originAllowed("https://labels.example.nl", { allowed, dev: false }),
    true,
  );
  assert.equal(
    originAllowed("http://127.0.0.1:5173", { allowed, dev: false }),
    false,
  );
  assert.equal(originAllowed("not a url", { allowed, dev: false }), false);
});

test("development accepts loopback dev servers but not other hosts", () => {
  const allowed = new Set(["http://127.0.0.1:3022"]);
  assert.equal(
    originAllowed("http://127.0.0.1:5173", { allowed, dev: true }),
    true,
  );
  assert.equal(
    originAllowed("http://localhost:5174", { allowed, dev: true }),
    true,
  );
  assert.equal(
    originAllowed("http://evil.example:5173", { allowed, dev: true }),
    false,
  );
});
