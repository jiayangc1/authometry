"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Github } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, EmptyState, GoogleIcon, StatusBadge } from "@authometry/ui";
import { ErrorState, ListSkeleton } from "@/components/data-display/states";
import { SettingsSection } from "@/components/settings/settings-section";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { apiFetch } from "@/lib/api";

type SocialProvider = "google" | "github";

interface MeResponse {
  user: { id: string; name: string; email: string };
}

interface Connection {
  provider: SocialProvider;
  configured: boolean;
  linked: boolean;
  email: string | null;
  createdAt: string | null;
}

const providerDetails = {
  google: { label: "Google", Icon: GoogleIcon },
  github: { label: "GitHub", Icon: Github },
} as const;

export default function AccountSettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [disconnectingProvider, setDisconnectingProvider] = useState<SocialProvider>();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<MeResponse>("/api/v1/auth/me"),
  });
  const connections = useQuery({
    queryKey: ["account-connections"],
    queryFn: () => apiFetch<{ data: Connection[] }>("/api/v1/auth/connections"),
  });
  const connect = useMutation({
    mutationFn: (provider: SocialProvider) =>
      apiFetch<{ authorizationUrl: string }>(`/api/v1/auth/connections/${provider}`, {
        method: "POST",
      }),
    onSuccess: ({ authorizationUrl }) => window.location.assign(authorizationUrl),
    onError: (error) => toast.error(error.message),
  });
  const disconnect = useMutation({
    mutationFn: (provider: SocialProvider) =>
      apiFetch(`/api/v1/auth/connections/${provider}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["account-connections"] });
      toast.success("Social account disconnected.");
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    const linked = searchParams.get("linked");
    if (linked === "google" || linked === "github") {
      toast.success(`${providerDetails[linked].label} connected.`);
      void queryClient.invalidateQueries({ queryKey: ["account-connections"] });
      router.replace("/settings/account");
    }
  }, [queryClient, router, searchParams]);

  return (
    <>
      <SettingsSection
        description="Your dashboard profile and sign-in identity."
        footer={
          <Button asChild size="compact">
            <Link href="/forgot-password">Change password</Link>
          </Button>
        }
        footerHint="Password changes are confirmed by email."
        title="My account"
      >
        {me.isLoading ? (
          <ListSkeleton rows={2} />
        ) : me.isError ? (
          <ErrorState
            description="Authometry could not load your account. Check your connection, then retry."
            headingLevel="h3"
            onRetry={() => void me.refetch()}
            title="Unable to load your account"
          />
        ) : (
          <div className="flex items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--geist-blue-700)] to-[var(--geist-purple-700)] text-sm font-semibold text-white">
              {(me.data?.user.name ?? "A")
                .split(/\s+/)
                .map((part) => part[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{me.data?.user.name ?? "—"}</p>
              <p className="truncate text-[13px] text-[var(--text-secondary)]">
                {me.data?.user.email ?? "—"}
              </p>
            </div>
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        description="Connect a provider once, then sign in to this same dashboard account with either your password or that provider."
        title="Social sign-in"
      >
        {connections.isLoading ? (
          <ListSkeleton rows={2} />
        ) : connections.isError ? (
          <ErrorState
            description="Authometry could not load connected accounts. Check your connection, then retry."
            headingLevel="h3"
            onRetry={() => void connections.refetch()}
            title="Unable to load social sign-in"
          />
        ) : connections.data?.data.length ? (
          <ul className="divide-y divide-[var(--border)] rounded-[var(--radius-control)] border border-[var(--border)]">
            {connections.data.data.map((connection) => {
              const { label, Icon } = providerDetails[connection.provider];
              const connecting = connect.isPending && connect.variables === connection.provider;
              return (
                <li
                  className="flex min-h-14 items-center gap-3 px-3 py-2.5"
                  key={connection.provider}
                >
                  <span className="flex size-8 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-raised)]">
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-[13px] font-medium">
                      {label}
                      {connection.linked && <StatusBadge label="Connected" tone="success" />}
                    </p>
                    <p className="truncate text-xs text-[var(--text-secondary)]">
                      {connection.linked
                        ? connection.email || "Connected"
                        : connection.configured
                          ? "Not connected"
                          : "Not configured on this instance"}
                    </p>
                  </div>
                  {connection.linked ? (
                    <Button
                      onClick={() => setDisconnectingProvider(connection.provider)}
                      size="compact"
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      disabled={!connection.configured}
                      loading={connecting}
                      onClick={() => connect.mutate(connection.provider)}
                      size="compact"
                      variant="primary"
                    >
                      Connect
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            description="Configure a social provider to connect it to your dashboard account."
            headingLevel="h3"
            title="No social providers"
          />
        )}
      </SettingsSection>
      <ConfirmDialog
        actionLabel="Disconnect"
        description="You can’t use this provider to sign in until you reconnect it."
        onConfirm={() =>
          disconnectingProvider ? disconnect.mutateAsync(disconnectingProvider) : undefined
        }
        onOpenChange={(open) => {
          if (!open) setDisconnectingProvider(undefined);
        }}
        open={Boolean(disconnectingProvider)}
        pendingLabel="Disconnecting…"
        title={
          disconnectingProvider
            ? `Disconnect ${providerDetails[disconnectingProvider].label}?`
            : "Disconnect account?"
        }
        tone="neutral"
      />
    </>
  );
}
