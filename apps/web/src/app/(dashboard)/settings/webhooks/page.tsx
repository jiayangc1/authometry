"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RadioTower } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Checkbox, Note, StatusBadge } from "@authometry/ui";
import { Snippet } from "@/components/data-display/copyable-value";
import { ErrorState, ListSkeleton } from "@/components/data-display/states";
import { SettingsSection } from "@/components/settings/settings-section";
import { Modal } from "@/components/ui/dialog";
import { ChoiceRow, Field, Input } from "@/components/ui/form";
import { apiFetch } from "@/lib/api";
import { humanize } from "@/lib/status";

interface Webhook {
  id: string;
  name: string;
  url: string;
  status: string;
  subscribed_events?: string[];
}

const eventOptions = [
  { value: "authorization.completed", description: "A sign-in or token request finished." },
  { value: "security.alert", description: "Suspicious or blocked activity was detected." },
  { value: "configuration.applied", description: "A manifest was applied from Git." },
  { value: "user.updated", description: "A user was created, changed, or deleted." },
];

export default function WebhooksPage() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState<string>();
  const [events, setEvents] = useState(eventOptions.map((event) => event.value));
  const query = useQuery({
    queryKey: ["webhooks"],
    queryFn: () => apiFetch<{ data: Webhook[] }>("/api/v1/settings/webhooks"),
  });
  const add = useMutation({
    mutationFn: (input: { name: string; url: string }) =>
      apiFetch<{ secret: string }>("/api/v1/settings/webhooks", {
        method: "POST",
        body: JSON.stringify({ ...input, subscribedEvents: events }),
      }),
    onSuccess: async (result) => {
      setSecret(result.secret);
      await client.invalidateQueries({ queryKey: ["webhooks"] });
      toast.success("Webhook created.");
    },
    onError: (error) => toast.error(error.message),
  });
  function close() {
    setOpen(false);
    setSecret(undefined);
    setEvents(eventOptions.map((event) => event.value));
  }
  return (
    <>
      <SettingsSection
        description="Send signed authorization, configuration, security, and user events to your own services."
        footer={
          <Button onClick={() => setOpen(true)} size="compact" variant="primary">
            <Plus aria-hidden="true" className="size-3.5" /> Add webhook
          </Button>
        }
        footerHint="Each delivery is signed with the webhook’s secret."
        title="Webhooks"
      >
        {query.isLoading ? (
          <ListSkeleton rows={2} />
        ) : query.isError ? (
          <ErrorState
            description="Authometry could not load webhooks. Check your connection, then retry."
            headingLevel="h3"
            onRetry={() => void query.refetch()}
            title="Unable to load webhooks"
          />
        ) : query.data?.data.length ? (
          <ul className="divide-y divide-[var(--border)] rounded-[var(--radius-control)] border border-[var(--border)]">
            {query.data.data.map((webhook) => (
              <li className="flex min-h-14 items-center gap-3 px-3 py-2.5" key={webhook.id}>
                <RadioTower
                  aria-hidden="true"
                  className="size-4 shrink-0 text-[var(--text-secondary)]"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{webhook.name}</p>
                  <p className="technical-value truncate text-[var(--text-tertiary)]">
                    {webhook.url}
                  </p>
                  {webhook.subscribed_events?.length ? (
                    <p className="truncate text-xs text-[var(--text-secondary)]">
                      {webhook.subscribed_events.join(" · ")}
                    </p>
                  ) : null}
                </div>
                <StatusBadge
                  label={humanize(webhook.status)}
                  tone={webhook.status === "enabled" ? "success" : "neutral"}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-[var(--radius-control)] border border-dashed border-[var(--border-strong)] px-4 py-6 text-center text-[13px] text-[var(--text-secondary)]">
            No webhooks yet.
          </p>
        )}
      </SettingsSection>
      <Modal
        description={
          secret
            ? "Use this secret to verify delivery signatures. It won’t be shown again."
            : "Authometry sends a signed POST request for each selected event."
        }
        footer={
          secret ? (
            <Button onClick={close} variant="primary">
              Done
            </Button>
          ) : (
            <>
              <Button disabled={add.isPending} onClick={close}>
                Cancel
              </Button>
              <Button
                disabled={!events.length}
                form="create-webhook-form"
                loading={add.isPending}
                type="submit"
                variant="primary"
              >
                Create webhook
              </Button>
            </>
          )
        }
        onOpenChange={(next) => (next ? setOpen(true) : close())}
        open={open}
        preventClose={add.isPending}
        title={secret ? "Webhook signing secret" : "Add webhook"}
      >
        {secret ? (
          <div className="space-y-3">
            <Note tone="warning">Copy this secret now.</Note>
            <Snippet label="signing secret" value={secret} />
          </div>
        ) : (
          <form
            autoComplete="off"
            className="space-y-4"
            id="create-webhook-form"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              add.mutate({
                name: String(data.get("name") ?? "").trim(),
                url: String(data.get("url") ?? "").trim(),
              });
            }}
          >
            <Field label="Name">
              <Input autoFocus minLength={2} name="name" placeholder="Security alerts" required />
            </Field>
            <Field description="Must be a public HTTPS URL." label="Endpoint">
              <Input
                mono
                name="url"
                placeholder="https://example.com/webhooks/authometry"
                required
                type="url"
              />
            </Field>
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium">Events</legend>
              <div className="space-y-1">
                {eventOptions.map((option) => (
                  <ChoiceRow
                    control={
                      <Checkbox
                        checked={events.includes(option.value)}
                        onChange={(event) =>
                          setEvents(
                            event.target.checked
                              ? [...events, option.value]
                              : events.filter((value) => value !== option.value),
                          )
                        }
                      />
                    }
                    description={option.description}
                    key={option.value}
                    title={
                      <code className="technical-value text-[var(--text-primary)]">
                        {option.value}
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
