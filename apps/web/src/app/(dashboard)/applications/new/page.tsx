"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AppWindow, Check, MonitorSmartphone, Server, Smartphone, Workflow } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ComponentType } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { createApplicationSlug, redirectUriSchema } from "@authometry/domain";
import { Button, cn } from "@authometry/ui";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { inputClass } from "@/components/auth/auth-shell";
import { apiFetch } from "@/lib/api";

const schema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().max(500).optional(),
  redirectUri: z.string().optional(),
});
type Values = z.infer<typeof schema>;
type ApplicationType = "web" | "spa" | "native" | "machine" | "device";
const types: Array<{
  value: ApplicationType;
  name: string;
  description: string;
  examples: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  {
    value: "web",
    name: "Web application",
    description: "Server-rendered application capable of storing a client secret.",
    examples: "Next.js, Rails, Django",
    icon: AppWindow,
  },
  {
    value: "spa",
    name: "Single-page application",
    description: "Browser application using Authorization Code with PKCE.",
    examples: "React, Vue, Svelte",
    icon: MonitorSmartphone,
  },
  {
    value: "native",
    name: "Native application",
    description: "Installed mobile or desktop application using system browser authorization.",
    examples: "iOS, Android, macOS",
    icon: Smartphone,
  },
  {
    value: "machine",
    name: "Machine-to-machine",
    description: "Service using client credentials without an interactive user.",
    examples: "Internal API, worker",
    icon: Server,
  },
  {
    value: "device",
    name: "Device application",
    description: "Input-constrained device using Device Authorization Grant.",
    examples: "TV, CLI, console",
    icon: Workflow,
  },
];

export default function NewApplicationPage() {
  const router = useRouter();
  const [type, setType] = useState<ApplicationType>("web");
  const [secret, setSecret] = useState<{ id: string; clientId: string; clientSecret: string }>();
  const [acknowledged, setAcknowledged] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", slug: "", description: "", redirectUri: "" },
  });
  async function submit(values: Values) {
    if (type !== "machine" && values.redirectUri) {
      const uri = redirectUriSchema.safeParse(values.redirectUri);
      if (!uri.success) {
        form.setError("redirectUri", {
          message: uri.error.issues[0]?.message ?? "Enter a valid redirect URI.",
        });
        return;
      }
    }
    const result = await apiFetch<{ id: string; clientId: string; clientSecret?: string }>(
      "/api/v1/applications",
      {
        method: "POST",
        body: JSON.stringify({
          name: values.name,
          slug: values.slug,
          type,
          description: values.description || undefined,
          redirectUris: values.redirectUri ? [values.redirectUri] : [],
          postLogoutRedirectUris: [],
        }),
      },
    );
    toast.success("Application created.");
    if (result.clientSecret)
      setSecret({ id: result.id, clientId: result.clientId, clientSecret: result.clientSecret });
    else router.push(`/applications/${result.id}`);
  }
  if (secret)
    return (
      <PageContainer size="narrow">
        <PageHeader
          description="Store this client secret before continuing."
          title="Client secret created"
        />
        <div className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] p-5">
          <p className="text-[13px] font-medium text-[var(--warning)]">
            This secret will only be displayed once.
          </p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Store it securely. Authometry cannot show it again after this screen closes.
          </p>
          <dl className="mt-5 space-y-4">
            <div>
              <dt className="text-xs text-[var(--text-secondary)]">Client ID</dt>
              <dd className="technical-value mt-1 rounded border border-[var(--border)] bg-[var(--surface-raised)] p-2.5">
                {secret.clientId}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-secondary)]">Client secret</dt>
              <dd className="technical-value mt-1 rounded border border-[var(--border)] bg-[var(--surface-raised)] p-2.5 select-all">
                {secret.clientSecret}
              </dd>
            </div>
          </dl>
        </div>
        <label className="mt-5 flex items-start gap-2.5 text-[13px]">
          <input
            className="mt-1"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            type="checkbox"
          />
          I have stored this client secret securely.
        </label>
        <Button
          className="mt-5"
          disabled={!acknowledged}
          onClick={() => router.push(`/applications/${secret.id}`)}
          variant="primary"
        >
          Done
        </Button>
      </PageContainer>
    );
  return (
    <PageContainer size="narrow">
      <PageHeader
        description="Configure a new OAuth client for your application."
        title="Create application"
      />
      <form onSubmit={form.handleSubmit(submit)}>
        <fieldset>
          <legend className="mb-3 text-sm font-semibold">Application type</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {types.map((item) => {
              const Icon = item.icon;
              const selected = item.value === type;
              return (
                <button
                  className={cn(
                    "relative min-h-32 rounded-lg border p-4 text-left transition-colors hover:border-[var(--border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none",
                    selected && "border-[var(--accent)] bg-[var(--accent-soft)]",
                  )}
                  key={item.value}
                  onClick={() => setType(item.value)}
                  type="button"
                >
                  <span className="mb-3 flex items-center justify-between">
                    <Icon className="size-4 text-[var(--text-secondary)]" />
                    {selected && <Check className="size-4 text-[var(--accent)]" />}
                  </span>
                  <span className="block text-[13px] font-semibold">{item.name}</span>
                  <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                    {item.description}
                  </span>
                  <span className="mt-2 block text-[10px] text-[var(--text-tertiary)]">
                    {item.examples}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="mt-8 space-y-5 border-t border-[var(--border)] pt-7">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium">Application name</span>
            <input
              className={inputClass}
              {...form.register("name", {
                onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                  form.setValue("slug", createApplicationSlug(event.target.value), {
                    shouldValidate: true,
                  }),
              })}
            />
            {form.formState.errors.name && (
              <span className="mt-1 block text-xs text-[var(--danger)]">
                {form.formState.errors.name.message}
              </span>
            )}
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium">Application ID</span>
            <input className={`${inputClass} technical-value`} {...form.register("slug")} />
            {form.formState.errors.slug && (
              <span className="mt-1 block text-xs text-[var(--danger)]">
                Use lowercase letters, numbers, and hyphens.
              </span>
            )}
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium">
              Description <span className="font-normal text-[var(--text-tertiary)]">Optional</span>
            </span>
            <textarea className={`${inputClass} h-20 py-2`} {...form.register("description")} />
          </label>
          {type !== "machine" && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium">Redirect URI</span>
              <input
                className={`${inputClass} technical-value`}
                placeholder="http://localhost:3000/auth/callback"
                {...form.register("redirectUri")}
              />
              {form.formState.errors.redirectUri && (
                <span className="mt-1 block text-xs text-[var(--danger)]">
                  {form.formState.errors.redirectUri.message}
                </span>
              )}
            </label>
          )}
        </div>
        <div className="mt-7 flex justify-end gap-2 border-t border-[var(--border)] pt-5">
          <Button onClick={() => router.back()} type="button">
            Cancel
          </Button>
          <Button disabled={form.formState.isSubmitting} type="submit" variant="primary">
            {form.formState.isSubmitting ? "Creating…" : "Create application"}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}
