"use client";

import { ChevronDown, Globe2, Plus, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { applicationLogoUriSchema, redirectUriSchema } from "@authometry/domain";
import { Button, Note, StatusBadge, Switch, cn } from "@authometry/ui";
import { useApplication } from "@/components/applications/application-context";
import { Card, CardHeader } from "@/components/ui/card";
import { ChoiceRow, Field, Input, Textarea } from "@/components/ui/form";
import { apiFetch } from "@/lib/api";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";

type ErrorField = "name" | "logoUri" | "redirectUri" | "launchUri" | "postLogoutUris";

function lines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function ConfigurationPage() {
  const { application, refetch } = useApplication();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUri, setLogoUri] = useState("");
  const [uris, setUris] = useState<string[]>([]);
  const [nextUri, setNextUri] = useState("");
  const [portalEnabled, setPortalEnabled] = useState(false);
  const [launchUri, setLaunchUri] = useState("");
  const [requireConsent, setRequireConsent] = useState(true);
  const [postLogoutUris, setPostLogoutUris] = useState("");
  const [error, setErrorMessage] = useState<string>();
  const [errorField, setErrorField] = useState<ErrorField>();
  const [saving, setSaving] = useState(false);
  function setError(message: string | undefined, field?: ErrorField) {
    setErrorMessage(message);
    setErrorField(message ? field : undefined);
  }
  useEffect(() => {
    if (application) {
      setName(application.name);
      setDescription(application.description ?? "");
      setLogoUri(application.logo_uri ?? "");
      setUris(application.redirect_uris);
      setPortalEnabled(application.portal_enabled);
      setLaunchUri(application.launch_uri ?? "");
      setRequireConsent(application.require_consent);
      setPostLogoutUris(application.post_logout_redirect_uris.join("\n"));
    }
  }, [application]);
  const dirty = Boolean(
    application &&
    (name !== application.name ||
      description !== (application.description ?? "") ||
      logoUri !== (application.logo_uri ?? "") ||
      portalEnabled !== application.portal_enabled ||
      launchUri !== (application.launch_uri ?? "") ||
      requireConsent !== application.require_consent ||
      JSON.stringify(lines(postLogoutUris)) !==
        JSON.stringify(application.post_logout_redirect_uris) ||
      nextUri.trim() !== "" ||
      JSON.stringify(uris) !== JSON.stringify(application.redirect_uris)),
  );
  useUnsavedChanges(dirty);
  if (!application) return null;
  const app = application;
  const readOnly = app.ownership === "manifest";
  function addUri() {
    const candidate = nextUri.trim();
    const parsed = redirectUriSchema.safeParse(candidate);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message, "redirectUri");
      return;
    }
    if (uris.includes(candidate)) {
      setError("This callback URL is already registered.", "redirectUri");
      return;
    }
    setUris([...uris, candidate]);
    setNextUri("");
    setError(undefined);
  }
  async function save() {
    if (name.trim().length < 2) {
      setError("Use at least 2 characters for the name.", "name");
      return;
    }
    // A callback URL typed but never added would otherwise be dropped without a word.
    let nextUris = uris;
    const pendingUri = nextUri.trim();
    if (pendingUri) {
      const parsed = redirectUriSchema.safeParse(pendingUri);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message, "redirectUri");
        return;
      }
      if (!uris.includes(pendingUri)) nextUris = [...uris, pendingUri];
    }
    if (portalEnabled && !launchUri) {
      setError("Add the application's sign-in URL before enabling portal access.", "launchUri");
      return;
    }
    if (launchUri) {
      const parsed = redirectUriSchema.safeParse(launchUri);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message, "launchUri");
        return;
      }
    }
    if (logoUri) {
      const parsed = applicationLogoUriSchema.safeParse(logoUri);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message, "logoUri");
        return;
      }
    }
    const nextPostLogoutUris = [...new Set(lines(postLogoutUris))];
    for (const uri of nextPostLogoutUris) {
      const parsed = redirectUriSchema.safeParse(uri);
      if (!parsed.success) {
        setError(
          `${uri}: ${parsed.error.issues[0]?.message ?? "Enter a valid URL."}`,
          "postLogoutUris",
        );
        return;
      }
    }
    setError(undefined);
    setSaving(true);
    try {
      await apiFetch(`/api/v1/applications/${app.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          description: description || null,
          logoUri: logoUri || null,
          redirectUris: nextUris,
          postLogoutRedirectUris: nextPostLogoutUris,
          requireConsent,
          portalEnabled,
          launchUri: launchUri || null,
          version: app.version,
        }),
      });
      setNextUri("");
      await refetch();
      toast.success("Configuration saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The configuration could not be saved.");
    } finally {
      setSaving(false);
    }
  }
  function reset() {
    setName(app.name);
    setDescription(app.description ?? "");
    setLogoUri(app.logo_uri ?? "");
    setUris(app.redirect_uris);
    setNextUri("");
    setPortalEnabled(app.portal_enabled);
    setLaunchUri(app.launch_uri ?? "");
    setRequireConsent(app.require_consent);
    setPostLogoutUris(app.post_logout_redirect_uris.join("\n"));
    setError(undefined);
  }
  const fieldError = (field: ErrorField) => (errorField === field ? error : undefined);
  const securitySettings = [
    ["Authorization Code", "Enabled"],
    ["PKCE", application.require_pkce ? "Required" : "Optional"],
    ["Implicit grant", "Unavailable"],
    ["Password grant", "Unavailable"],
    ["Refresh-token rotation", application.rotate_refresh_tokens ? "Enabled" : "Disabled"],
  ];
  return (
    <div className="pb-4">
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <Card>
            <CardHeader
              description="Shown to people during sign-in and in the employee portal."
              title="Identity"
            />
            <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
              <Field error={fieldError("name")} label="Name">
                <Input
                  autoComplete="off"
                  disabled={readOnly}
                  name="applicationName"
                  onChange={(event) => {
                    setName(event.target.value);
                    setError(undefined);
                  }}
                  value={name}
                />
              </Field>
              <Field error={fieldError("logoUri")} label="Logo URL" optional>
                <Input
                  autoComplete="url"
                  disabled={readOnly}
                  mono
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
              </Field>
              <Field className="sm:col-span-2" label="Description" optional>
                <Input
                  autoComplete="off"
                  disabled={readOnly}
                  name="applicationDescription"
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What does this application do?"
                  value={description}
                />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader
              actions={
                <span className="rounded-full bg-[var(--geist-gray-100)] px-2 py-0.5 text-xs text-[var(--text-secondary)] tabular-nums">
                  {uris.length} {uris.length === 1 ? "URL" : "URLs"}
                </span>
              }
              description="Exact destinations Authometry may redirect to after sign-in. Wildcards are not supported."
              title="Callback URLs"
            />
            <div className="p-4 sm:p-5">
              <ul className="overflow-hidden rounded-[var(--radius-control)] border border-[var(--border)]">
                {uris.length === 0 ? (
                  <li className="px-4 py-6 text-center text-[13px] text-[var(--text-secondary)]">
                    Add a callback URL so people can sign in.
                  </li>
                ) : (
                  uris.map((uri) => (
                    <li
                      className="group flex min-h-11 animate-[enter_var(--motion-normal)_var(--ease-out)] items-center gap-3 border-b border-[var(--border)] pr-1 pl-3 last:border-0"
                      key={uri}
                    >
                      <Globe2
                        aria-hidden="true"
                        className="size-3.5 shrink-0 text-[var(--text-tertiary)]"
                      />
                      <code className="technical-value min-w-0 flex-1">{uri}</code>
                      {!readOnly && (
                        <Button
                          aria-label={`Remove ${uri}`}
                          className="hover:text-[var(--danger)]"
                          onClick={() => setUris(uris.filter((value) => value !== uri))}
                          size="icon-compact"
                          variant="ghost"
                        >
                          <X aria-hidden="true" className="size-3.5" />
                        </Button>
                      )}
                    </li>
                  ))
                )}
              </ul>
              {!readOnly && (
                <form
                  className="mt-3 flex flex-col gap-2 sm:flex-row"
                  onSubmit={(event) => {
                    event.preventDefault();
                    addUri();
                  }}
                >
                  <label className="min-w-0 flex-1">
                    <span className="sr-only">New callback URL</span>
                    <Input
                      autoComplete="off"
                      compact
                      mono
                      name="redirectUri"
                      onChange={(event) => {
                        setNextUri(event.target.value);
                        setError(undefined);
                      }}
                      placeholder="https://app.example.com/auth/callback"
                      spellCheck={false}
                      type="url"
                      value={nextUri}
                    />
                  </label>
                  <Button disabled={!nextUri.trim()} type="submit">
                    <Plus aria-hidden="true" className="size-3.5" /> Add
                  </Button>
                </form>
              )}
              {fieldError("redirectUri") && (
                <p className="mt-1.5 text-xs leading-[18px] text-[var(--danger)]" role="alert">
                  {fieldError("redirectUri")}
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              description="What people see before access is granted, and where they may land after signing out."
              title="Consent and sign-out"
            />
            <div className="space-y-4 p-4 sm:p-5">
              <ChoiceRow
                control={
                  <Switch
                    checked={requireConsent}
                    disabled={readOnly}
                    onChange={(event) => {
                      setRequireConsent(event.target.checked);
                      setError(undefined);
                    }}
                  />
                }
                description="Ask people to review the requested permissions before this application gets access."
                title="Require consent"
              />
              <Field
                description="One URL per line. Authometry only redirects to these after sign-out."
                error={fieldError("postLogoutUris")}
                label="Post-logout redirect URLs"
                optional
              >
                <Textarea
                  autoComplete="off"
                  className="min-h-20"
                  disabled={readOnly}
                  mono
                  name="postLogoutRedirectUris"
                  onChange={(event) => {
                    setPostLogoutUris(event.target.value);
                    setError(undefined);
                  }}
                  placeholder="https://app.example.com/signed-out"
                  spellCheck={false}
                  value={postLogoutUris}
                />
              </Field>
            </div>
          </Card>

          <details className="group rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-raised)]">
            <summary className="flex cursor-pointer list-none items-center gap-3 rounded-[var(--radius-card)] px-4 py-3.5 transition-colors hover:bg-[var(--surface-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none sm:px-5 [&::-webkit-details-marker]:hidden">
              <ShieldCheck aria-hidden="true" className="size-4 text-[var(--success)]" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">OAuth protections</span>
                <span className="block text-[13px] text-[var(--text-secondary)]">
                  Authorization Code · PKCE {application.require_pkce ? "required" : "optional"} ·
                  Rotation {application.rotate_refresh_tokens ? "enabled" : "disabled"}
                </span>
              </span>
              <ChevronDown
                aria-hidden="true"
                className="size-4 text-[var(--text-tertiary)] transition-transform duration-[var(--motion-normal)] ease-[var(--ease-out)] group-open:rotate-180"
              />
            </summary>
            <dl className="grid animate-[fade-in_var(--motion-normal)_var(--ease-out)] gap-px border-t border-[var(--border)] bg-[var(--border)] sm:grid-cols-2">
              {securitySettings.map(([label, value]) => (
                <div
                  className="flex items-center justify-between bg-[var(--surface-raised)] px-4 py-3 last:rounded-b-[var(--radius-card)] sm:px-5"
                  key={label}
                >
                  <dt className="text-[13px] text-[var(--text-secondary)]">{label}</dt>
                  <dd className="text-[13px] font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </details>
        </div>

        <Card className="lg:sticky lg:top-6">
          <CardHeader
            actions={
              <StatusBadge
                label={app.provisioning_enabled ? "Connected" : "Needs setup"}
                tone={app.provisioning_enabled ? "success" : "warning"}
              />
            }
            description="Let assigned people launch this app with single sign-on."
            title="Employee portal"
          />
          <div className="space-y-4 p-4 sm:p-5">
            <ChoiceRow
              control={
                <Switch
                  checked={portalEnabled}
                  disabled={readOnly}
                  onChange={(event) => {
                    setPortalEnabled(event.target.checked);
                    setError(undefined);
                  }}
                />
              }
              description="Visible only to assigned users."
              title="Show in employee portal"
            />
            <Field
              description="The URL that starts this app’s Authometry sign-in."
              error={fieldError("launchUri")}
              label="App sign-in URL"
            >
              <Input
                autoComplete="url"
                disabled={readOnly}
                mono
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
            </Field>
            {!app.provisioning_enabled && portalEnabled && (
              <Note tone="warning">
                Connect provisioning in <Link href="/settings/provisioning">Settings</Link> before
                people can launch this app.
              </Note>
            )}
          </div>
        </Card>
      </div>

      {!readOnly && (
        <div
          className={cn(
            "sticky bottom-4 z-10 mt-6 flex items-center gap-3 rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface-raised)] py-2 pr-2 pl-4 shadow-[var(--shadow-menu)] transition-[opacity,transform] duration-[var(--motion-normal)] ease-[var(--ease-out)]",
            dirty || error
              ? "translate-y-0 opacity-100"
              : "pointer-events-none translate-y-2 opacity-0",
          )}
          role="region"
          aria-label="Save changes"
          inert={!(dirty || error)}
        >
          <span
            aria-live="polite"
            className={cn(
              "mr-auto min-w-0 text-[13px]",
              error ? "text-[var(--danger)]" : "text-[var(--text-secondary)]",
            )}
          >
            {error ?? "You have unsaved changes."}
          </span>
          <Button disabled={saving} onClick={reset} variant="ghost">
            Reset
          </Button>
          <Button disabled={!dirty} loading={saving} onClick={() => void save()} variant="primary">
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      )}
    </div>
  );
}
