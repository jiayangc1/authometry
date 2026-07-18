"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Github } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { Button, EmptyState, GoogleIcon, StatusBadge } from "@authometry/ui";
import { ErrorState, PageSkeleton } from "@/components/data-display/states";
import { SettingsSection } from "@/components/settings/settings-section";
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
      toast.success("Social account disconnected");
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    const linked = searchParams.get("linked");
    if (linked === "google" || linked === "github") {
      toast.success(`${providerDetails[linked].label} connected`);
      void queryClient.invalidateQueries({ queryKey: ["account-connections"] });
      router.replace("/settings/account");
    }
  }, [queryClient, router, searchParams]);

  return (
    <div>
      <SettingsSection
        description="Your dashboard profile and local sign-in identity."
        title="My Account"
      >
        {me.isLoading ? (
          <PageSkeleton rows={3} />
        ) : me.isError ? (
          <ErrorState
            description="Authometry could not load your account. Check your connection, then retry."
            headingLevel="h3"
            onRetry={() => void me.refetch()}
            title="Unable to Load Your Account"
          />
        ) : (
          <dl className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border)]">
            <div className="grid gap-1 py-3 sm:grid-cols-[140px_1fr]">
              <dt className="text-xs text-[var(--text-secondary)]">Name</dt>
              <dd className="text-[13px]">{me.data?.user.name ?? "—"}</dd>
            </div>
            <div className="grid gap-1 py-3 sm:grid-cols-[140px_1fr]">
              <dt className="text-xs text-[var(--text-secondary)]">Email</dt>
              <dd className="text-[13px]">{me.data?.user.email ?? "—"}</dd>
            </div>
            <div className="grid gap-1 py-3 sm:grid-cols-[140px_1fr]">
              <dt className="text-xs text-[var(--text-secondary)]">Password sign-in</dt>
              <dd>
                <StatusBadge label="Enabled" tone="success" />
              </dd>
            </div>
          </dl>
        )}
      </SettingsSection>

      <SettingsSection
        description="Connect a provider once, then use either your password or that provider to reach this same dashboard account."
        title="Social Sign-In"
      >
        {connections.isLoading ? (
          <PageSkeleton rows={2} />
        ) : connections.isError ? (
          <ErrorState
            description="Authometry could not load connected accounts. Check your connection, then retry."
            headingLevel="h3"
            onRetry={() => void connections.refetch()}
            title="Unable to Load Social Sign-In"
          />
        ) : connections.data?.data.length ? (
          <div className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border)]">
            {connections.data.data.map((connection) => {
              const { label, Icon } = providerDetails[connection.provider];
              const pending =
                (connect.isPending && connect.variables === connection.provider) ||
                (disconnect.isPending && disconnect.variables === connection.provider);
              return (
                <div className="flex min-h-16 items-center gap-3 py-3" key={connection.provider}>
                  <div className="flex size-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-raised)]">
                    <Icon aria-hidden="true" className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium">{label}</p>
                    <p className="truncate text-xs text-[var(--text-secondary)]">
                      {connection.linked
                        ? connection.email || "Connected"
                        : connection.configured
                          ? "Not connected"
                          : "Provider is not configured"}
                    </p>
                  </div>
                  {connection.linked ? (
                    <Button
                      disabled={pending}
                      onClick={() => {
                        if (window.confirm(`Disconnect ${label}? You can reconnect it later.`)) {
                          disconnect.mutate(connection.provider);
                        }
                      }}
                    >
                      {pending ? "Disconnecting…" : "Disconnect"}
                    </Button>
                  ) : (
                    <Button
                      disabled={!connection.configured || pending}
                      onClick={() => connect.mutate(connection.provider)}
                      variant="primary"
                    >
                      {pending ? "Connecting…" : "Connect"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            description="Configure a social provider to connect it to your dashboard account."
            headingLevel="h3"
            title="No Social Providers"
          />
        )}
      </SettingsSection>
    </div>
  );
}
