"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  ExternalLink,
  KeyRound,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  TerminalSquare,
  TriangleAlert,
} from "lucide-react";
import { Button, Checkbox } from "@authometry/ui";
import { inputClass } from "@/components/auth/auth-shell";
import { PageContainer, PageHeader } from "@/components/layout/page";

const defaultScopes = ["openid", "profile", "email", "offline_access"];
const flowStorageKey = "authometry-playground-flow";

function randomUrlSafeValue(length = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function createPkcePair() {
  const verifier = randomUrlSafeValue(48);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  return { verifier, challenge };
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <span className="mb-1.5 flex items-center justify-between gap-3 text-xs font-medium">
      {children}
      {hint && <span className="font-normal text-[var(--text-tertiary)]">{hint}</span>}
    </span>
  );
}

export default function PlaygroundPage() {
  const [clientId, setClientId] = useState("amt_client_dashboard");
  const [redirectUri, setRedirectUri] = useState("");
  const [scopes, setScopes] = useState(["openid", "profile", "email"]);
  const [verifier, setVerifier] = useState("");
  const [challenge, setChallenge] = useState("");
  const [state, setState] = useState("");
  const [nonce, setNonce] = useState("");
  const [copied, setCopied] = useState(false);
  const [callback, setCallback] = useState<Array<[string, string]>>([]);

  const regenerateSecurityValues = async () => {
    const pair = await createPkcePair();
    setVerifier(pair.verifier);
    setChallenge(pair.challenge);
    setState(randomUrlSafeValue(18));
    setNonce(randomUrlSafeValue(18));
  };

  useEffect(() => {
    const current = new URL(window.location.href);
    const configuredClientId = current.searchParams.get("client_id")?.trim();
    const configuredRedirectUri = current.searchParams.get("redirect_uri")?.trim();
    const configuredScopes = current.searchParams.get("scope")?.split(/\s+/).filter(Boolean);
    const callbackEntries = ["code", "state", "error", "error_description"]
      .map((key) => [key, current.searchParams.get(key)] as const)
      .filter((entry): entry is [string, string] => Boolean(entry[1]));
    if (configuredClientId) setClientId(configuredClientId);
    setRedirectUri(configuredRedirectUri || new URL(current.pathname, current.origin).toString());
    if (configuredScopes?.length) setScopes(configuredScopes);
    setCallback(callbackEntries);
    try {
      const saved = callbackEntries.length ? sessionStorage.getItem(flowStorageKey) : null;
      if (saved) {
        const flow = JSON.parse(saved) as {
          verifier: string;
          challenge: string;
          state: string;
          nonce: string;
        };
        setVerifier(flow.verifier);
        setChallenge(flow.challenge);
        setState(flow.state);
        setNonce(flow.nonce);
        return;
      }
    } catch {
      sessionStorage.removeItem(flowStorageKey);
    }
    void regenerateSecurityValues();
  }, []);

  const validation = useMemo(() => {
    if (!clientId.trim()) return "Enter a client ID to build the request.";
    try {
      const redirect = new URL(redirectUri);
      if (!["http:", "https:"].includes(redirect.protocol)) throw new Error();
    } catch {
      return "Enter a valid HTTP or HTTPS redirect URI.";
    }
    if (!scopes.length) return "Select at least one scope.";
    if (!challenge || !state || !nonce) return "Generating security values…";
    return "";
  }, [challenge, clientId, nonce, redirectUri, scopes.length, state]);

  const parameters = useMemo(
    () => [
      ["client_id", clientId],
      ["redirect_uri", redirectUri],
      ["response_type", "code"],
      ["scope", scopes.join(" ")],
      ["code_challenge", challenge],
      ["code_challenge_method", "S256"],
      ["state", state],
      ["nonce", nonce],
    ],
    [challenge, clientId, nonce, redirectUri, scopes, state],
  );

  const url = useMemo(() => {
    const value = new URL(
      "/oauth/authorize",
      typeof window === "undefined" ? "https://auth.example.com" : window.location.origin,
    );
    value.search = new URLSearchParams(parameters).toString();
    return value.toString();
  }, [parameters]);

  const reset = () => {
    setClientId("amt_client_dashboard");
    setScopes(["openid", "profile", "email"]);
    if (typeof window !== "undefined") {
      setRedirectUri(new URL(window.location.pathname, window.location.origin).toString());
    }
    void regenerateSecurityValues();
  };

  const copyUrl = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const preserveFlowForRedirect = () => {
    sessionStorage.setItem(flowStorageKey, JSON.stringify({ verifier, challenge, state, nonce }));
  };

  const returnedState = callback.find(([key]) => key === "state")?.[1];
  const callbackStateMatches = !returnedState || !state || returnedState === state;
  const scopeOptions = [...new Set([...defaultScopes, ...scopes])];

  return (
    <PageContainer>
      <PageHeader
        actions={
          <Button onClick={reset} size="compact" variant="ghost">
            <RotateCcw className="size-3.5" /> Reset
          </Button>
        }
        description="Configure an OAuth request, run it against this instance, and inspect the redirect response."
        eyebrow={
          <span className="flex items-center gap-1.5">
            <TerminalSquare className="size-3.5" /> Developer tools
          </span>
        }
        title="OAuth playground"
      />

      <ol className="mb-7 grid overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] sm:grid-cols-3">
        {[
          ["1", "Configure", "Set client and permissions", true],
          ["2", "Authorize", "Open the generated request", false],
          [
            "3",
            "Inspect",
            callback.length ? "Redirect received" : "Await the redirect",
            callback.length > 0,
          ],
        ].map(([number, label, description, active], index) => (
          <li
            className="relative flex min-h-16 items-center gap-3 border-b border-[var(--border)] px-4 last:border-0 sm:border-r sm:border-b-0 sm:last:border-r-0"
            key={String(label)}
          >
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                active
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "border-[var(--border-strong)] text-[var(--text-tertiary)]"
              }`}
            >
              {active && number === "3" ? <Check className="size-3.5" /> : number}
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-medium">{label}</span>
              <span className="block truncate text-xs text-[var(--text-tertiary)]">
                {description}
              </span>
            </span>
            {index < 2 && (
              <ChevronRight className="absolute top-1/2 -right-2.5 z-10 hidden size-5 -translate-y-1/2 rounded-full border border-[var(--border)] bg-[var(--surface-raised)] p-0.5 text-[var(--text-tertiary)] sm:block" />
            )}
          </li>
        ))}
      </ol>

      {callback.length > 0 && (
        <section className="mb-7 overflow-hidden rounded-lg border border-[var(--accent-border)] bg-[var(--accent-soft)]">
          <div className="flex items-center gap-2 border-b border-[var(--accent-border)] px-4 py-3">
            {callback.some(([key]) => key === "error") || !callbackStateMatches ? (
              <TriangleAlert className="size-4 text-[var(--warning)]" />
            ) : (
              <CheckCircle2 className="size-4 text-[var(--success)]" />
            )}
            <h2 className="text-[13px] font-semibold">Authorization redirect received</h2>
            {!callbackStateMatches && (
              <span className="ml-auto text-xs font-medium text-[var(--danger)]">
                State mismatch
              </span>
            )}
          </div>
          <dl className="divide-y divide-[var(--accent-border)] px-4">
            {callback.map(([key, value]) => (
              <div className="grid gap-1 py-2.5 sm:grid-cols-[150px_1fr]" key={key}>
                <dt className="technical-value text-[var(--text-secondary)]">{key}</dt>
                <dd className="technical-value break-all">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,0.9fr)_minmax(460px,1.1fr)]">
        <section className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-raised)]">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <h2 className="text-sm font-semibold">Request configuration</h2>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              Values update the authorization request as you type.
            </p>
          </div>
          <div className="space-y-5 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <FieldLabel>Client ID</FieldLabel>
                <input
                  autoComplete="off"
                  className={`${inputClass} technical-value`}
                  onChange={(event) => setClientId(event.target.value)}
                  value={clientId}
                />
              </label>
              <label className="block">
                <FieldLabel>Flow</FieldLabel>
                <select className={inputClass} disabled value="code-pkce">
                  <option value="code-pkce">Authorization Code + PKCE</option>
                </select>
              </label>
            </div>

            <label className="block">
              <FieldLabel hint="Must match the client configuration">Redirect URI</FieldLabel>
              <input
                className={`${inputClass} technical-value`}
                onChange={(event) => setRedirectUri(event.target.value)}
                spellCheck={false}
                value={redirectUri}
              />
            </label>

            <fieldset>
              <legend className="mb-2 text-xs font-medium">Requested scopes</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {scopeOptions.map((scope) => {
                  const checked = scopes.includes(scope);
                  return (
                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors ${
                        checked
                          ? "border-[var(--accent-border)] bg-[var(--accent-soft)]"
                          : "border-[var(--border)] hover:bg-[var(--surface-hover)]"
                      }`}
                      key={scope}
                    >
                      <Checkbox
                        checked={checked}
                        onChange={(event) =>
                          setScopes(
                            event.target.checked
                              ? [...scopes, scope]
                              : scopes.filter((value) => value !== scope),
                          )
                        }
                      />
                      <span>
                        <span className="technical-value block font-medium">{scope}</span>
                        <span className="mt-0.5 block text-[11px] text-[var(--text-tertiary)]">
                          {
                            {
                              openid: "Identify the signed-in user",
                              profile: "Read basic profile claims",
                              email: "Read email claims",
                              offline_access: "Issue a refresh token",
                            }[scope]
                          }
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex gap-2.5">
                  <KeyRound className="mt-0.5 size-4 text-[var(--accent)]" />
                  <div>
                    <p className="text-xs font-semibold">Request security</p>
                    <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                      Fresh PKCE, state, and nonce values protect each run.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => void regenerateSecurityValues()}
                  size="compact"
                  variant="ghost"
                >
                  <RefreshCw className="size-3" /> Regenerate
                </Button>
              </div>
              <div className="space-y-3">
                <label className="block">
                  <FieldLabel hint="Keep this for token exchange">PKCE verifier</FieldLabel>
                  <input className={`${inputClass} technical-value`} readOnly value={verifier} />
                </label>
                <label className="block">
                  <FieldLabel>State</FieldLabel>
                  <input
                    className={`${inputClass} technical-value`}
                    onChange={(event) => setState(event.target.value)}
                    value={state}
                  />
                </label>
                <label className="block">
                  <FieldLabel>Nonce</FieldLabel>
                  <input
                    className={`${inputClass} technical-value`}
                    onChange={(event) => setNonce(event.target.value)}
                    value={nonce}
                  />
                </label>
              </div>
            </div>
          </div>
        </section>

        <aside className="overflow-hidden rounded-lg border border-[var(--border-strong)] bg-[var(--surface-raised)] xl:sticky xl:top-6">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[var(--success)] shadow-[0_0_0_3px_var(--surface-subtle)]" />
              <h2 className="text-xs font-semibold">Live authorization request</h2>
            </div>
            <Button onClick={() => void copyUrl()} size="compact" variant="ghost">
              {copied ? (
                <Check className="size-3 text-[var(--success)]" />
              ) : (
                <Clipboard className="size-3" />
              )}
              {copied ? "Copied" : "Copy URL"}
            </Button>
          </div>

          <div className="flex min-w-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 font-mono text-xs">
            <span className="rounded bg-[var(--accent-soft)] px-1.5 py-0.5 font-semibold text-[var(--accent)]">
              GET
            </span>
            <span className="truncate text-[var(--text-secondary)]">/oauth/authorize</span>
          </div>

          <dl className="divide-y divide-[var(--border-subtle)] px-4">
            {parameters.map(([key, value]) => (
              <div className="grid gap-1 py-2.5 sm:grid-cols-[148px_minmax(0,1fr)]" key={key}>
                <dt className="technical-value text-[var(--accent)]">{key}</dt>
                <dd className="technical-value break-all text-[var(--text-secondary)]">
                  {value || <span className="text-[var(--danger)]">Not set</span>}
                </dd>
              </div>
            ))}
          </dl>

          <div className="border-t border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="mb-3 flex items-center gap-2 text-xs">
              {validation ? (
                <>
                  <TriangleAlert className="size-3.5 shrink-0 text-[var(--warning)]" />
                  <span className="text-[var(--text-secondary)]">{validation}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="size-3.5 text-[var(--success)]" />
                  <span className="text-[var(--text-secondary)]">Request is ready to run</span>
                </>
              )}
            </div>
            {validation ? (
              <Button className="w-full" disabled variant="primary">
                Open authorization request <ArrowRight className="size-3.5" />
              </Button>
            ) : (
              <Button asChild className="w-full" variant="primary">
                <a href={url} onClick={preserveFlowForRedirect}>
                  Open authorization request <ExternalLink className="size-3.5" />
                </a>
              </Button>
            )}
            <p className="mt-2 text-center text-[11px] text-[var(--text-tertiary)]">
              Continues in this tab so the redirect can be inspected here.
            </p>
          </div>
        </aside>
      </div>
    </PageContainer>
  );
}
