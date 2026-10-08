import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { homedir, hostname } from "node:os";
import { dirname, join } from "node:path";

export interface StoredCredential {
  token: string;
  email: string;
  workspace: { name: string; slug: string };
  expiresAt?: string;
}

type CredentialFile = Record<string, StoredCredential>;

const loginTimeoutMs = 5 * 60 * 1000;

export function normalizeServer(server: string): string {
  return server.replace(/\/+$/, "");
}

export function credentialsPath(): string {
  const root = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(root, "authometry", "credentials.json");
}

async function readCredentials(): Promise<CredentialFile> {
  try {
    const parsed: unknown = JSON.parse(await readFile(credentialsPath(), "utf8"));
    return parsed && typeof parsed === "object" ? (parsed as CredentialFile) : {};
  } catch {
    return {};
  }
}

async function writeCredentials(credentials: CredentialFile): Promise<void> {
  const path = credentialsPath();
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, `${JSON.stringify(credentials, null, 2)}\n`, { mode: 0o600 });
  await chmod(path, 0o600);
}

export async function storedCredential(server: string): Promise<StoredCredential | undefined> {
  return (await readCredentials())[normalizeServer(server)];
}

export async function saveCredential(server: string, credential: StoredCredential): Promise<void> {
  await writeCredentials({ ...(await readCredentials()), [normalizeServer(server)]: credential });
}

export async function removeCredential(server: string): Promise<void> {
  const credentials = await readCredentials();
  delete credentials[normalizeServer(server)];
  await writeCredentials(credentials);
}

function openBrowser(url: string): void {
  const [command, args] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["rundll32", ["url.dll,FileProtocolHandler", url]]
        : ["xdg-open", [url]];
  try {
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.on("error", () => undefined);
    child.unref();
  } catch {
    // The URL is always printed, so a missing opener is not fatal.
  }
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );
}

function resultPage(title: string, detail: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)} · Authometry CLI</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:15px/1.6 system-ui,sans-serif;background:#fafafa;color:#171717}main{max-width:360px;padding:24px;text-align:center}h1{font-size:20px;margin:0 0 6px}p{margin:0;color:#666}@media(prefers-color-scheme:dark){body{background:#0a0a0a;color:#ededed}p{color:#a1a1a1}}</style></head><body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(detail)}</p></main></body></html>`;
}

/**
 * Runs the browser login: opens the dashboard approval page, waits for it to redirect back to a
 * loopback listener with a one-time code, and exchanges that code for a personal access token.
 */
export async function browserLogin(
  server: string,
  options: { open: boolean; onUrl: (url: string) => void },
): Promise<StoredCredential> {
  const origin = normalizeServer(server);
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  async function exchange(code: string): Promise<StoredCredential> {
    const response = await fetch(`${origin}/api/v1/auth/cli/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, codeVerifier: verifier }),
    });
    const result = (await response.json().catch(() => undefined)) as
      (StoredCredential & { error?: { message?: string } }) | undefined;
    if (!response.ok || !result?.token) {
      throw new Error(result?.error?.message ?? `Authometry returned HTTP ${response.status}.`);
    }
    return {
      token: result.token,
      email: result.email,
      workspace: result.workspace,
      ...(result.expiresAt ? { expiresAt: result.expiresAt } : {}),
    };
  }

  return new Promise<StoredCredential>((resolve, reject) => {
    const listener = createServer((request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (request.method !== "GET" || url.pathname !== "/callback") {
        response.writeHead(404).end();
        return;
      }
      const finish = (status: number, title: string, detail: string, outcome: () => void) => {
        response.writeHead(status, {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          connection: "close",
        });
        response.end(resultPage(title, detail), () => {
          clearTimeout(timeout);
          listener.close();
          listener.closeAllConnections();
          outcome();
        });
      };
      if (url.searchParams.get("state") !== state) {
        response.writeHead(400, { "content-type": "text/plain" }).end("Invalid state.");
        return;
      }
      const code = url.searchParams.get("code");
      if (!code) {
        const denied = new Error("The login request was cancelled in the browser.");
        finish(200, "Login cancelled", "You can close this tab.", () => reject(denied));
        return;
      }
      exchange(code).then(
        (credential) =>
          finish(
            200,
            "Authometry CLI is signed in",
            "Return to your terminal. You can close this tab.",
            () => resolve(credential),
          ),
        (error: unknown) => {
          const failure = error instanceof Error ? error : new Error(String(error));
          finish(500, "Login failed", failure.message, () => reject(failure));
        },
      );
    });
    const timeout = setTimeout(() => {
      listener.close();
      listener.closeAllConnections();
      reject(new Error("Timed out waiting for the browser. Run authometry login again."));
    }, loginTimeoutMs);
    listener.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    listener.listen(0, "127.0.0.1", () => {
      const address = listener.address();
      if (!address || typeof address === "string") {
        clearTimeout(timeout);
        listener.close();
        reject(new Error("The local login listener could not start."));
        return;
      }
      const url = new URL(`${origin}/cli/authorize`);
      url.searchParams.set("port", String(address.port));
      url.searchParams.set("state", state);
      url.searchParams.set("code_challenge", challenge);
      url.searchParams.set(
        "device",
        hostname()
          .replace(/\.local$/, "")
          .slice(0, 80) || "this device",
      );
      options.onUrl(url.toString());
      if (options.open) openBrowser(url.toString());
    });
  });
}
