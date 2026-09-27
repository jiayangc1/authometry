"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, StatusBadge } from "@authometry/ui";
import { Snippet } from "@/components/data-display/copyable-value";
import { ErrorState, ListSkeleton } from "@/components/data-display/states";
import { SettingsSection } from "@/components/settings/settings-section";
import { Field, Input } from "@/components/ui/form";
import { apiFetch } from "@/lib/api";
import { humanize } from "@/lib/status";

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
      setHostname("");
      await client.invalidateQueries({ queryKey: ["domains"] });
      toast.success("Domain added.");
    },
    onError: (error) => toast.error(error.message),
  });
  const verify = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/settings/domains/${id}/verify`, { method: "POST" }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["domains"] });
      toast.success("Domain verified.");
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <>
      <SettingsSection
        description="Serve an environment’s issuer from your own domain. Add it, publish a TXT record, then verify."
        title="Domains"
      >
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            if (hostname.trim()) add.mutate();
          }}
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">Domain hostname</span>
            <Input
              autoComplete="off"
              compact
              mono
              name="hostname"
              onChange={(event) => setHostname(event.target.value)}
              placeholder="login.example.com"
              required
              spellCheck={false}
              value={hostname}
            />
          </label>
          <Button disabled={!hostname.trim()} loading={add.isPending} type="submit">
            <Plus aria-hidden="true" className="size-3.5" /> Add domain
          </Button>
        </form>
        {verification && (
          <div className="animate-enter space-y-3 rounded-[var(--radius-card)] border border-[var(--info-border)] bg-[var(--info-soft)] p-4">
            <div>
              <p className="text-[13px] font-medium">
                Add this TXT record to{" "}
                <span className="technical-value">{verification.hostname}</span>
              </p>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Copy it now — the value is shown only once. DNS changes can take a few minutes.
              </p>
            </div>
            <Field label="Name">
              <Snippet label="DNS name" value={verification.verification.name} />
            </Field>
            <Field label="Value">
              <Snippet label="DNS value" value={verification.verification.value} />
            </Field>
            <div className="flex justify-end">
              <Button
                loading={verify.isPending && verify.variables === verification.id}
                onClick={() => verify.mutate(verification.id)}
                size="compact"
                variant="primary"
              >
                Verify now
              </Button>
            </div>
          </div>
        )}
        {query.isLoading ? (
          <ListSkeleton rows={2} />
        ) : query.isError ? (
          <ErrorState
            description="Authometry could not load custom domains. Check your connection, then retry."
            headingLevel="h3"
            onRetry={() => void query.refetch()}
            title="Unable to load domains"
          />
        ) : query.data?.data.length ? (
          <ul className="divide-y divide-[var(--border)] rounded-[var(--radius-control)] border border-[var(--border)]">
            {query.data.data.map((domain) => (
              <li className="flex min-h-12 items-center gap-3 px-3 py-2" key={domain.id}>
                <Globe2
                  aria-hidden="true"
                  className="size-4 shrink-0 text-[var(--text-secondary)]"
                />
                <div className="min-w-0 flex-1">
                  <p className="technical-value truncate text-[var(--text-primary)]">
                    {domain.hostname}
                  </p>
                  {domain.is_primary && (
                    <p className="text-xs text-[var(--text-tertiary)]">Primary issuer</p>
                  )}
                </div>
                <StatusBadge
                  label={humanize(domain.status)}
                  tone={domain.status === "verified" ? "success" : "warning"}
                />
                {domain.status !== "verified" && (
                  <Button
                    loading={verify.isPending && verify.variables === domain.id}
                    onClick={() => verify.mutate(domain.id)}
                    size="compact"
                    variant="ghost"
                  >
                    Verify
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-[var(--radius-control)] border border-dashed border-[var(--border-strong)] px-4 py-6 text-center text-[13px] text-[var(--text-secondary)]">
            No custom domains yet.
          </p>
        )}
      </SettingsSection>
    </>
  );
}
