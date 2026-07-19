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
  scopes: ["mcp:read", "mcp:write"],
};

await test("MCP challenges unauthenticated clients with OAuth resource metadata", async () => {
  const response = await request(createApp()).post("/mcp").send({}).expect(401);

  assert.match(
    response.headers["www-authenticate"] as string,
    /^Bearer realm="authometry-mcp", resource_metadata="http:\/\/localhost:3000\/\.well-known\/oauth-protected-resource\/mcp", scope="mcp:read mcp:write"$/,
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

await test("MCP exposes workspace and management tools and keeps queries tenant scoped", async () => {
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
        "list_management_operations",
        "management_api_read",
        "management_api_write",
      ],
    );
    assert.ok(
      tools.tools
        .filter(({ name }) => name !== "management_api_write")
        .every((tool) => tool.annotations?.readOnlyHint === true),
    );
    assert.equal(
      tools.tools.find(({ name }) => name === "management_api_write")?.annotations?.destructiveHint,
      true,
    );
    const operations = await client.callTool({
      name: "list_management_operations",
      arguments: {},
    });
    assert.match(JSON.stringify(operations), /Create an OAuth application or machine service/);
    assert.match(JSON.stringify(operations), /DELETE/);
    assert.match(JSON.stringify(operations), /\/settings\/danger\/workspace/);
    assert.match(JSON.stringify(operations), /\/settings\/provisioning/);
    assert.match(JSON.stringify(operations), /Permanently delete an identity user/);
    assert.match(JSON.stringify(operations), /exact workspace name/);

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
    assert.match(calls[1]?.text ?? "", /client_id_source <> 'dynamic'/);
  } finally {
    await client.close();
    await server.close();
  }
});

await test("MCP management tools dispatch supported reads and writes with the approving principal", async () => {
  const dispatched: Array<{
    principal: McpPrincipal;
    request: {
      method: string;
      path: string;
      environment?: string;
      query?: Record<string, unknown>;
      body?: Record<string, unknown>;
    };
  }> = [];
  const server = createAuthometryMcpServer(
    principal,
    async <T extends QueryResultRow>() => [] as T[],
    async (approvedPrincipal, managementRequest) => {
      dispatched.push({ principal: approvedPrincipal as McpPrincipal, request: managementRequest });
      return { status: managementRequest.method === "GET" ? 200 : 201, data: { id: "created-1" } };
    },
  );
  const client = new Client({ name: "authometry-management-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const read = await client.callTool({
      name: "management_api_read",
      arguments: {
        path: "/users",
        environment: "staging",
        query: { q: "alex" },
      },
    });
    assert.equal(read.isError, undefined);
    const write = await client.callTool({
      name: "management_api_write",
      arguments: {
        method: "POST",
        path: "/applications",
        environment: "production",
        body: {
          name: "Worker service",
          slug: "worker-service",
          type: "machine",
          redirectUris: [],
        },
      },
    });
    assert.equal(write.isError, undefined);
    const remove = await client.callTool({
      name: "management_api_write",
      arguments: {
        method: "DELETE",
        path: "/applications/11111111-1111-4111-8111-111111111111",
        environment: "production",
      },
    });
    assert.equal(remove.isError, undefined);
    assert.deepEqual(dispatched, [
      {
        principal,
        request: {
          method: "GET",
          path: "/users",
          environment: "staging",
          query: { q: "alex" },
        },
      },
      {
        principal,
        request: {
          method: "POST",
          path: "/applications",
          environment: "production",
          body: {
            name: "Worker service",
            slug: "worker-service",
            type: "machine",
            redirectUris: [],
          },
        },
      },
      {
        principal,
        request: {
          method: "DELETE",
          path: "/applications/11111111-1111-4111-8111-111111111111",
          environment: "production",
        },
      },
    ]);
  } finally {
    await client.close();
    await server.close();
  }
});

await test("MCP management writes require mcp:write and reject routes outside the dashboard API", async () => {
  let dispatchCount = 0;
  const server = createAuthometryMcpServer(
    { ...principal, scopes: ["mcp:read"] },
    async <T extends QueryResultRow>() => [] as T[],
    async () => {
      dispatchCount += 1;
      return {};
    },
  );
  const client = new Client({ name: "authometry-read-only-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const write = await client.callTool({
      name: "management_api_write",
      arguments: { method: "POST", path: "/applications", body: {} },
    });
    assert.equal(write.isError, true);
    assert.match(JSON.stringify(write), /mcp:write/);

    const unsupported = await client.callTool({
      name: "management_api_read",
      arguments: { path: "/auth/bootstrap/status" },
    });
    assert.equal(unsupported.isError, true);
    const traversal = await client.callTool({
      name: "management_api_read",
      arguments: { path: "/applications/%2e%2e" },
    });
    assert.equal(traversal.isError, true);
    assert.equal(dispatchCount, 0);
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
  assert.equal(listed.body.result.tools.length, 8);

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
