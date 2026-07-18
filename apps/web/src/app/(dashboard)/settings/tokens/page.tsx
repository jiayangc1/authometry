"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, EmptyState } from "@authometry/ui";
import { inputClass } from "@/components/auth/auth-shell";
import { SettingsSection } from "@/components/settings/settings-section";
import { apiFetch } from "@/lib/api";
import { relativeTime } from "@/lib/format";

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
  const query = useQuery({
    queryKey: ["personal-tokens"],
    queryFn: () => apiFetch<{ data: Token[] }>("/api/v1/settings/tokens"),
  });
  const create = useMutation({
    mutationFn: ({ name, scopes }: { name: string; scopes: string[] }) =>
      apiFetch<{ token: string }>("/api/v1/settings/tokens", {
        method: "POST",
        body: JSON.stringify({ name, scopes, expiresInDays: 90 }),
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
      description="Scoped tokens authenticate the Authometry CLI or MCP server. Values are stored only as hashes."
      title="API tokens"
    >
      <div className="flex justify-end">
        <Button onClick={() => setAdding((value) => !value)}>
          <Plus className="size-3.5" /> Create token
        </Button>
      </div>
      {adding && (
        <form
          className="flex gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const name = data.get("name");
            const purpose = data.get("purpose");
            if (typeof name === "string") {
              create.mutate({
                name,
                scopes: purpose === "mcp" ? ["mcp:read"] : ["config:read", "config:write"],
              });
            }
          }}
        >
          <input
            autoFocus
            className={inputClass}
            name="name"
            placeholder="Deployment CLI"
            required
          />
          <select className={inputClass} defaultValue="mcp" name="purpose">
            <option value="mcp">MCP read-only</option>
            <option value="cli">Deployment CLI</option>
          </select>
          <Button disabled={create.isPending} type="submit" variant="primary">
            Create
          </Button>
        </form>
      )}
      {rawToken && (
        <div className="border border-[var(--warning-border)] bg-[var(--warning-soft)] p-3">
          <p className="text-xs font-semibold">Copy this token now</p>
          <code className="technical-value mt-2 block break-all select-all">{rawToken}</code>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">
            It will not be displayed again.
          </p>
        </div>
      )}
      {query.data?.data.length ? (
        <div className="border-y border-[var(--border)]">
          {query.data.data.map((token) => (
            <div
              className="grid min-h-16 grid-cols-[1fr_auto] items-center gap-3 border-b border-[var(--border-subtle)] px-2 last:border-0"
              key={token.id}
            >
              <div>
                <p className="text-[13px] font-medium">{token.name}</p>
                <p className="technical-value text-[var(--text-tertiary)]">
                  {token.prefix}… ·{" "}
                  {token.last_used_at ? `used ${relativeTime(token.last_used_at)}` : "never used"}
                </p>
                <p className="technical-value text-[var(--text-tertiary)]">
                  {token.scopes.join(", ")}
                </p>
              </div>
              <Button
                disabled={revoke.isPending}
                onClick={() => revoke.mutate(token.id)}
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
          description="Create a scoped token for the deployment CLI or read-only MCP access."
          icon={KeyRound}
          title="No API tokens"
        />
      )}
    </SettingsSection>
  );
}
