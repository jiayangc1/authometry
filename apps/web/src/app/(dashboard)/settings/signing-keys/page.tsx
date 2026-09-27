"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, KeyRound, RotateCw } from "lucide-react";
import { useState } from "react";
import { Button, EmptyState, StatusBadge } from "@authometry/ui";
import { RelativeTime } from "@/components/data-display/formatted-time";
import { ErrorState, ListSkeleton } from "@/components/data-display/states";
import { SettingsSection } from "@/components/settings/settings-section";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { apiFetch } from "@/lib/api";
import { humanize } from "@/lib/status";
import { useActiveEnvironment } from "@/lib/use-environment";
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
  const [confirmingRotation, setConfirmingRotation] = useState(false);
  const { active } = useActiveEnvironment();
  const query = useQuery({
    queryKey: ["signing-keys"],
    queryFn: () => apiFetch<{ data: SigningKey[] }>("/api/v1/settings/signing-keys"),
  });
  const rotate = useMutation({
    mutationFn: () => apiFetch("/api/v1/settings/signing-keys/rotate", { method: "POST" }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["signing-keys"] });
      toast.success("Signing key rotated.");
    },
    onError: (error) => toast.error(error.message),
  });
  const jwksUrl = `${active?.issuer ?? ""}/.well-known/jwks.json`;
  return (
    <>
      <SettingsSection
        description="Keys that sign access tokens and ID tokens. Private key material is never displayed."
        footer={
          <>
            <Button asChild size="compact" variant="ghost">
              <a href={jwksUrl} rel="noreferrer" target="_blank">
                View JWKS <ExternalLink aria-hidden="true" className="size-3" />
              </a>
            </Button>
            <Button
              className="[&:hover_svg]:rotate-90"
              loading={rotate.isPending}
              onClick={() => setConfirmingRotation(true)}
              size="compact"
            >
              {!rotate.isPending && <RotateCw aria-hidden="true" className="size-3.5" />} Rotate key
            </Button>
          </>
        }
        footerHint="Rotate after a suspected compromise or on a regular schedule."
        title="Signing keys"
      >
        {query.isLoading ? (
          <ListSkeleton rows={2} />
        ) : query.isError ? (
          <ErrorState
            description="Authometry could not load signing keys. Check your connection, then retry."
            headingLevel="h3"
            onRetry={() => void query.refetch()}
            title="Unable to load signing keys"
          />
        ) : query.data?.data.length ? (
          <ul className="divide-y divide-[var(--border)] rounded-[var(--radius-control)] border border-[var(--border)]">
            {query.data.data.map((key) => (
              <li className="flex min-h-14 items-center gap-3 px-3 py-2.5" key={key.id}>
                <KeyRound
                  aria-hidden="true"
                  className="size-4 shrink-0 text-[var(--text-secondary)]"
                />
                <div className="min-w-0 flex-1">
                  <p className="technical-value truncate font-medium text-[var(--text-primary)]">
                    {key.kid}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    <span className="technical-value">{key.algorithm}</span> · Created{" "}
                    <RelativeTime value={key.created_at} />
                    {key.retires_at && (
                      <>
                        {" "}
                        · Retires <RelativeTime value={key.retires_at} />
                      </>
                    )}
                  </p>
                </div>
                <StatusBadge
                  label={humanize(key.status)}
                  tone={key.status === "active" ? "success" : "neutral"}
                />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            description="Rotate to create the first signing key for this environment."
            headingLevel="h3"
            icon={KeyRound}
            title="No signing keys"
          />
        )}
      </SettingsSection>
      <ConfirmDialog
        actionLabel="Rotate key"
        description="A new active signing key is created. Existing keys keep verifying tokens until they retire."
        onConfirm={() => rotate.mutateAsync()}
        onOpenChange={setConfirmingRotation}
        open={confirmingRotation}
        pendingLabel="Rotating…"
        title="Rotate the active signing key?"
        tone="neutral"
      />
    </>
  );
}
