"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  KeyRound,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { Button, Checkbox, Note, cn } from "@authometry/ui";
import { CodeBlock, CopyButton, Snippet } from "@/components/data-display/copyable-value";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { apiFetch } from "@/lib/api";
import {
  parsePlaygroundFlow,
  playgroundConfiguration,
  validatePlaygroundCallback,
  validatePlaygroundRequest,
  type PlaygroundApplication,
  type PlaygroundFlow,
} from "@/lib/playground";
import { useActiveEnvironment } from "@/lib/use-environment";

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

function decodeJwt(token: string): Record<string, unknown> | undefined {
  try {
    const payload = token.split(".")[1];
    if (!payload) return undefined;
    const json = atob(payload.replaceAll("-", "+").replaceAll("_", "/"));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export default function PlaygroundPage() {
  const [clientId, setClientId] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [scopes, setScopes] = useState(["openid", "profile", "email"]);
  const [verifier, setVerifier] = useState("");
  const [challenge, setChallenge] = useState("");
  const [state, setState] = useState("");
  const [nonce, setNonce] = useState("");
  const [callback, setCallback] = useState<Array<[string, string]>>([]);
  const [savedFlow, setSavedFlow] = useState<PlaygroundFlow>();
  const [storageError, setStorageError] = useState("");
  const [playgroundUri, setPlaygroundUri] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [exchange, setExchange] = useState<{
    status: "idle" | "pending" | "done" | "error";
    body?: string;
    idToken?: Record<string, unknown>;
  }>({ status: "idle" });
  const { active } = useActiveEnvironment();
  const applications = useQuery({
    queryKey: ["applications", "playground", active?.id],
    queryFn: () =>
      apiFetch<{ data: PlaygroundApplication[] }>("/api/v1/applications?q=&type=&status="),
    enabled: Boolean(active),
  });
  const issuer = active?.issuer ?? "";
  const selectedApplication = applications.data?.data.find(
    (application) => application.client_id === clientId,
  );

  const regenerateSecurityValues = async () => {
    const pair = await createPkcePair();
    setVerifier(pair.verifier);
    setChallenge(pair.challenge);
    setState(randomUrlSafeValue(18));
    setNonce(randomUrlSafeValue(18));
  };

  useEffect(() => {
    const current = new URL(window.location.href);
    setPlaygroundUri(new URL(current.pathname, current.origin).toString());
    const configuredClientId = current.searchParams.get("client_id")?.trim();
    const configuredRedirectUri = current.searchParams.get("redirect_uri")?.trim();
    const configuredScopes = current.searchParams.get("scope")?.split(/\s+/).filter(Boolean);
    const callbackEntries = ["code", "state", "iss", "error", "error_description"]
      .map((key) => [key, current.searchParams.get(key)] as const)
      .filter((entry): entry is [string, string] => Boolean(entry[1]));
    if (configuredClientId) setClientId(configuredClientId);
    setRedirectUri(configuredRedirectUri || new URL(current.pathname, current.origin).toString());
    if (configuredScopes?.length) setScopes(configuredScopes);
    setCallback(callbackEntries);
    setInitialized(true);
    try {
      const flow = parsePlaygroundFlow(
        callbackEntries.length ? sessionStorage.getItem(flowStorageKey) : null,
      );
      if (flow) {
        setSavedFlow(flow);
        setClientId(flow.clientId);
        setRedirectUri(flow.redirectUri);
        setScopes(flow.scopes);
        setVerifier(flow.verifier);
        setChallenge(flow.challenge);
        setState(flow.state);
        setNonce(flow.nonce);
        return;
      }
    } catch {
      setStorageError("Allow session storage in this tab to preserve the authorization request.");
    }
    if (!callbackEntries.length) void regenerateSecurityValues();
  }, []);

  useEffect(() => {
    if (!initialized) return;
    const current = new URL(window.location.href);
    current.searchParams.set("client_id", clientId);
    current.searchParams.set("redirect_uri", redirectUri);
    current.searchParams.set("scope", scopes.join(" "));
    window.history.replaceState(window.history.state, "", current);
  }, [clientId, initialized, redirectUri, scopes]);

  const validation = useMemo(() => {
    if (!issuer) return "Loading the environment issuer…";
    if (applications.isPending) return "Loading applications…";
    if (applications.isError)
      return "Could not load applications. Retry before starting authorization.";
    const configurationError = validatePlaygroundRequest(
      { clientId, redirectUri, scopes },
      selectedApplication,
    );
    if (configurationError) return configurationError;
    if (callback.length) return "Reset the playground to start a new authorization request.";
    if (!challenge || !state || !nonce) return "Generating security values…";
    return "";
  }, [
    applications.isError,
    applications.isPending,
    callback.length,
    challenge,
    clientId,
    issuer,
    nonce,
    redirectUri,
    scopes,
    selectedApplication,
    state,
  ]);

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
    if (!issuer) return "";
    const value = new URL(`${issuer}/oauth/authorize`);
    value.search = new URLSearchParams(parameters).toString();
    return value.toString();
  }, [issuer, parameters]);

  const reset = () => {
    const configuration = playgroundConfiguration(selectedApplication, playgroundUri);
    setClientId(configuration.clientId);
    setRedirectUri(configuration.redirectUri);
    setScopes(configuration.scopes);
    setCallback([]);
    setSavedFlow(undefined);
    setStorageError("");
    setExchange({ status: "idle" });
    const current = new URL(window.location.href);
    for (const key of ["code", "state", "iss", "error", "error_description"])
      current.searchParams.delete(key);
    window.history.replaceState(window.history.state, "", current);
    try {
      sessionStorage.removeItem(flowStorageKey);
    } catch {
      setStorageError("Allow session storage in this tab to preserve the authorization request.");
    }
    void regenerateSecurityValues();
  };

  const selectApplication = (id: string) => {
    const application = applications.data?.data.find((candidate) => candidate.id === id);
    if (!application) return;
    const configuration = playgroundConfiguration(application, playgroundUri);
    setClientId(configuration.clientId);
    setRedirectUri(configuration.redirectUri);
    setScopes(configuration.scopes);
  };

  const callbackError = validatePlaygroundCallback(
    savedFlow,
    new URLSearchParams(callback),
    issuer,
  );
  const callbackApplication = applications.data?.data.find(
    (application) => application.client_id === savedFlow?.clientId,
  );
  const exchangeError =
    callbackError ||
    (applications.isPending
      ? "Loading applications…"
      : applications.isError
        ? "Could not load applications. Retry before exchanging the code."
        : !callbackApplication || callbackApplication.status !== "active"
          ? "The original application is no longer available in this environment."
          : callbackApplication.token_endpoint_auth_method !== "none"
            ? "This application requires client authentication. Exchange the code on your server using the saved PKCE verifier and registered credentials."
            : "");

  const exchangeCode = async () => {
    const code = callback.find(([key]) => key === "code")?.[1];
    if (
      !code ||
      !savedFlow ||
      exchangeError ||
      exchange.status === "pending" ||
      exchange.status === "done"
    )
      return;
    setExchange({ status: "pending" });
    try {
      const response = await fetch(`${savedFlow.issuer}/oauth/token`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: savedFlow.redirectUri,
          client_id: savedFlow.clientId,
          code_verifier: savedFlow.verifier,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      const idToken = typeof body.id_token === "string" ? decodeJwt(body.id_token) : undefined;
      setExchange({
        status: response.ok ? "done" : "error",
        body: JSON.stringify(body, null, 2),
        ...(idToken ? { idToken } : {}),
      });
    } catch (error) {
      setExchange({
        status: "error",
        body: error instanceof Error ? error.message : "The token request failed.",
      });
    }
  };

  const preserveFlowForRedirect = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (validation) {
      event.preventDefault();
      return;
    }
    try {
      const flow: PlaygroundFlow = {
        clientId,
        redirectUri,
        scopes,
        issuer,
        verifier,
        challenge,
        state,
        nonce,
      };
      sessionStorage.setItem(flowStorageKey, JSON.stringify(flow));
    } catch {
      event.preventDefault();
      setStorageError("Allow session storage in this tab to preserve the authorization request.");
    }
  };

  const scopeOptions = [
    ...new Set([...(selectedApplication?.allowed_scopes ?? defaultScopes), ...scopes]),
  ];
  const redirectRegistered =
    !selectedApplication || selectedApplication.redirect_uris.includes(redirectUri);
  const hasCode = callback.some(([key]) => key === "code");
  const hasError = callback.some(([key]) => key === "error");
  const step = exchange.status === "done" ? 3 : callback.length ? 2 : 1;

  return (
    <PageContainer>
      <PageHeader
        actions={
          <Button onClick={reset} variant="ghost">
            <RotateCcw aria-hidden="true" className="size-3.5" /> Reset
          </Button>
        }
        description={`Build an Authorization Code + PKCE request, run it against ${active?.name ?? "this environment"}, and inspect every value that comes back.`}
        title="OAuth playground"
      />

      <ol
        aria-label="Progress"
        className="mb-6 flex items-center gap-2 overflow-x-auto text-[13px]"
      >
        {["Configure", "Authorize", "Exchange"].map((label, index) => {
          const done = index < step;
          const current = index === step || (step === 3 && index === 2);
          return (
            <li className="flex shrink-0 items-center gap-2" key={label}>
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-px w-8 transition-colors duration-[var(--motion-slow)]",
                    done ? "bg-[var(--text-primary)]" : "bg-[var(--border-strong)]",
                  )}
                />
              )}
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full border text-xs font-medium transition-all duration-[var(--motion-normal)] ease-[var(--ease-spring)]",
                  done
                    ? "border-transparent bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : current
                      ? "border-[var(--text-primary)] text-[var(--text-primary)]"
                      : "border-[var(--border-strong)] text-[var(--text-tertiary)]",
                )}
              >
                {done ? <Check aria-hidden="true" className="size-3" /> : index + 1}
              </span>
              <span className={done || current ? "font-medium" : "text-[var(--text-secondary)]"}>
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      {callback.length > 0 && (
        <Card className="animate-enter mb-6 overflow-hidden">
          <CardHeader
            actions={
              hasCode && !hasError ? (
                <Button
                  disabled={
                    Boolean(exchangeError) ||
                    exchange.status === "pending" ||
                    exchange.status === "done"
                  }
                  loading={exchange.status === "pending"}
                  onClick={() => void exchangeCode()}
                  size="compact"
                  variant="primary"
                >
                  {exchange.status === "done" ? "Exchanged" : "Exchange code for tokens"}
                </Button>
              ) : undefined
            }
            description={
              callbackError
                ? callbackError
                : hasError
                  ? "Authometry returned an error. Check the trace for the full explanation."
                  : "Authometry redirected back with an authorization code."
            }
            title={
              <span className="flex items-center gap-2">
                {hasError || callbackError ? (
                  <TriangleAlert aria-hidden="true" className="size-4 text-[var(--warning)]" />
                ) : (
                  <CheckCircle2 aria-hidden="true" className="size-4 text-[var(--success)]" />
                )}
                Redirect received
              </span>
            }
          />
          {hasCode && exchangeError && !callbackError && (
            <div className="px-4 pb-4 sm:px-5">
              <Note tone="warning">{exchangeError}</Note>
            </div>
          )}
          <dl className="divide-y divide-[var(--border)]">
            {callback.map(([key, value]) => (
              <div
                className="grid items-center gap-1 px-4 py-2 sm:grid-cols-[160px_minmax(0,1fr)] sm:px-5"
                key={key}
              >
                <dt className="technical-value text-[var(--text-secondary)]">{key}</dt>
                <dd className="flex min-w-0 items-center gap-1">
                  <span className="technical-value min-w-0 flex-1 break-all">{value}</span>
                  <CopyButton label={`Copy ${key}`} value={value} />
                </dd>
              </div>
            ))}
            {hasError && (
              <div className="px-4 py-2.5 sm:px-5">
                <Link
                  className="text-[13px] font-medium hover:underline"
                  href="/traces?status=error"
                >
                  Open recent failed traces →
                </Link>
              </div>
            )}
          </dl>
          {exchange.body && (
            <div className="space-y-3 border-t border-[var(--border)] p-4 sm:p-5">
              {exchange.status === "error" && (
                <Note tone="danger">
                  The token endpoint rejected the exchange. Confidential clients must exchange codes
                  on the server with their client secret.
                </Note>
              )}
              <CodeBlock code={exchange.body} label="Token response" maxHeight="280px" />
              {exchange.idToken && (
                <CodeBlock
                  code={JSON.stringify(exchange.idToken, null, 2)}
                  label="ID token claims (decoded, unverified)"
                  maxHeight="280px"
                />
              )}
            </div>
          )}
        </Card>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(440px,1fr)]">
        <Card>
          <CardHeader
            description={
              callback.length
                ? "The saved authorization request. Reset to start a new request."
                : "The request on the right updates as you type."
            }
            title="Request"
          />
          <div className="space-y-5 p-4 sm:p-5">
            {applications.isError ? (
              <Note
                tone="danger"
                action={
                  <Button onClick={() => void applications.refetch()} size="compact">
                    Retry
                  </Button>
                }
              >
                Could not load applications for this environment.
              </Note>
            ) : applications.isSuccess && !applications.data.data.length ? (
              <Note
                tone="info"
                action={
                  <Button asChild size="compact">
                    <Link href="/applications/new">Create application</Link>
                  </Button>
                }
              >
                Create an application in this environment before starting authorization. For token
                exchange here, use a single-page application and register {playgroundUri} as a
                callback URL.
              </Note>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Application">
                <Select
                  disabled={callback.length > 0}
                  onChange={(event) => selectApplication(event.target.value)}
                  value={selectedApplication?.id ?? ""}
                >
                  <option disabled value="">
                    {applications.isPending
                      ? "Loading…"
                      : clientId
                        ? "Select a registered application"
                        : "Select an application"}
                  </option>
                  {(applications.data?.data ?? []).map((application) => (
                    <option
                      disabled={
                        application.status !== "active" ||
                        !application.grant_types.includes("authorization_code")
                      }
                      key={application.id}
                      value={application.id}
                    >
                      {application.name}
                      {application.status !== "active"
                        ? " (disabled)"
                        : !application.grant_types.includes("authorization_code")
                          ? " (no Authorization Code grant)"
                          : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Client ID">
                <Input
                  autoComplete="off"
                  disabled={callback.length > 0}
                  mono
                  name="clientId"
                  onChange={(event) => setClientId(event.target.value)}
                  spellCheck={false}
                  value={clientId}
                />
              </Field>
            </div>

            {selectedApplication && (
              <p className="text-xs text-[var(--text-secondary)]">
                To inspect the callback here, register{" "}
                <span className="technical-value">{playgroundUri}</span> in{" "}
                <Link
                  className="font-medium hover:underline"
                  href={`/applications/${selectedApplication.id}/configuration`}
                >
                  application configuration
                </Link>
                .
                {selectedApplication.token_endpoint_auth_method !== "none" &&
                  " This application exchanges codes on its server with client authentication."}
              </p>
            )}

            <Field
              description={
                redirectRegistered ? (
                  "Must exactly match a callback URL registered on the application."
                ) : (
                  <span className="text-[var(--warning)]">
                    Not registered on {selectedApplication?.name}. Add it under Configuration, or
                    authorization will fail.
                  </span>
                )
              }
              label="Redirect URI"
              labelAction={
                !callback.length && playgroundUri && redirectUri !== playgroundUri ? (
                  <button
                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    onClick={() => setRedirectUri(playgroundUri)}
                    type="button"
                  >
                    Use this page
                  </button>
                ) : undefined
              }
            >
              <Input
                autoComplete="off"
                disabled={callback.length > 0}
                mono
                name="redirectUri"
                onChange={(event) => setRedirectUri(event.target.value)}
                spellCheck={false}
                type="url"
                value={redirectUri}
              />
            </Field>

            <fieldset>
              <legend className="mb-2 text-[13px] font-medium">Scopes</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {scopeOptions.map((scope) => {
                  const checked = scopes.includes(scope);
                  return (
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border px-3 py-2.5 transition-[border-color,background-color,transform] duration-[var(--motion-fast)] active:scale-[0.99]",
                        checked
                          ? "border-[var(--text-primary)] bg-[var(--surface-subtle)]"
                          : "border-[var(--border)] hover:border-[var(--border-strong)]",
                      )}
                      key={scope}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={callback.length > 0}
                        onChange={(event) =>
                          setScopes(
                            event.target.checked
                              ? [...scopes, scope]
                              : scopes.filter((value) => value !== scope),
                          )
                        }
                        wrapperClassName="mt-0.5"
                      />
                      <span>
                        <span className="technical-value block font-medium">{scope}</span>
                        <span className="block text-xs text-[var(--text-secondary)]">
                          {{
                            openid: "Identify the signed-in user",
                            profile: "Read basic profile claims",
                            email: "Read email claims",
                            offline_access: "Issue a refresh token",
                          }[scope] ?? "Custom scope"}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-subtle)]">
              <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
                <div className="flex gap-2.5">
                  <KeyRound
                    aria-hidden="true"
                    className="mt-0.5 size-4 text-[var(--text-secondary)]"
                  />
                  <div>
                    <p className="text-[13px] font-medium">Request security</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Fresh PKCE, state, and nonce values for every run.
                    </p>
                  </div>
                </div>
                <Button
                  className="[&:hover_svg]:rotate-180"
                  disabled={callback.length > 0}
                  onClick={() => void regenerateSecurityValues()}
                  size="compact"
                  variant="ghost"
                >
                  <RefreshCw aria-hidden="true" className="size-3" /> Regenerate
                </Button>
              </div>
              <div className="space-y-3 p-4">
                <Field description="Kept in this tab for the token exchange." label="PKCE verifier">
                  <Snippet label="PKCE verifier" value={verifier || "…"} />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="State">
                    <Input
                      autoComplete="off"
                      compact
                      disabled={callback.length > 0}
                      mono
                      name="state"
                      onChange={(event) => setState(event.target.value)}
                      spellCheck={false}
                      value={state}
                    />
                  </Field>
                  <Field label="Nonce">
                    <Input
                      autoComplete="off"
                      compact
                      disabled={callback.length > 0}
                      mono
                      name="nonce"
                      onChange={(event) => setNonce(event.target.value)}
                      spellCheck={false}
                      value={nonce}
                    />
                  </Field>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <aside className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-raised)] shadow-[var(--shadow-small)] xl:sticky xl:top-6">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] py-2 pr-2 pl-4">
            <div className="flex min-w-0 items-center gap-2 font-mono text-xs">
              <span className="rounded-[4px] bg-[var(--success-soft)] px-1.5 py-0.5 font-semibold text-[var(--success)]">
                GET
              </span>
              <span className="truncate text-[var(--text-secondary)]">
                {issuer
                  ? `${issuer.replace(/^https?:\/\//, "")}/oauth/authorize`
                  : "/oauth/authorize"}
              </span>
            </div>
            <CopyButton label="Copy authorization URL" value={url} />
          </div>

          <dl className="divide-y divide-[var(--border)]">
            {parameters.map(([key, value]) => (
              <div className="grid gap-1 px-4 py-2 sm:grid-cols-[150px_minmax(0,1fr)]" key={key}>
                <dt className="technical-value text-[var(--text-secondary)]">{key}</dt>
                <dd className="technical-value break-all">
                  {value || <span className="text-[var(--danger)]">Not set</span>}
                </dd>
              </div>
            ))}
          </dl>

          <div className="border-t border-[var(--border)] bg-[var(--surface-subtle)] p-4">
            {storageError && (
              <Note className="mb-3" role="alert" tone="danger">
                {storageError}
              </Note>
            )}
            <p aria-live="polite" className="mb-3 flex items-center gap-2 text-[13px]">
              {validation ? (
                <>
                  <TriangleAlert
                    aria-hidden="true"
                    className="size-3.5 shrink-0 text-[var(--warning)]"
                  />
                  <span className="text-[var(--text-secondary)]">{validation}</span>
                </>
              ) : (
                <>
                  <ShieldCheck aria-hidden="true" className="size-3.5 text-[var(--success)]" />
                  <span className="text-[var(--text-secondary)]">Ready to run</span>
                </>
              )}
            </p>
            {validation ? (
              <Button className="w-full" disabled size="large" variant="primary">
                Start authorization <ArrowRight aria-hidden="true" className="size-3.5" />
              </Button>
            ) : (
              <Button
                asChild
                className="w-full [&:hover_svg]:translate-x-0.5"
                size="large"
                variant="primary"
              >
                <a href={url} onClick={preserveFlowForRedirect}>
                  Start authorization <ArrowRight aria-hidden="true" className="size-3.5" />
                </a>
              </Button>
            )}
            <p className="mt-2 text-center text-xs text-[var(--text-tertiary)]">
              Continues in this tab so the redirect can be inspected here.
            </p>
          </div>
        </aside>
      </div>
    </PageContainer>
  );
}
