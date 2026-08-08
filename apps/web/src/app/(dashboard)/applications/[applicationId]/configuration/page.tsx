"use client";

import {
  Check,
  ChevronDown,
  ExternalLink,
  Globe2,
  ImageIcon,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { applicationLogoUriSchema, redirectUriSchema } from "@authometry/domain";
import { Button, Checkbox, StatusBadge } from "@authometry/ui";
import { useApplication } from "@/components/applications/application-context";
import { inputClass } from "@/components/auth/auth-shell";
import { apiFetch } from "@/lib/api";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";

export default function ConfigurationPage() {
  const { application, refetch } = useApplication();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUri, setLogoUri] = useState("");
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
      setLogoUri(application.logo_uri ?? "");
      setUris(application.redirect_uris);
      setPortalEnabled(application.portal_enabled);
      setLaunchUri(application.launch_uri ?? "");
    }
  }, [application]);
  const dirty = Boolean(
    application &&
    (name !== application.name ||
      description !== (application.description ?? "") ||
      logoUri !== (application.logo_uri ?? "") ||
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
    if (logoUri) {
      const parsed = applicationLogoUriSchema.safeParse(logoUri);
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
          logoUri: logoUri || null,
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
  const securitySettings = [
    ["Authorization Code", "Enabled"],
    ["PKCE", application.require_pkce ? "Required" : "Optional"],
    ["Implicit grant", "Unavailable"],
    ["Password grant", "Unavailable"],
    ["Refresh-token rotation", application.rotate_refresh_tokens ? "Enabled" : "Disabled"],
  ];
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold tracking-[-0.02em]">Configure sign-in</h2>
        <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
          Set the app details people see and where Authometry can return them after sign-in.
        </p>
      </div>

      {error && (
        <div
          aria-live="polite"
          className="mb-4 rounded-lg border border-[var(--danger-border)] bg-[var(--danger-soft)] px-3.5 py-2.5 text-[13px] text-[var(--danger)]"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]">
            <div className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4">
              <div className="flex size-8 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
                <ImageIcon aria-hidden="true" className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">App identity</h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Shown to users during sign-in.
                </p>
              </div>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">App name</span>
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
                <span className="mb-1.5 block text-xs font-medium">Logo URL</span>
                <input
                  autoComplete="url"
                  className={`${inputClass} technical-value`}
                  disabled={readOnly}
                  name="logoUri"
                  onChange={(event) => {
                    setLogoUri(event.target.value);
                    setError(undefined);
                  }}
                  placeholder="https://cdn.example.com/logo.png"
                  spellCheck={false}
                  type="url"
                  value={logoUri}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs font-medium">Description</span>
                <input
                  autoComplete="off"
                  className={inputClass}
                  disabled={readOnly}
                  name="applicationDescription"
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What does this application do?"
                  value={description}
                />
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]">
            <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--info-soft)] text-[var(--info)]">
                  <Globe2 aria-hidden="true" className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Callback URLs</h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Exact destinations allowed after sign-in.
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">
                {uris.length} {uris.length === 1 ? "URL" : "URLs"}
              </span>
            </div>
            <div className="p-5">
              <div className="overflow-hidden rounded-lg border border-[var(--border)]">
                {uris.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-[var(--text-secondary)]">
                    Add a callback URL to test sign-in.
                  </div>
                ) : (
                  uris.map((uri) => (
                    <div
                      className="flex min-h-12 items-center gap-3 border-b border-[var(--border-subtle)] px-3 last:border-0"
                      key={uri}
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--success-soft)] text-[var(--success)]">
                        <Check aria-hidden="true" className="size-3" />
                      </span>
                      <code className="technical-value min-w-0 flex-1">{uri}</code>
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
                  ))
                )}
              </div>
              {!readOnly && (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <label className="min-w-0 flex-1">
                    <span className="sr-only">New callback URL</span>
                    <input
                      autoComplete="off"
                      className={`${inputClass} technical-value`}
                      name="redirectUri"
                      onChange={(event) => {
                        setNextUri(event.target.value);
                        setError(undefined);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addUri();
                        }
                      }}
                      placeholder="https://app.example.com/auth/callback"
                      spellCheck={false}
                      type="url"
                      value={nextUri}
                    />
                  </label>
                  <Button disabled={!nextUri.trim()} onClick={addUri}>
                    <Plus aria-hidden="true" className="size-3.5" /> Add callback
                  </Button>
                </div>
              )}
              <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
                URLs must match exactly. Wildcards are not supported.
              </p>
            </div>
          </section>

          <details className="group rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
              <ShieldCheck aria-hidden="true" className="size-4 text-[var(--success)]" />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium">OAuth protections</span>
                <span className="block text-xs text-[var(--text-secondary)]">
                  Authorization Code · PKCE {application.require_pkce ? "required" : "optional"} ·
                  Rotation {application.rotate_refresh_tokens ? "enabled" : "disabled"}
                </span>
              </span>
              <ChevronDown
                aria-hidden="true"
                className="size-4 text-[var(--text-tertiary)] transition-transform group-open:rotate-180"
              />
            </summary>
            <dl className="grid gap-px border-t border-[var(--border)] bg-[var(--border-subtle)] sm:grid-cols-2">
              {securitySettings.map(([label, value]) => (
                <div
                  className="flex items-center justify-between bg-[var(--surface-raised)] px-4 py-3"
                  key={label}
                >
                  <dt className="text-xs text-[var(--text-secondary)]">{label}</dt>
                  <dd className="text-xs font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </details>
        </div>

        <aside className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] lg:sticky lg:top-6">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Employee portal</h3>
              <StatusBadge
                label={app.provisioning_enabled ? "Connected" : "Needs setup"}
                tone={app.provisioning_enabled ? "success" : "warning"}
              />
            </div>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Let assigned employees launch this app with SSO.
            </p>
          </div>
          <div className="p-5">
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-3.5">
              <Checkbox
                checked={portalEnabled}
                className="mt-0.5"
                disabled={readOnly}
                onChange={(event) => {
                  setPortalEnabled(event.target.checked);
                  setError(undefined);
                }}
              />
              <span>
                <span className="block text-[13px] font-medium">Show in employee portal</span>
                <span className="mt-0.5 block text-xs leading-5 text-[var(--text-secondary)]">
                  Visible only to assigned users.
                </span>
              </span>
            </label>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs font-medium">App sign-in URL</span>
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
            <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
              Use the URL that starts this app&apos;s Authometry sign-in.
            </p>
            {!app.provisioning_enabled && portalEnabled && (
              <div className="mt-4 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] p-3 text-xs leading-5 text-[var(--warning)]">
                Connect provisioning before employees can launch this app.
              </div>
            )}
          </div>
        </aside>
      </div>

      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-2 border-t border-[var(--border)] bg-[color:var(--background)/.96] px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <span className="mr-auto text-xs text-[var(--text-tertiary)]">
          {dirty ? "Unsaved changes" : "No unsaved changes"}
        </span>
        <Button
          disabled={!dirty || saving || readOnly}
          onClick={() => void save()}
          variant="primary"
        >
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
