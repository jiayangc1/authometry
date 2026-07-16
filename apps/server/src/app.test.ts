import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./index.js";

describe("Express security and protocol boundaries", () => {
  const app = createApp();

  it("serves liveness with security and request identifiers", async () => {
    const response = await request(app).get("/health/live").expect(200);
    expect(response.body).toEqual({ status: "ok", service: "authometry-api" });
    expect(response.headers["x-request-id"]).toMatch(/^req_/);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("rejects the implicit flow before performing client lookup", async () => {
    const response = await request(app)
      .get("/oauth/authorize")
      .query({
        client_id: "client",
        redirect_uri: "https://client.example/callback",
        response_type: "token",
        scope: "openid",
      })
      .expect(400);
    expect(response.body.error.code).toBe("invalid_request");
  });

  it("returns structured versioned API errors", async () => {
    const response = await request(app).get("/api/v1/not-a-route").expect(401);
    expect(response.body.error.code).toBe("authentication_required");
    expect(response.body.error.requestId).toMatch(/^req_/);
  });

  it("only applies the authentication limiter to sensitive attempts", async () => {
    const routineResponse = await request(app).get("/api/v1/auth/me").expect(401);
    expect(routineResponse.headers["ratelimit-policy"]).toBeUndefined();

    const loginResponse = await request(app).post("/api/v1/auth/login").send({}).expect(422);
    expect(loginResponse.headers["ratelimit-policy"]).toBeDefined();
  });
});
