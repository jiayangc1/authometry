"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Globe2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, EmptyState, StatusBadge } from "@authometry/ui";
import { inputClass } from "@/components/auth/auth-shell";
import { ErrorState, PageSkeleton } from "@/components/data-display/states";
import { SettingsSection } from "@/components/settings/settings-section";
import { apiFetch } from "@/lib/api";

interface Domain {
  id: string;
  hostname: string;
  status: string;
  is_primary: boolean;
}
interface Verification {
  id: string;
  hostname: string;
  verification: { type: string; name: string; value: string };
}

export default function DomainsPage() {
  const client = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [hostname, setHostname] = useState("");
  const [verification, setVerification] = useState<Verification>();
  const query = useQuery({
    queryKey: ["domains"],
    queryFn: () => apiFetch<{ data: Domain[] }>("/api/v1/settings/domains"),
  });
  const add = useMutation({
    mutationFn: () =>
      apiFetch<Verification>("/api/v1/settings/domains", {
        method: "POST",
        body: JSON.stringify({ hostname }),
      }),
    onSuccess: async (result) => {
      setVerification(result);
      setAdding(false);
      await client.invalidateQueries({ queryKey: ["domains"] });
      toast.success("Domain added");
    },
    onError: (error) => toast.error(error.message),
  });
  const verify = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/settings/domains/${id}/verify`, { method: "POST" }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["domains"] });
      toast.success("Domain verified");
    },
    onError: (error) => toast.error(error.message),
  });
  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    toast.success("Copied");
  }
  return (
    <SettingsSection
      description="Use a verified custom domain as an environment issuer."
      title="Domains"
    >
      <div className="flex justify-end">
        <Button onClick={() => setAdding((value) => !value)}>
          <Plus aria-hidden="true" className="size-3.5" /> Add Domain
        </Button>
      </div>
      {adding && (
        <form
          className="flex gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3"
          onSubmit={(event) => {
            event.preventDefault();
            add.mutate();
          }}
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">Domain hostname</span>
            <input
              autoComplete="off"
              className={inputClass}
              name="hostname"
              onChange={(event) => setHostname(event.target.value)}
              placeholder="login.example.com…"
              required
              spellCheck={false}
              value={hostname}
            />
          </label>
          <Button disabled={add.isPending} type="submit" variant="primary">
            {add.isPending ? "Adding…" : "Add Domain"}
          </Button>
        </form>
      )}
      {query.isLoading ? (
        <PageSkeleton rows={4} />
      ) : query.isError ? (
        <ErrorState
          description="Authometry could not load custom domains. Check your connection, then retry."
          headingLevel="h3"
          onRetry={() => void query.refetch()}
          title="Unable to Load Domains"
        />
      ) : query.data?.data.length ? (
        <div className="border-y border-[var(--border)]">
          {query.data.data.map((domain) => (
            <div
              className="virtualized-row flex min-h-14 items-center gap-3 border-b border-[var(--border-subtle)] px-2 last:border-0"
              key={domain.id}
            >
              <Globe2 aria-hidden="true" className="size-4 text-[var(--text-secondary)]" />
              <div className="flex-1">
                <p className="technical-value">{domain.hostname}</p>
                {domain.is_primary && (
                  <p className="text-[10px] text-[var(--text-tertiary)]">Primary issuer</p>
                )}
              </div>
              <StatusBadge
                label={domain.status}
                tone={domain.status === "verified" ? "success" : "warning"}
              />
              {domain.status !== "verified" && (
                <Button
                  disabled={verify.isPending}
                  onClick={() => verify.mutate(domain.id)}
                  size="compact"
                  variant="ghost"
                >
                  Verify
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          description="Add a domain, publish the provided TXT record, and verify it before activation."
          headingLevel="h3"
          icon={Globe2}
          title="No Custom Domains"
        />
      )}
      {verification && (
        <div className="rounded-lg border border-[var(--info-border)] bg-[var(--info-soft)] p-4">
          <p className="text-xs font-semibold">Publish this DNS record</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            The verification value is displayed only once.
          </p>
          <dl className="mt-3 grid grid-cols-[64px_1fr_auto] items-center gap-y-2 text-xs">
            <dt>Type</dt>
            <dd className="technical-value">TXT</dd>
            <span />
            <dt>Name</dt>
            <dd className="technical-value break-all">{verification.verification.name}</dd>
            <Button
              aria-label="Copy DNS name"
              onClick={() => void copy(verification.verification.name)}
              size="icon"
              variant="ghost"
            >
              <Copy aria-hidden="true" className="size-3.5" />
            </Button>
            <dt>Value</dt>
            <dd className="technical-value break-all">{verification.verification.value}</dd>
            <Button
              aria-label="Copy DNS value"
              onClick={() => void copy(verification.verification.value)}
              size="icon"
              variant="ghost"
            >
              <Copy aria-hidden="true" className="size-3.5" />
            </Button>
          </dl>
        </div>
      )}
    </SettingsSection>
  );
}
