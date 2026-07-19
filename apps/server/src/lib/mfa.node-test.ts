import assert from "node:assert/strict";
import test from "node:test";
import { generateRecoveryCodes, totpCode, totpSetupUri, verifyTotp } from "./mfa.js";

await test("TOTP generation follows the RFC 6238 SHA-1 test vector", () => {
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  assert.equal(totpCode(secret, 59_000), "287082");
  assert.equal(verifyTotp(secret, "287 082", 59_000), true);
  assert.equal(verifyTotp(secret, "000000", 59_000), false);
});

await test("TOTP setup URIs identify the workspace and account", () => {
  const uri = new URL(totpSetupUri("ABC234", "person@example.com", "Acme Workspace"));
  assert.equal(uri.protocol, "otpauth:");
  assert.equal(uri.searchParams.get("secret"), "ABC234");
  assert.equal(uri.searchParams.get("issuer"), "Acme Workspace");
});

await test("recovery codes are unique and human-readable", () => {
  const codes = generateRecoveryCodes();
  assert.equal(codes.length, 8);
  assert.equal(new Set(codes).size, 8);
  assert.equal(
    codes.every((code) => /^[a-f0-9]{5}-[a-f0-9]{5}$/.test(code)),
    true,
  );
});
