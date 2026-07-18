"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { redirectUriSchema } from "@authometry/domain";
import { Button } from "@authometry/ui";
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
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (application) {
      setName(application.name);
      setDescription(application.description ?? "");
      setUris(application.redirect_uris);
    }
  }, [application]);
  const dirty = Boolean(
    application &&
    (name !== application.name ||
      description !== (application.description ?? "") ||
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
    setSaving(true);
    try {
      await apiFetch(`/api/v1/applications/${app.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          description: description || null,
          redirectUris: uris,
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
            {error} Check the URI and try again.
          </p>
        )}
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
