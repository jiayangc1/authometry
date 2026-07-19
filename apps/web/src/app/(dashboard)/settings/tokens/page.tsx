"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, EmptyState } from "@authometry/ui";
import { inputClass } from "@/components/auth/auth-shell";
import { RelativeTime } from "@/components/data-display/formatted-time";
import { ErrorState, PageSkeleton } from "@/components/data-display/states";
import { CopyableValue } from "@/components/data-display/copyable-value";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { SettingsSection } from "@/components/settings/settings-section";
import { apiFetch } from "@/lib/api";

interface Token {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  last_used_at?: string;
}
export default function TokensPage() {
  const client = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [rawToken, setRawToken] = useState<string>();
  const [selectedToken, setSelectedToken] = useState<Token>();
  const query = useQuery({
    queryKey: ["personal-tokens"],
    queryFn: () => apiFetch<{ data: Token[] }>("/api/v1/settings/tokens"),
  });
  const create = useMutation({
    mutationFn: (name: string) =>
      apiFetch<{ token: string }>("/api/v1/settings/tokens", {
        method: "POST",
        body: JSON.stringify({
          name,
          scopes: ["config:read", "config:write", "applications:read", "applications:write"],
          expiresInDays: 90,
        }),
      }),
    onSuccess: async (result) => {
      setRawToken(result.token);
      setAdding(false);
      await client.invalidateQueries({ queryKey: ["personal-tokens"] });
      toast.success("API token created");
    },
    onError: (error) => toast.error(error.message),
  });
  const revoke = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/settings/tokens/${id}/revoke`, { method: "POST" }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["personal-tokens"] });
      toast.success("Token revoked");
    },
  });
  return (
    <SettingsSection
      description="Scoped tokens authenticate the Authometry CLI. Values are stored only as hashes."
      title="API tokens"
    >
      <div className="flex justify-end">
        <Button onClick={() => setAdding((value) => !value)}>
          <Plus aria-hidden="true" className="size-3.5" /> Create Token
        </Button>
      </div>
      {adding && (
        <form
          className="flex gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3"
          onSubmit={(event) => {
            event.preventDefault();
            const name = new FormData(event.currentTarget).get("name");
            if (typeof name === "string") create.mutate(name);
          }}
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">Token name</span>
            <input
              autoComplete="off"
              className={inputClass}
              name="name"
              placeholder="Deployment CLI…"
              required
            />
          </label>
          <Button disabled={create.isPending} type="submit" variant="primary">
            {create.isPending ? "Creating…" : "Create Token"}
          </Button>
        </form>
      )}
      {rawToken && (
        <div className="border border-[var(--warning-border)] bg-[var(--warning-soft)] p-3">
          <p className="text-xs font-semibold">Copy this token now</p>
          <div className="mt-2">
            <CopyableValue value={rawToken} />
          </div>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">
            It will not be displayed again.
          </p>
        </div>
      )}
      {query.isLoading ? (
        <PageSkeleton rows={4} />
      ) : query.isError ? (
        <ErrorState
          description="Authometry could not load API tokens. Check your connection, then retry."
          headingLevel="h3"
          onRetry={() => void query.refetch()}
          title="Unable to Load API Tokens"
        />
      ) : query.data?.data.length ? (
        <div className="border-y border-[var(--border)]">
          {query.data.data.map((token) => (
            <div
              className="virtualized-row grid min-h-16 grid-cols-[1fr_auto] items-center gap-3 border-b border-[var(--border-subtle)] px-2 last:border-0"
              key={token.id}
            >
              <div>
                <p className="text-[13px] font-medium">{token.name}</p>
                <p className="technical-value text-[var(--text-tertiary)]">
                  {token.prefix}… ·{" "}
                  {token.last_used_at ? (
                    <>
                      used <RelativeTime value={token.last_used_at} />
                    </>
                  ) : (
                    "never used"
                  )}
                </p>
                <p className="technical-value text-[var(--text-tertiary)]">
                  {token.scopes.join(", ")}
                </p>
              </div>
              <Button
                disabled={revoke.isPending}
                onClick={() => setSelectedToken(token)}
                size="compact"
                variant="ghost"
              >
                Revoke
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          description="Create a scoped token to use validate, plan, apply, and status from CI or your terminal."
          headingLevel="h3"
          icon={KeyRound}
          title="No API tokens"
        />
      )}
      <ConfirmDialog
        actionLabel="Revoke Token"
        description="Any CLI or automation using this token will lose access immediately. This action cannot be undone."
        onConfirm={() => (selectedToken ? revoke.mutateAsync(selectedToken.id) : undefined)}
        onOpenChange={(open) => {
          if (!open) setSelectedToken(undefined);
        }}
        open={Boolean(selectedToken)}
        pendingLabel="Revoking…"
        title={selectedToken ? `Revoke the ${selectedToken.name} token?` : "Revoke token?"}
      />
    </SettingsSection>
  );
}
