import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { config, proxy } from "./proxy.js";

function loginRequest(path = "/login", cookie?: string): NextRequest {
  return new NextRequest(
    `https://authometry.example${path}`,
    cookie ? { headers: { cookie } } : {},
  );
}

void test("authenticated dashboard users leave the login page for their return destination", () => {
  const response = proxy(
    loginRequest(
      "/login?returnTo=%2Fapplications%3Fview%3Dactive",
      "authometry_admin_access=access-token",
    ),
  );

  assert.equal(response.status, 307);
  assert.equal(
    response.headers.get("location"),
    "https://authometry.example/applications?view=active",
  );
});

void test("stable dashboard sessions leave the login page for the overview by default", () => {
  const response = proxy(loginRequest("/login", "authometry_admin_refresh=refresh-token"));

  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "https://authometry.example/overview");
});

void test("unauthenticated users can remain on the login page", () => {
  const response = proxy(loginRequest());

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-middleware-next"), "1");
});

void test("login redirects reject external return destinations", () => {
  const response = proxy(
    loginRequest(
      "/login?returnTo=https%3A%2F%2Fevil.example%2Faccount",
      "authometry_admin_refresh=refresh-token",
    ),
  );

  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "https://authometry.example/overview");
});

void test("the login route is included in the session proxy matcher", () => {
  assert.ok(config.matcher.includes("/login"));
});
