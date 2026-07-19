"use client";

import { ExternalLink, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { redirectUriSchema } from "@authometry/domain";
import { Button, Checkbox, StatusBadge } from "@authometry/ui";
import { useApplication } from "@/components/applications/application-context";
import { inputClass } from "@/components/auth/auth-shell";
import { DividerSection, SectionHeader } from "@/components/layout/page";
import { apiFetch } from "@/lib/api";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";

export default function ConfigurationPage() {
  const { application, refetch } = useApplication();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [uris, setUris] = useState<string[]>([]);
  const [nextUri, setNextUri] = useState("");
  const [portalEnabled, setPortalEnabled] = useState(false);
  const [launchUri, setLaunchUri] = useState("");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (application) {
      setName(application.name);
      setDescription(application.description ?? "");
      setUris(application.redirect_uris);
      setPortalEnabled(application.portal_enabled);
      setLaunchUri(application.launch_uri ?? "");
    }
  }, [application]);
  const dirty = Boolean(
    application &&
    (name !== application.name ||
      description !== (application.description ?? "") ||
      portalEnabled !== application.portal_enabled ||
      launchUri !== (application.launch_uri ?? "") ||
      JSON.stringify(uris) !== JSON.stringify(application.redirect_uris)),
  );
  useUnsavedChanges(dirty);
  if (!application) return null;
  const app = application;
  const readOnly = app.ownership === "manifest";
  function addUri() {
    const parsed = redirectUriSchema.safeParse(nextUri);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    if (uris.includes(nextUri)) {
      setError("This redirect URI is already registered.");
      return;
    }
    setUris([...uris, nextUri]);
    setNextUri("");
    setError(undefined);
  }
  async function save() {
    if (portalEnabled && !launchUri) {
      setError("Add the application's sign-in URL before enabling portal access.");
      return;
    }
    if (launchUri) {
      const parsed = redirectUriSchema.safeParse(launchUri);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message);
        return;
      }
    }
    setSaving(true);
    try {
      await apiFetch(`/api/v1/applications/${app.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          description: description || null,
          redirectUris: uris,
          portalEnabled,
          launchUri: launchUri || null,
          version: app.version,
        }),
      });
      await refetch();
      toast.success("Application configuration saved.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="space-y-8">
      <section>
        <SectionHeader
          description="Displayed in administration interfaces and consent screens."
          title="Application Details"
        />
        <div className="max-w-2xl space-y-5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium">Name</span>
            <input
              autoComplete="off"
              className={inputClass}
              disabled={readOnly}
              name="applicationName"
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium">Description</span>
            <textarea
              autoComplete="off"
              className={`${inputClass} h-20 py-2`}
              disabled={readOnly}
              name="applicationDescription"
              onChange={(event) => setDescription(event.target.value)}
              value={description}
            />
          </label>
        </div>
      </section>
      <DividerSection>
        <SectionHeader
          description="Authometry requires exact redirect URI matching. Wildcards are not supported."
          title="Redirect URIs"
        />
        <div className="max-w-3xl border-y border-[var(--border)]">
          {uris.map((uri) => (
            <div
              className="flex min-h-11 items-center gap-2 border-b border-[var(--border-subtle)] px-2 last:border-0"
              key={uri}
            >
              <code className="technical-value flex-1">{uri}</code>
              <Button
                aria-label={`Remove ${uri}`}
                disabled={readOnly}
                onClick={() => setUris(uris.filter((value) => value !== uri))}
                size="icon"
                variant="ghost"
              >
                <Trash2 aria-hidden="true" className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
        {!readOnly && (
          <div className="mt-3 flex max-w-3xl gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">New redirect URI</span>
              <input
                autoComplete="off"
                className={`${inputClass} technical-value flex-1`}
                name="redirectUri"
                onChange={(event) => setNextUri(event.target.value)}
                placeholder="https://example.com/auth/callback…"
                spellCheck={false}
                type="url"
                value={nextUri}
              />
            </label>
            <Button onClick={addUri}>
              <Plus aria-hidden="true" className="size-3.5" /> Add URI
            </Button>
          </div>
        )}
        {error && (
          <p aria-live="polite" className="mt-2 text-xs text-[var(--danger)]" role="alert">
            {error}
          </p>
        )}
      </DividerSection>
      <DividerSection>
        <SectionHeader
          description="Publish this service to assigned employees and send them through its normal OIDC sign-in flow."
          title="Employee Portal"
        />
        <div className="max-w-3xl overflow-hidden rounded-lg border border-[var(--border)]">
          <label className="flex cursor-pointer items-start gap-3 bg-[var(--surface-subtle)] px-4 py-3.5">
            <Checkbox
              checked={portalEnabled}
              className="mt-0.5"
              disabled={readOnly}
              onChange={(event) => setPortalEnabled(event.target.checked)}
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2 text-[13px] font-medium">
                Show this application in the employee portal
                <StatusBadge
                  label={
                    app.provisioning_enabled ? "Provisioning connected" : "Provisioning required"
                  }
                  tone={app.provisioning_enabled ? "success" : "warning"}
                />
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                Only assigned users can see it. Launching stays unavailable until this environment
                has an active provisioning connection.
              </span>
            </span>
          </label>
          <div className="border-t border-[var(--border)] px-4 py-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium">Application sign-in URL</span>
              <div className="relative">
                <input
                  autoComplete="url"
                  className={`${inputClass} technical-value pr-9`}
                  disabled={readOnly}
                  name="launchUri"
                  onChange={(event) => {
                    setLaunchUri(event.target.value);
                    setError(undefined);
                  }}
                  placeholder="https://app.example.com/login"
                  spellCheck={false}
                  type="url"
                  value={launchUri}
                />
                <ExternalLink
                  aria-hidden="true"
                  className="absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-[var(--text-tertiary)]"
                />
              </div>
            </label>
            <div className="mt-3 flex items-start gap-2 border-l-2 border-[var(--accent)] pl-3 text-xs leading-5 text-[var(--text-secondary)]">
              <ShieldCheck
                aria-hidden="true"
                className="mt-0.5 size-3.5 shrink-0 text-[var(--accent)]"
              />
              Use the service's OIDC login-initiation URL. It will redirect back to Authometry,
              where the employee's existing portal session completes sign-in without another
              password.
            </div>
          </div>
        </div>
      </DividerSection>
      <DividerSection>
        <SectionHeader
          description="Secure defaults reduce the chance of protocol downgrade or token leakage."
          title="OAuth Security"
        />
        <dl className="max-w-3xl divide-y divide-[var(--border-subtle)] border-y border-[var(--border)]">
          {[
            ["Authorization Code", "Enabled"],
            ["PKCE", application.require_pkce ? "Required" : "Optional"],
            ["Implicit grant", "Unavailable"],
            ["Password grant", "Unavailable"],
            ["Refresh-token rotation", application.rotate_refresh_tokens ? "Enabled" : "Disabled"],
          ].map(([label, value]) => (
            <div className="flex items-center justify-between py-3" key={label}>
              <dt className="text-[13px]">{label}</dt>
              <dd className="text-xs text-[var(--text-secondary)]">{value}</dd>
            </div>
          ))}
        </dl>
      </DividerSection>
      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-2 border-t border-[var(--border)] bg-[color:var(--background)/.96] px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <span className="mr-auto text-xs text-[var(--text-tertiary)]">
          {dirty ? "Unsaved changes" : "No unsaved changes"}
        </span>
        <Button
          disabled={!dirty || saving || readOnly}
          onClick={() => void save()}
          variant="primary"
        >
          {saving ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
