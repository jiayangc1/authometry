"use client";

import { KeyRound, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Checkbox, EmptyState, Note, StatusBadge } from "@authometry/ui";
import { useApplication } from "@/components/applications/application-context";
import { Snippet } from "@/components/data-display/copyable-value";
import { RelativeTime } from "@/components/data-display/formatted-time";
import { DescriptionList, SectionHeader } from "@/components/layout/page";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { Modal } from "@/components/ui/dialog";
import { ChoiceRow, Field, Input, Select } from "@/components/ui/form";
import { Table, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/api";

const publicTypes = new Set(["spa", "native", "device"]);

export default function CredentialsPage() {
  const { application, refetch } = useApplication();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Deployment secret");
  const [expiresInDays, setExpiresInDays] = useState("90");
  const [secret, setSecret] = useState<string>();
  const [stored, setStored] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string>();
  const [revoking, setRevoking] = useState<string>();
  const [now] = useState(() => Date.now());
  if (!application) return null;
  const app = application;
  const readOnly = app.ownership === "manifest";
  async function create() {
    setCreating(true);
    setCreateError(undefined);
    try {
      const result = await apiFetch<{ secret: string }>(
        `/api/v1/applications/${app.id}/credentials`,
        {
          method: "POST",
          body: JSON.stringify({ name: name.trim(), expiresInDays: Number(expiresInDays) }),
        },
      );
      setSecret(result.secret);
      await refetch();
      toast.success("Client secret created.");
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "The secret could not be created.");
    } finally {
      setCreating(false);
    }
  }
  async function revoke(id: string) {
    try {
      await apiFetch(`/api/v1/applications/${app.id}/credentials/${id}/revoke`, { method: "POST" });
      await refetch();
      toast.success("Client secret revoked.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "The client secret could not be revoked.",
      );
      throw error;
    }
  }
  function closeCreate(value: boolean) {
    setOpen(value);
    if (!value) {
      setSecret(undefined);
      setStored(false);
      setCreateError(undefined);
      setName("Deployment secret");
    }
  }
  const active = application.credentials.filter((credential) => !credential.revoked_at);
  return (
    <div className="space-y-10">
      <section>
        <SectionHeader
          description="The public identifier your application sends with every request."
          title="Client ID"
        />
        <DescriptionList
          items={[
            [
              "Client ID",
              <Snippet
                className="max-w-xl"
                key="id"
                label="client ID"
                value={application.client_id}
              />,
            ],
            [
              "Authentication",
              publicTypes.has(application.type)
                ? "Public client — uses PKCE, no secret"
                : "Confidential client — client secret",
            ],
          ]}
        />
      </section>
      <section>
        <SectionHeader
          actions={
            <Button disabled={readOnly} onClick={() => setOpen(true)}>
              <Plus aria-hidden="true" className="size-3.5" /> Create secret
            </Button>
          }
          description={`Secrets authenticate confidential clients at the token endpoint. ${active.length} active.`}
          title="Client secrets"
        />
        {publicTypes.has(application.type) && (
          <Note className="mb-4" tone="info">
            This is a public client. Browsers and installed apps cannot keep secrets, so they
            authenticate with PKCE instead.
          </Note>
        )}
        {application.credentials.length ? (
          <Table columns="minmax(180px,1fr) 150px 150px 100px 90px" label="Client secrets">
            <TableHeader>
              <span>Name</span>
              <span>Created</span>
              <span>Expires</span>
              <span>Status</span>
              <span />
            </TableHeader>
            {application.credentials.map((credential) => {
              const expired =
                credential.expires_at && new Date(credential.expires_at).getTime() < now;
              return (
                <TableRow key={credential.id} mobileColumns="minmax(0,1fr) auto">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">{credential.name}</p>
                    <code className="technical-value text-[var(--text-tertiary)]">
                      {credential.prefix}••••••••
                    </code>
                  </div>
                  <span className="hidden text-[13px] text-[var(--text-secondary)] lg:block">
                    <RelativeTime value={credential.created_at} />
                  </span>
                  <span className="hidden text-[13px] text-[var(--text-secondary)] lg:block">
                    {credential.expires_at ? (
                      <RelativeTime value={credential.expires_at} />
                    ) : (
                      "Never"
                    )}
                  </span>
                  <span className="hidden lg:block">
                    <StatusBadge
                      label={credential.revoked_at ? "Revoked" : expired ? "Expired" : "Active"}
                      tone={credential.revoked_at || expired ? "neutral" : "success"}
                    />
                  </span>
                  <span className="flex justify-end">
                    {!credential.revoked_at && !readOnly ? (
                      <Button
                        className="hover:text-[var(--danger)]"
                        onClick={() => setRevoking(credential.id)}
                        size="compact"
                        variant="ghost"
                      >
                        Revoke
                      </Button>
                    ) : (
                      <span className="text-xs text-[var(--text-tertiary)] lg:hidden">Revoked</span>
                    )}
                  </span>
                </TableRow>
              );
            })}
          </Table>
        ) : (
          <EmptyState
            description="Create a client secret for a confidential server-side deployment."
            headingLevel="h3"
            icon={KeyRound}
            primaryAction={
              readOnly ? undefined : (
                <Button onClick={() => setOpen(true)} variant="primary">
                  Create secret
                </Button>
              )
            }
            title="No client secrets"
          />
        )}
      </section>
      <ConfirmDialog
        actionLabel="Revoke secret"
        description="Deployments using this secret will fail to authenticate immediately."
        onConfirm={() => (revoking ? revoke(revoking) : undefined)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setRevoking(undefined);
        }}
        open={Boolean(revoking)}
        pendingLabel="Revoking…"
        title="Revoke this client secret?"
      />
      <Modal
        description={
          secret
            ? "Copy it now — Authometry stores only a hash and cannot show it again."
            : "Give the secret a name so you can recognize it later."
        }
        footer={
          secret ? (
            <Button disabled={!stored} onClick={() => closeCreate(false)} variant="primary">
              Done
            </Button>
          ) : (
            <>
              <Button disabled={creating} onClick={() => closeCreate(false)}>
                Cancel
              </Button>
              <Button
                disabled={!name.trim()}
                form="create-secret-form"
                loading={creating}
                type="submit"
                variant="primary"
              >
                {creating ? "Creating…" : "Create secret"}
              </Button>
            </>
          )
        }
        onOpenChange={closeCreate}
        open={open}
        preventClose={creating || Boolean(secret && !stored)}
        title={secret ? "Save your client secret" : "Create client secret"}
      >
        {secret ? (
          <div className="space-y-4">
            <Snippet label="client secret" value={secret} />
            <ChoiceRow
              control={
                <Checkbox checked={stored} onChange={(event) => setStored(event.target.checked)} />
              }
              title="I have stored this client secret securely"
            />
          </div>
        ) : (
          <form
            className="space-y-4"
            id="create-secret-form"
            onSubmit={(event) => {
              event.preventDefault();
              void create();
            }}
          >
            <Field label="Name">
              <Input
                autoComplete="off"
                autoFocus
                maxLength={100}
                name="credentialName"
                onChange={(event) => setName(event.target.value)}
                value={name}
              />
            </Field>
            <Field description="Rotate secrets before they expire." label="Expires in">
              <Select
                onChange={(event) => setExpiresInDays(event.target.value)}
                value={expiresInDays}
              >
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="180">180 days</option>
                <option value="365">1 year</option>
              </Select>
            </Field>
            {createError && (
              <Note role="alert" tone="danger">
                {createError}
              </Note>
            )}
          </form>
        )}
      </Modal>
    </div>
  );
}
