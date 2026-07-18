import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import express from "express";
import type { QueryResultRow } from "pg";
import request from "supertest";
import { createApp } from "./index.js";
import { createAuthometryMcpServer, handleMcpRequest, type McpPrincipal } from "./mcp.js";
import {
  mcpResourceForIssuer,
  mcpResourceMetadataUrl,
  resourceIndicatorsMatch,
} from "./oauth/resources.js";
import { dynamicRegistrationSchema } from "./oauth/tokens.js";

const environment = {
  id: "environment-1",
  slug: "production",
  name: "Production",
  kind: "production",
  issuer: "https://auth.example.com",
  is_default: true,
  status: "active",
};

const principal: McpPrincipal = {
  userId: "admin-1",
  email: "owner@example.com",
  workspaceId: "workspace-1",
  role: "owner",
};

await test("MCP challenges unauthenticated clients with OAuth resource metadata", async () => {
  const response = await request(createApp()).post("/mcp").send({}).expect(401);

  assert.match(
    response.headers["www-authenticate"] as string,
    /^Bearer realm="authometry-mcp", resource_metadata="http:\/\/localhost:3000\/\.well-known\/oauth-protected-resource\/mcp", scope="mcp:read"$/,
  );
  assert.equal(response.body.error.code, "authentication_required");
});

await test("MCP resource identifiers retain issuer paths and produce RFC 9728 metadata URLs", () => {
  const resource = mcpResourceForIssuer("https://auth.example.com/w/acme");
  assert.equal(resource, "https://auth.example.com/w/acme/mcp");
  assert.equal(
    mcpResourceMetadataUrl(resource),
    "https://auth.example.com/.well-known/oauth-protected-resource/w/acme/mcp",
  );
  assert.equal(resourceIndicatorsMatch("https://AUTH.example.com:443/w/acme/mcp", resource), true);
  assert.equal(resourceIndicatorsMatch("https://auth.example.com/w/other/mcp", resource), false);
});

await test("MCP dynamic registration accepts public PKCE clients and rejects unsafe callbacks", () => {
  const registered = dynamicRegistrationSchema.parse({
    redirect_uris: ["http://127.0.0.1:43210/callback"],
  });
  assert.equal(registered.client_name, "MCP client");
  assert.deepEqual(registered.grant_types, ["authorization_code", "refresh_token"]);
  assert.equal(registered.token_endpoint_auth_method, "none");

  assert.equal(
    dynamicRegistrationSchema.safeParse({
      redirect_uris: ["https://user:password@client.example/callback"],
    }).success,
    false,
  );
  assert.equal(
    dynamicRegistrationSchema.safeParse({
      redirect_uris: ["http://client.example/callback"],
    }).success,
    false,
  );
});

await test("MCP exposes read-only workspace tools and keeps queries tenant scoped", async () => {
  const calls: { text: string; values: unknown[] }[] = [];
  const execute = async <T extends QueryResultRow>(text: string, values: unknown[] = []) => {
    calls.push({ text, values });
    if (text.includes("FROM environments") && text.includes("LIMIT 1"))
      return [environment] as unknown as T[];
    if (text.includes("FROM environments")) return [environment] as unknown as T[];
    if (text.includes("FROM oauth_applications")) {
      return [
        {
          id: "application-1",
          name: "Example",
          slug: "example",
          client_id: "amt_client_example",
          type: "web",
          status: "active",
        },
      ] as unknown as T[];
    }
    return [] as T[];
  };
  const server = createAuthometryMcpServer(principal, execute);
  const client = new Client({ name: "authometry-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const tools = await client.listTools();
    assert.deepEqual(
      tools.tools.map(({ name }) => name),
      [
        "list_environments",
        "list_applications",
        "list_scopes",
        "list_authorization_traces",
        "get_authorization_trace",
      ],
    );
    assert.ok(tools.tools.every((tool) => tool.annotations?.readOnlyHint === true));

    const result = await client.callTool({
      name: "list_applications",
      arguments: { environment: "production", search: "Example", limit: 10 },
    });
    assert.equal(result.isError, undefined);
    assert.deepEqual(result.structuredContent, {
      environment,
      data: [
        {
          id: "application-1",
          name: "Example",
          slug: "example",
          client_id: "amt_client_example",
          type: "web",
          status: "active",
        },
      ],
      total: 1,
    });
    assert.deepEqual(calls[0]?.values, ["workspace-1", "production"]);
    assert.deepEqual(calls[1]?.values, ["environment-1", "Example", "", "", 10]);
  } finally {
    await client.close();
    await server.close();
  }
});

await test("MCP serves stateless Streamable HTTP JSON responses", async () => {
  const execute = async <T extends QueryResultRow>(text: string) => {
    if (text.includes("FROM environments")) return [environment] as unknown as T[];
    return [] as T[];
  };
  const app = express();
  app.use(express.json());
  app.post("/mcp", async (request, response) => {
    await handleMcpRequest(principal, request, response, execute);
  });
  const headers = {
    Accept: "application/json, text/event-stream",
    "MCP-Protocol-Version": "2025-06-18",
  };

  const initialized = await request(app)
    .post("/mcp")
    .set(headers)
    .send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "http-test", version: "1.0.0" },
      },
    })
    .expect(200)
    .expect("content-type", /application\/json/);
  assert.equal(initialized.body.result.serverInfo.name, "authometry");
  assert.equal(initialized.headers["mcp-session-id"], undefined);

  const listed = await request(app)
    .post("/mcp")
    .set(headers)
    .send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })
    .expect(200);
  assert.equal(listed.body.result.tools.length, 5);

  const called = await request(app)
    .post("/mcp")
    .set(headers)
    .send({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "list_environments", arguments: {} },
    })
    .expect(200);
  assert.equal(called.body.result.structuredContent.total, 1);
});
