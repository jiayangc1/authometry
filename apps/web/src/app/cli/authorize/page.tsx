"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Building2, Terminal } from "lucide-react";
import { Button, Note } from "@authometry/ui";
import { AuthorizationShell } from "@/components/auth/auth-shell";
import { ErrorState, Skeleton } from "@/components/data-display/states";
import { ApiClientError, apiFetch } from "@/lib/api";

interface Account {
  user: { email: string };
  workspaces: Array<{ id: string; name: string }>;
  activeWorkspaceId: string;
}

const permissions = [
  "Create, read, and update applications",
  "Plan, diff, and apply configuration manifests",
];

function callbackUrl(port: number, state: string, code?: string): string {
  const url = new URL(`http://127.0.0.1:${port}/callback`);
  url.searchParams.set("state", state);
  if (code) url.searchParams.set("code", code);
  else url.searchParams.set("error", "access_denied");
  return url.toString();
}

export default function CliAuthorizePage() {
  const params = useSearchParams();
  const port = Number(params.get("port"));
  const state = params.get("state") ?? "";
  const codeChallenge = params.get("code_challenge") ?? "";
  const deviceName = (params.get("device") ?? "").trim().slice(0, 80) || "this device";
  const valid =
    Number.isInteger(port) &&
    port >= 1024 &&
    port <= 65535 &&
    /^[A-Za-z0-9_-]{16,128}$/.test(state) &&
    /^[A-Za-z0-9_-]{43}$/.test(codeChallenge);
  const query = useQuery({
    queryKey: ["cli-authorize-account"],
    queryFn: () => apiFetch<Account>("/api/v1/auth/me"),
    enabled: valid,
    retry: false,
  });
  const [decision, setDecision] = useState<"approve" | "deny">();
  const [error, setError] = useState<string>();
  const signedOut = query.error instanceof ApiClientError && query.error.status === 401;

  useEffect(() => {
    if (!signedOut) return;
    const returnTo = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }, [signedOut]);

  async function approve() {
    setDecision("approve");
    setError(undefined);
    try {
      const result = await apiFetch<{ code: string }>("/api/v1/auth/cli/authorize", {
        method: "POST",
        body: JSON.stringify({ codeChallenge, deviceName }),
      });
      window.location.assign(callbackUrl(port, state, result.code));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The CLI could not be authorized.");
      setDecision(undefined);
    }
  }

  function deny() {
    setDecision("deny");
    window.location.assign(callbackUrl(port, state));
  }

  if (!valid)
    return (
      <AuthorizationShell>
        <ErrorState
          description="This login link is incomplete. Run authometry login in your terminal to start again."
          title="This request is not valid"
        />
      </AuthorizationShell>
    );
  if (query.isLoading || signedOut)
    return (
      <AuthorizationShell>
        <div className="space-y-3" role="status" aria-label="Loading…">
          <Skeleton className="mx-auto h-7 w-48" />
          <Skeleton className="mx-auto h-4 w-64" />
          <Skeleton className="mt-6 h-32 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </AuthorizationShell>
    );
  if (query.isError || !query.data)
    return (
      <AuthorizationShell>
        <ErrorState
          description="Your account could not be loaded. Try again, or run authometry login to restart."
          onRetry={() => void query.refetch()}
          title="This request is unavailable"
        />
      </AuthorizationShell>
    );
  const workspace = query.data.workspaces.find(({ id }) => id === query.data.activeWorkspaceId);
  return (
    <AuthorizationShell>
      <div className="w-full">
        <header className="mb-6 text-center">
          <h1 className="text-2xl leading-8 font-semibold tracking-[-0.03em] text-balance">
            Authorize the Authometry CLI
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            The CLI on <span className="font-medium text-[var(--text-primary)]">{deviceName}</span>{" "}
            wants to act as{" "}
            <span className="font-medium text-[var(--text-primary)]">{query.data.user.email}</span>
          </p>
        </header>
        <div className="mb-5 overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-subtle)]">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-4">
            <div className="min-w-0 text-center">
              <Terminal
                aria-hidden="true"
                className="mx-auto mb-1.5 size-4 text-[var(--text-secondary)]"
              />
              <p className="text-[11px] text-[var(--text-tertiary)]">Device</p>
              <p className="mt-1 truncate text-xs font-medium">{deviceName}</p>
            </div>
            <div className="flex items-center gap-1 text-[var(--text-tertiary)]">
              <span className="h-px w-4 bg-[var(--border-strong)]" />
              <ArrowRight aria-hidden="true" className="size-3.5" />
              <span className="h-px w-4 bg-[var(--border-strong)]" />
            </div>
            <div className="min-w-0 text-center">
              <Building2
                aria-hidden="true"
                className="mx-auto mb-1.5 size-4 text-[var(--text-secondary)]"
              />
              <p className="text-[11px] text-[var(--text-tertiary)]">Workspace</p>
              <p className="mt-1 truncate text-xs font-medium">{workspace?.name ?? "Current"}</p>
            </div>
          </div>
          <ul className="space-y-1 border-t border-[var(--border)] px-4 py-3 text-xs leading-5 text-[var(--text-secondary)]">
            {permissions.map((permission) => (
              <li key={permission}>{permission}</li>
            ))}
          </ul>
        </div>
        <p className="text-xs leading-5 text-[var(--text-secondary)]">
          Only approve this if you just ran{" "}
          <span className="technical-value">authometry login</span> on this computer. The token
          lasts 90 days and can be revoked from Settings → Tokens.
        </p>
        {error && (
          <Note className="mt-4" role="alert" tone="danger">
            {error} Try again or run authometry login to restart.
          </Note>
        )}
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Button disabled={Boolean(decision)} onClick={deny} size="large">
            Cancel
          </Button>
          <Button
            disabled={Boolean(decision)}
            loading={decision === "approve"}
            onClick={() => void approve()}
            size="large"
            variant="primary"
          >
            {decision === "approve" ? "Authorizing…" : "Authorize"}
          </Button>
        </div>
      </div>
    </AuthorizationShell>
  );
}
