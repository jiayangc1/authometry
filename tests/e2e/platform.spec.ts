import { createHash } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const owner = {
  email: "owner@authometry.test",
  password: "correct-horse-battery-staple",
  name: "Release Owner",
};

async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(owner.email);
  await page.getByLabel("Password").fill(owner.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/overview$/);
}

async function csrf(page: Page): Promise<string> {
  return (
    (await page.context().cookies()).find(({ name }) => name === "authometry_csrf")?.value ?? ""
  );
}

test.beforeAll(async ({ request }) => {
  const status = await request.get("/api/v1/auth/bootstrap/status");
  if (((await status.json()) as { bootstrapRequired: boolean }).bootstrapRequired) {
    const response = await request.post("/api/v1/auth/bootstrap", {
      headers: {
        "x-bootstrap-token": process.env.BOOTSTRAP_TOKEN ?? "authometry-development-bootstrap",
      },
      data: { ...owner, workspaceName: "Authometry Test" },
    });
    expect(response.ok()).toBe(true);
  }
});

test("landing and login surfaces are accessible", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "OAuth you can see." })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in to Authometry" })).toBeVisible();
});

test("owner can sign in and switch environments", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await page.getByLabel("Environment").click();
  await page.getByRole("menuitem", { name: /Development/ }).click();
  await expect(page.getByLabel("Environment")).toContainText("Development");
  await page.reload();
  await expect(page.getByLabel("Environment")).toContainText("Development");
});

test("application creation reveals a client secret once", async ({ page }) => {
  await login(page);
  await page.goto("/applications/new");
  await page.getByLabel("Application name").fill("Release Portal");
  await page.getByLabel("Redirect URI").fill("http://127.0.0.1:3000/callback");
  await page.getByRole("button", { name: "Create application" }).click();
  await expect(page.getByRole("heading", { name: "Client secret created" })).toBeVisible();
  await expect(page.getByText("This secret will only be displayed once.")).toBeVisible();
});

test("authorization code with S256 PKCE issues and rotates tokens", async ({ page }) => {
  await login(page);
  const headers = { "x-authometry-csrf": await csrf(page) };
  const suffix = Date.now().toString(36);
  const created = await page.request.post("/api/v1/applications", {
    headers,
    data: {
      name: "PKCE Client",
      slug: `pkce-${suffix}`,
      type: "web",
      redirectUris: ["http://127.0.0.1:3000/callback"],
      postLogoutRedirectUris: [],
    },
  });
  expect(created.ok()).toBe(true);
  const application = (await created.json()) as {
    id: string;
    clientId: string;
    clientSecret: string;
  };
  const detail = await page.request.get(`/api/v1/applications/${application.id}`);
  const version = ((await detail.json()) as { version: number }).version;
  const assigned = await page.request.patch(`/api/v1/applications/${application.id}`, {
    headers,
    data: { allowedScopes: ["openid", "profile", "email", "offline_access"], version },
  });
  expect(assigned.ok()).toBe(true);
  const user = await page.request.post("/api/v1/users", {
    headers,
    data: {
      name: "Protocol User",
      email: `user-${suffix}@authometry.test`,
      password: "protocol-user-password",
      groups: ["engineering"],
    },
  });
  expect(user.ok()).toBe(true);

  const verifier = "7bczwqj36kPx2UuAqR5UR5JlyoQHsp6qC8F7veXrQvQ";
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const authorize = new URL("/oauth/authorize", "http://127.0.0.1:3000");
  authorize.search = new URLSearchParams({
    client_id: application.clientId,
    redirect_uri: "http://127.0.0.1:3000/callback",
    response_type: "code",
    scope: "openid profile email offline_access",
    state: "state-release",
    nonce: "nonce-release",
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  await page.goto(authorize.toString());
  await page.getByLabel("Email address").fill(`user-${suffix}@authometry.test`);
  await page.getByLabel("Password").fill("protocol-user-password");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /Allow/ }).click();
  await expect(page).toHaveURL(/\/callback\?/);
  const code = new URL(page.url()).searchParams.get("code");
  expect(code).toBeTruthy();
  const authorization = Buffer.from(`${application.clientId}:${application.clientSecret}`).toString(
    "base64",
  );
  const tokens = await page.request.post("/oauth/token", {
    headers: {
      authorization: `Basic ${authorization}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    form: {
      grant_type: "authorization_code",
      code: code!,
      redirect_uri: "http://127.0.0.1:3000/callback",
      code_verifier: verifier,
    },
  });
  expect(tokens.ok()).toBe(true);
  const first = (await tokens.json()) as {
    access_token: string;
    id_token: string;
    refresh_token: string;
  };
  expect(first.access_token).toBeTruthy();
  expect(first.id_token).toBeTruthy();
  const rotated = await page.request.post("/oauth/token", {
    headers: {
      authorization: `Basic ${authorization}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    form: { grant_type: "refresh_token", refresh_token: first.refresh_token },
  });
  expect(rotated.ok()).toBe(true);
  const reuse = await page.request.post("/oauth/token", {
    headers: {
      authorization: `Basic ${authorization}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    form: { grant_type: "refresh_token", refresh_token: first.refresh_token },
  });
  expect(reuse.status()).toBe(400);
  expect(((await reuse.json()) as { error: string }).error).toBe("invalid_grant");
});

test("mobile navigation and theme survive a reload", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobile project only");
  await login(page);
  await page.getByLabel("Open navigation").click();
  await expect(page.getByRole("navigation", { name: "Dashboard navigation" })).toBeVisible();
  await page.getByLabel("Toggle theme").click();
  const theme = await page.locator("html").getAttribute("class");
  await page.reload();
  expect(await page.locator("html").getAttribute("class")).toBe(theme);
});
