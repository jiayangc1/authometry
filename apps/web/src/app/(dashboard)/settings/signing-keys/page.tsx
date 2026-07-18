"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, RotateCw } from "lucide-react";
import { Button, EmptyState, StatusBadge } from "@authometry/ui";
import { RelativeTime } from "@/components/data-display/formatted-time";
import { ErrorState, PageSkeleton } from "@/components/data-display/states";
import { SettingsSection } from "@/components/settings/settings-section";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

interface SigningKey {
  id: string;
  kid: string;
  algorithm: string;
  status: string;
  activates_at: string;
  retires_at?: string;
  created_at: string;
}
export default function SigningKeysPage() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["signing-keys"],
    queryFn: () => apiFetch<{ data: SigningKey[] }>("/api/v1/settings/signing-keys"),
  });
  const rotate = useMutation({
    mutationFn: () => apiFetch("/api/v1/settings/signing-keys/rotate", { method: "POST" }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["signing-keys"] });
      toast.success("Signing key rotated");
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <SettingsSection
      description="Keys used to sign access tokens and ID tokens. Private key material is never displayed."
      title="Signing Keys"
    >
      <div className="flex justify-end">
        <Button
          disabled={rotate.isPending}
          onClick={() => {
            if (
              window.confirm(
                "Rotate the active signing key? Existing keys will follow the configured retirement policy.",
              )
            ) {
              rotate.mutate();
            }
          }}
        >
          <RotateCw aria-hidden="true" className="size-3.5" />{" "}
          {rotate.isPending ? "Rotating…" : "Rotate Key"}
        </Button>
      </div>
      {query.isLoading ? (
        <PageSkeleton rows={4} />
      ) : query.isError ? (
        <ErrorState
          description="Authometry could not load signing keys. Check your connection, then retry."
          headingLevel="h3"
          onRetry={() => void query.refetch()}
          title="Unable to Load Signing Keys"
        />
      ) : query.data?.data.length ? (
        <div className="border-y border-[var(--border)]">
          {query.data.data.map((key) => (
            <div
              className="virtualized-row grid min-h-16 grid-cols-[28px_1fr_auto] items-center gap-3 border-b border-[var(--border-subtle)] px-2 last:border-0 sm:grid-cols-[28px_1fr_100px_130px_auto]"
              key={key.id}
            >
              <KeyRound aria-hidden="true" className="size-4 text-[var(--text-secondary)]" />
              <div>
                <p className="technical-value font-medium">{key.kid}</p>
                <p className="text-xs text-[var(--text-tertiary)]">
                  Created <RelativeTime value={key.created_at} />
                </p>
              </div>
              <span className="technical-value hidden sm:block">{key.algorithm}</span>
              <StatusBadge
                label={key.status}
                tone={key.status === "active" ? "success" : "neutral"}
              />
              <Button asChild size="compact" variant="ghost">
                <a href={`/.well-known/jwks.json#${key.kid}`} rel="noreferrer" target="_blank">
                  View Public Key
                </a>
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          description="Rotate a signing key to create the first key for this workspace."
          headingLevel="h3"
          icon={KeyRound}
          title="No Signing Keys"
        />
      )}
      <Button asChild variant="ghost">
        <a href="/.well-known/jwks.json" rel="noreferrer" target="_blank">
          View JWKS
        </a>
      </Button>
    </SettingsSection>
  );
}
