"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Checkbox, Note } from "@authometry/ui";
import { RelativeTime } from "@/components/data-display/formatted-time";
import { CodeBlock, Snippet } from "@/components/data-display/copyable-value";
import { ErrorState, ListSkeleton } from "@/components/data-display/states";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { SettingsSection } from "@/components/settings/settings-section";
import { Modal } from "@/components/ui/dialog";
import { ChoiceRow, Field, Input, Select } from "@/components/ui/form";
import { apiFetch } from "@/lib/api";

interface Token {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  last_used_at?: string;
  expires_at?: string;
}

const scopeOptions = [
  { value: "config:read", description: "Plan and diff configuration manifests" },
  { value: "config:write", description: "Apply configuration manifests" },
  { value: "applications:read", description: "List and read applications" },
  { value: "applications:write", description: "Create and update applications" },
];

export default function TokensPage() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [rawToken, setRawToken] = useState<string>();
  const [selectedToken, setSelectedToken] = useState<Token>();
  const [scopes, setScopes] = useState(scopeOptions.map((scope) => scope.value));
  const query = useQuery({
    queryKey: ["personal-tokens"],
    queryFn: () => apiFetch<{ data: Token[] }>("/api/v1/settings/tokens"),
  });
  const create = useMutation({
    mutationFn: ({ name, expiresInDays }: { name: string; expiresInDays: number | null }) =>
      apiFetch<{ token: string }>("/api/v1/settings/tokens", {
        method: "POST",
        body: JSON.stringify({ name, scopes, expiresInDays }),
      }),
    onSuccess: async (result) => {
      setRawToken(result.token);
      await client.invalidateQueries({ queryKey: ["personal-tokens"] });
      toast.success("API token created.");
    },
    onError: (error) => toast.error(error.message),
  });
  const revoke = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/settings/tokens/${id}/revoke`, { method: "POST" }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["personal-tokens"] });
      toast.success("Token revoked.");
    },
    onError: (error) => toast.error(error.message),
  });
  function close() {
    setOpen(false);
    setRawToken(undefined);
    setScopes(scopeOptions.map((scope) => scope.value));
  }
  return (
    <>
      <SettingsSection
        description="Personal tokens authenticate the Authometry CLI and CI. Only a hash is stored."
        footer={
          <Button onClick={() => setOpen(true)} size="compact" variant="primary">
            <Plus aria-hidden="true" className="size-3.5" /> Create token
          </Button>
        }
        footerHint="Tokens act as you, limited to the scopes you choose."
        title="API tokens"
      >
        {query.isLoading ? (
          <ListSkeleton rows={2} />
        ) : query.isError ? (
          <ErrorState
            description="Authometry could not load API tokens. Check your connection, then retry."
            headingLevel="h3"
            onRetry={() => void query.refetch()}
            title="Unable to load API tokens"
          />
        ) : query.data?.data.length ? (
          <ul className="divide-y divide-[var(--border)] rounded-[var(--radius-control)] border border-[var(--border)]">
            {query.data.data.map((token) => (
              <li className="flex min-h-14 items-center gap-3 px-3 py-2.5" key={token.id}>
                <KeyRound
                  aria-hidden="true"
                  className="size-4 shrink-0 text-[var(--text-secondary)]"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{token.name}</p>
                  <p className="truncate text-xs text-[var(--text-secondary)]">
                    <span className="technical-value">{token.prefix}…</span> ·{" "}
                    {token.last_used_at ? (
                      <>
                        Used <RelativeTime value={token.last_used_at} />
                      </>
                    ) : (
                      "Never used"
                    )}{" "}
                    ·{" "}
                    {token.expires_at ? (
                      <>
                        Expires <RelativeTime value={token.expires_at} />
                      </>
                    ) : (
                      "No expiry"
                    )}
                  </p>
                  <p className="technical-value truncate text-[11px] text-[var(--text-tertiary)]">
                    {token.scopes.join(" · ")}
                  </p>
                </div>
                <Button
                  className="hover:text-[var(--danger)]"
                  onClick={() => setSelectedToken(token)}
                  size="compact"
                  variant="ghost"
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-[var(--radius-control)] border border-dashed border-[var(--border-strong)] px-4 py-6 text-center text-[13px] text-[var(--text-secondary)]">
            No tokens yet. Create one to use the CLI from your terminal or CI.
          </p>
        )}
      </SettingsSection>
      <ConfirmDialog
        actionLabel="Revoke token"
        description="Any CLI session or automation using this token loses access immediately."
        onConfirm={() => (selectedToken ? revoke.mutateAsync(selectedToken.id) : undefined)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setSelectedToken(undefined);
        }}
        open={Boolean(selectedToken)}
        pendingLabel="Revoking…"
        title={selectedToken ? `Revoke ${selectedToken.name}?` : "Revoke token?"}
      />
      <Modal
        description={
          rawToken
            ? "Copy it now — it won’t be shown again."
            : "Choose what this token can do and how long it lasts."
        }
        footer={
          rawToken ? (
            <Button onClick={close} variant="primary">
              Done
            </Button>
          ) : (
            <>
              <Button disabled={create.isPending} onClick={close}>
                Cancel
              </Button>
              <Button
                disabled={!scopes.length}
                form="create-token-form"
                loading={create.isPending}
                type="submit"
                variant="primary"
              >
                Create token
              </Button>
            </>
          )
        }
        onOpenChange={(next) => (next ? setOpen(true) : close())}
        open={open}
        preventClose={create.isPending}
        title={rawToken ? "Your new API token" : "Create API token"}
      >
        {rawToken ? (
          <div className="space-y-3">
            <Note tone="warning">This token is shown only once.</Note>
            <Snippet label="token" value={rawToken} />
            <CodeBlock code={`export AUTHOMETRY_TOKEN=${rawToken}`} label="Shell" />
          </div>
        ) : (
          <form
            autoComplete="off"
            className="space-y-4"
            id="create-token-form"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const expires = String(data.get("expires"));
              create.mutate({
                name: String(data.get("name") ?? "").trim(),
                expiresInDays: expires === "never" ? null : Number(expires),
              });
            }}
          >
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_150px]">
              <Field label="Name">
                <Input
                  autoFocus
                  maxLength={100}
                  minLength={2}
                  name="name"
                  placeholder="GitHub Actions"
                  required
                />
              </Field>
              <Field label="Expires">
                <Select defaultValue="90" name="expires">
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="365">1 year</option>
                  <option value="never">Never</option>
                </Select>
              </Field>
            </div>
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium">Scopes</legend>
              <div className="space-y-1">
                {scopeOptions.map((scope) => (
                  <ChoiceRow
                    control={
                      <Checkbox
                        checked={scopes.includes(scope.value)}
                        onChange={(event) =>
                          setScopes(
                            event.target.checked
                              ? [...scopes, scope.value]
                              : scopes.filter((value) => value !== scope.value),
                          )
                        }
                      />
                    }
                    description={scope.description}
                    key={scope.value}
                    title={
                      <code className="technical-value text-[var(--text-primary)]">
                        {scope.value}
                      </code>
                    }
                  />
                ))}
              </div>
            </fieldset>
          </form>
        )}
      </Modal>
    </>
  );
}
