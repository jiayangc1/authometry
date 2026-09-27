import assert from "node:assert/strict";
import test from "node:test";
import {
  parsePlaygroundFlow,
  playgroundConfiguration,
  validatePlaygroundCallback,
  validatePlaygroundRequest,
  type PlaygroundApplication,
  type PlaygroundFlow,
} from "./playground.js";

const issuer = "https://authometry.example";
const playgroundUri = `${issuer}/developer/playground`;
const application: PlaygroundApplication = {
  id: "app_registered",
  name: "Registered SPA",
  client_id: "amt_registered_spa",
  status: "active",
  redirect_uris: ["https://client.example/callback", playgroundUri],
  grant_types: ["authorization_code", "refresh_token"],
  allowed_scopes: ["openid", "email", "offline_access"],
  token_endpoint_auth_method: "none",
};
const flow: PlaygroundFlow = {
  ...playgroundConfiguration(application, playgroundUri),
  issuer,
  verifier: "saved-verifier",
  challenge: "saved-challenge",
  state: "saved-state",
  nonce: "saved-nonce",
};

void test("a fresh or reset playground has no fabricated client and cannot authorize", () => {
  const configuration = playgroundConfiguration(undefined, playgroundUri);
  assert.equal(configuration.clientId, "");
  assert.match(validatePlaygroundRequest(configuration, undefined), /Select an application/);
});

void test("application selection and reset use a registered callback and permitted scopes", () => {
  const configuration = playgroundConfiguration(application, playgroundUri);
  assert.deepEqual(configuration, {
    clientId: application.client_id,
    redirectUri: playgroundUri,
    scopes: ["openid", "email"],
  });
  assert.equal(validatePlaygroundRequest(configuration, application), "");
});

void test("applications without the playground callback use their real callback or stay invalid", () => {
  const external = { ...application, redirect_uris: ["https://client.example/callback"] };
  assert.equal(
    playgroundConfiguration(external, playgroundUri).redirectUri,
    external.redirect_uris[0],
  );
  const noCallback = { ...application, redirect_uris: [] };
  const configuration = playgroundConfiguration(noCallback, playgroundUri);
  assert.equal(configuration.redirectUri, "");
  assert.match(
    validatePlaygroundRequest(configuration, noCallback),
    /Register this exact redirect URI/,
  );
});

void test("stale placeholder URLs and clients from other environments are blocked", () => {
  for (const clientId of ["amt_client_dashboard", "client_from_another_environment"]) {
    assert.match(validatePlaygroundRequest({ ...flow, clientId }, undefined), /not registered/);
  }
});

void test("disabled and non-interactive applications cannot start authorization", () => {
  assert.match(validatePlaygroundRequest(flow, { ...application, status: "disabled" }), /disabled/);
  assert.match(
    validatePlaygroundRequest(flow, { ...application, grant_types: ["client_credentials"] }),
    /does not support Authorization Code/,
  );
});

void test("unregistered callbacks and unassigned scopes are rejected before navigation", () => {
  assert.match(
    validatePlaygroundRequest({ ...flow, redirectUri: `${playgroundUri}/` }, application),
    /exact redirect URI/,
  );
  assert.match(
    validatePlaygroundRequest({ ...flow, scopes: ["openid", "profile"] }, application),
    /not allowed/,
  );
  assert.match(
    validatePlaygroundRequest({ ...flow, scopes: [] }, application),
    /at least one scope/,
  );
});

void test("a same-tab OAuth round trip restores the original client, callback, scopes, and verifier", () => {
  const restored = parsePlaygroundFlow(JSON.stringify(flow));
  const callback = new URL(playgroundUri);
  callback.search = new URLSearchParams({
    code: "returned-code",
    state: flow.state,
    iss: issuer,
  }).toString();
  assert.equal(callback.searchParams.has("client_id"), false);
  assert.deepEqual(restored, flow);
  assert.equal(validatePlaygroundCallback(restored, callback.searchParams, issuer), "");
});

void test("legacy, malformed, and missing saved requests cannot enable an exchange", () => {
  for (const saved of [
    null,
    "{",
    "null",
    "[]",
    JSON.stringify({ verifier: "old-verifier", state: flow.state }),
    JSON.stringify({ ...flow, scopes: [null] }),
  ]) {
    const restored = parsePlaygroundFlow(saved);
    assert.equal(restored, undefined);
    assert.match(
      validatePlaygroundCallback(restored, new URLSearchParams({ state: flow.state }), issuer),
      /saved request is missing/,
    );
  }
});

void test("missing or mismatched callback state blocks an exchange", () => {
  for (const state of ["", "different-state"]) {
    assert.match(
      validatePlaygroundCallback(flow, new URLSearchParams({ state }), issuer),
      /state does not match/,
    );
  }
});

void test("callback and active environment issuers must match the original request", () => {
  assert.match(
    validatePlaygroundCallback(
      flow,
      new URLSearchParams({ state: flow.state, iss: "https://other.example" }),
      issuer,
    ),
    /different issuer/,
  );
  assert.match(
    validatePlaygroundCallback(
      flow,
      new URLSearchParams({ state: flow.state, iss: issuer }),
      `${issuer}/staging`,
    ),
    /different issuer/,
  );
  assert.match(
    validatePlaygroundCallback(flow, new URLSearchParams({ state: flow.state }), ""),
    /Loading/,
  );
});
