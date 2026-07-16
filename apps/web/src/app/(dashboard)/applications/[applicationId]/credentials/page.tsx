"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { KeyRound, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Checkbox, StatusBadge } from "@authometry/ui";
import { useApplication } from "@/components/applications/application-context";
import { CopyableValue } from "@/components/data-display/copyable-value";
import { SectionHeader } from "@/components/layout/page";
import { inputClass } from "@/components/auth/auth-shell";
import { apiFetch } from "@/lib/api";
import { relativeTime } from "@/lib/format";

export default function CredentialsPage() {
  const { application, refetch } = useApplication();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Deployment secret");
  const [secret, setSecret] = useState<string>();
  const [stored, setStored] = useState(false);
  if (!application) return null;
  const app = application;
  async function create() {
    const result = await apiFetch<{ secret: string }>(
      `/api/v1/applications/${app.id}/credentials`,
      { method: "POST", body: JSON.stringify({ name, expiresInDays: 90 }) },
    );
    setSecret(result.secret);
    await refetch();
    toast.success("Client secret created.");
  }
  async function revoke(id: string) {
    await apiFetch(`/api/v1/applications/${app.id}/credentials/${id}/revoke`, { method: "POST" });
    await refetch();
    toast.success("Client secret revoked.");
  }
  return (
    <div className="space-y-8">
      <section>
        <SectionHeader
          description="Public identifier used by this OAuth client."
          title="Client authentication"
        />
        <div className="grid max-w-3xl items-center gap-1 border-y border-[var(--border)] py-3 sm:grid-cols-[180px_1fr]">
          <span className="text-xs text-[var(--text-secondary)]">Client ID</span>
          <CopyableValue value={application.client_id} />
        </div>
      </section>
      <section className="border-t border-[var(--border)] pt-7">
        <SectionHeader
          actions={
            <Button disabled={application.ownership === "manifest"} onClick={() => setOpen(true)}>
              <Plus className="size-3.5" /> Create secret
            </Button>
          }
          description="Secrets authenticate confidential clients at the token endpoint."
          title="Client secrets"
        />
        <div className="border-y border-[var(--border)]">
          {application.credentials.map((credential) => (
            <div
              className="grid min-h-16 items-center gap-2 border-b border-[var(--border-subtle)] px-2 py-3 last:border-0 sm:grid-cols-[1fr_170px_120px_auto]"
              key={credential.id}
            >
              <div>
                <p className="text-[13px] font-medium">{credential.name}</p>
                <code className="technical-value text-[var(--text-tertiary)]">
                  {credential.prefix}••••••••
                </code>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Created {relativeTime(credential.created_at)}
              </p>
              <StatusBadge
                label={credential.revoked_at ? "Revoked" : "Active"}
                tone={credential.revoked_at ? "neutral" : "success"}
              />
              <Button
                disabled={Boolean(credential.revoked_at)}
                onClick={() => void revoke(credential.id)}
                size="compact"
                variant="ghost"
              >
                Revoke
              </Button>
            </div>
          ))}
        </div>
      </section>
      <Dialog.Root
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) {
            setSecret(undefined);
            setStored(false);
          }
        }}
        open={open}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-24px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] p-5 shadow-xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <Dialog.Title className="text-base font-semibold">
                  Create client secret
                </Dialog.Title>
                <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
                  The value is shown once.
                </p>
              </div>
              <Dialog.Close asChild>
                <Button aria-label="Close" size="icon" variant="ghost">
                  <X className="size-4" />
                </Button>
              </Dialog.Close>
            </div>
            {secret ? (
              <div className="mt-5">
                <div className="border border-[var(--warning-border)] bg-[var(--warning-soft)] p-3 text-xs leading-5 text-[var(--text-secondary)]">
                  Store this secret securely before continuing. Authometry cannot show it again.
                </div>
                <div className="technical-value mt-3 rounded border border-[var(--border)] bg-[var(--surface)] p-3 break-all select-all">
                  {secret}
                </div>
                <label className="mt-4 flex gap-2 text-[13px]">
                  <Checkbox
                    checked={stored}
                    onChange={(event) => setStored(event.target.checked)}
                  />
                  I have stored this client secret securely.
                </label>
                <Dialog.Close asChild>
                  <Button className="mt-5 w-full" disabled={!stored} variant="primary">
                    Done
                  </Button>
                </Dialog.Close>
              </div>
            ) : (
              <div className="mt-5">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium">Name</span>
                  <input
                    className={inputClass}
                    onChange={(event) => setName(event.target.value)}
                    value={name}
                  />
                </label>
                <Button className="mt-5 w-full" onClick={() => void create()} variant="primary">
                  <KeyRound className="size-3.5" /> Create secret
                </Button>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
