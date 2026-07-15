"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RadioTower } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, EmptyState, StatusBadge } from "@authometry/ui";
import { inputClass } from "@/components/auth/auth-shell";
import { SettingsSection } from "@/components/settings/settings-section";
import { apiFetch } from "@/lib/api";

interface Webhook {
  id: string;
  name: string;
  url: string;
  status: string;
}
export default function WebhooksPage() {
  const client = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [secret, setSecret] = useState<string>();
  const query = useQuery({
    queryKey: ["webhooks"],
    queryFn: () => apiFetch<{ data: Webhook[] }>("/api/v1/settings/webhooks"),
  });
  const add = useMutation({
    mutationFn: (input: { name: string; url: string }) =>
      apiFetch<{ secret: string }>("/api/v1/settings/webhooks", {
        method: "POST",
        body: JSON.stringify({
          ...input,
          subscribedEvents: [
            "authorization.completed",
            "security.alert",
            "configuration.applied",
            "user.updated",
          ],
        }),
      }),
    onSuccess: async (result) => {
      setSecret(result.secret);
      setAdding(false);
      await client.invalidateQueries({ queryKey: ["webhooks"] });
      toast.success("Webhook created");
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <SettingsSection
      description="Send signed authorization, configuration, security, and user events to another service."
      title="Webhooks"
    >
      <div className="flex justify-end">
        <Button onClick={() => setAdding((value) => !value)}>
          <Plus className="size-3.5" /> Add webhook
        </Button>
      </div>
      {adding && (
        <form
          className="grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const name = data.get("name");
            const url = data.get("url");
            if (typeof name === "string" && typeof url === "string") add.mutate({ name, url });
          }}
        >
          <label>
            <span className="mb-1.5 block text-xs font-medium">Name</span>
            <input className={inputClass} name="name" required />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium">HTTPS endpoint</span>
            <input
              className={inputClass}
              name="url"
              placeholder="https://example.com/authometry"
              required
              type="url"
            />
          </label>
          <Button
            className="justify-self-end"
            disabled={add.isPending}
            type="submit"
            variant="primary"
          >
            Create webhook
          </Button>
        </form>
      )}
      {secret && (
        <div className="border border-[var(--warning-border)] bg-[var(--warning-soft)] p-3">
          <p className="text-xs font-semibold">Copy the signing secret now</p>
          <code className="technical-value mt-2 block break-all select-all">{secret}</code>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">
            It will not be displayed again.
          </p>
        </div>
      )}
      {query.data?.data.length ? (
        <div className="border-y border-[var(--border)]">
          {query.data.data.map((webhook) => (
            <div
              className="grid min-h-16 grid-cols-[28px_1fr_auto] items-center gap-3 border-b border-[var(--border-subtle)] px-2 last:border-0"
              key={webhook.id}
            >
              <RadioTower className="size-4 text-[var(--text-secondary)]" />
              <div className="min-w-0">
                <p className="text-[13px] font-medium">{webhook.name}</p>
                <p className="technical-value truncate text-[var(--text-tertiary)]">
                  {webhook.url}
                </p>
              </div>
              <StatusBadge
                label={webhook.status}
                tone={webhook.status === "enabled" ? "success" : "neutral"}
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          description="Add a webhook to receive signed Authometry events."
          icon={RadioTower}
          title="No webhooks"
        />
      )}
    </SettingsSection>
  );
}
