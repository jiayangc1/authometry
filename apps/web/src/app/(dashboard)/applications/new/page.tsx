"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AppWindow, Check, MonitorSmartphone, Server, Smartphone, Workflow } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ComponentType } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
  applicationLaunchUriSchema,
  applicationLogoUriSchema,
  createApplicationSlug,
  redirectUriSchema,
} from "@authometry/domain";
import { Button, Checkbox, Note, cn } from "@authometry/ui";
import { CodeBlock, Snippet } from "@/components/data-display/copyable-value";
import { Breadcrumbs, PageContainer, PageHeader } from "@/components/layout/page";
import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { ChoiceRow, Field, Input, Textarea } from "@/components/ui/form";
import { apiFetch } from "@/lib/api";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Use at least 2 characters.")
    .max(100, "Use 100 characters or fewer."),
  slug: z
    .string()
    .min(1, "Enter an application ID.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens."),
  description: z.string().max(500, "Use 500 characters or fewer.").optional(),
  logoUri: z.union([z.literal(""), applicationLogoUriSchema]),
  redirectUri: z.string().optional(),
  launchUri: z.union([z.literal(""), applicationLaunchUriSchema]),
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
  const [slugEdited, setSlugEdited] = useState(false);
  const [secret, setSecret] = useState<{ id: string; clientId: string; clientSecret: string }>();
  const [acknowledged, setAcknowledged] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      logoUri: "",
      redirectUri: "",
      launchUri: "",
    },
  });
  const errors = form.formState.errors;
  useUnsavedChanges(form.formState.isDirty && !secret);
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
    try {
      const result = await apiFetch<{ id: string; clientId: string; clientSecret?: string }>(
        "/api/v1/applications",
        {
          method: "POST",
          body: JSON.stringify({
            name: values.name,
            slug: values.slug,
            type,
            description: values.description || undefined,
            logoUri: values.logoUri || undefined,
            redirectUris: type !== "machine" && values.redirectUri ? [values.redirectUri] : [],
            postLogoutRedirectUris: [],
            launchUri: (type !== "machine" && values.launchUri) || undefined,
          }),
        },
      );
      toast.success(`${values.name} created.`);
      if (result.clientSecret)
        setSecret({ id: result.id, clientId: result.clientId, clientSecret: result.clientSecret });
      else router.push(`/applications/${result.id}`);
    } catch (error) {
      form.setError("root", {
        message: error instanceof Error ? error.message : "The application could not be created.",
      });
    }
  }
  if (secret)
    return (
      <PageContainer size="narrow">
        <PageHeader
          description="Copy the client secret now — Authometry stores only a hash and cannot show it again."
          title="Save your client secret"
        />
        <Card className="overflow-hidden">
          <div className="space-y-4 p-5">
            <Note tone="warning">
              This secret is shown only once. Store it in your secret manager.
            </Note>
            <Field label="Client ID">
              <Snippet label="client ID" value={secret.clientId} />
            </Field>
            <Field label="Client secret">
              <Snippet label="client secret" value={secret.clientSecret} />
            </Field>
            <CodeBlock
              code={`AUTHOMETRY_CLIENT_ID=${secret.clientId}\nAUTHOMETRY_CLIENT_SECRET=${secret.clientSecret}`}
              label=".env"
            />
          </div>
          <CardFooter
            hint={
              <ChoiceRow
                control={
                  <Checkbox
                    checked={acknowledged}
                    onChange={(event) => setAcknowledged(event.target.checked)}
                  />
                }
                title="I have stored this client secret securely"
              />
            }
          >
            <Button
              disabled={!acknowledged}
              onClick={() => router.push(`/applications/${secret.id}`)}
              variant="primary"
            >
              Continue to application
            </Button>
          </CardFooter>
        </Card>
      </PageContainer>
    );
  return (
    <PageContainer size="narrow">
      <Breadcrumbs items={[{ label: "Applications", href: "/applications" }, { label: "New" }]} />
      <PageHeader
        description="Register a website, app, or service so it can sign users in with Authometry."
        title="Create application"
      />
      <form
        autoComplete="off"
        className="space-y-6"
        noValidate
        onSubmit={form.handleSubmit(submit)}
      >
        <fieldset>
          <legend className="mb-3 text-sm font-semibold">What are you building?</legend>
          <div className="stagger grid gap-2 sm:grid-cols-2" role="radiogroup">
            {types.map((item) => {
              const Icon = item.icon;
              const selected = item.value === type;
              return (
                <label
                  className={cn(
                    "group relative flex cursor-pointer gap-3 rounded-[var(--radius-card)] border bg-[var(--surface-raised)] p-3.5 transition-[border-color,box-shadow,background-color,transform] duration-[var(--motion-fast)] ease-[var(--ease-out)] active:scale-[0.99] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--focus)]",
                    selected
                      ? "border-[var(--text-primary)] shadow-[0_0_0_1px_var(--text-primary)]"
                      : "border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-subtle)]",
                  )}
                  key={item.value}
                >
                  <input
                    checked={selected}
                    className="sr-only"
                    name="applicationType"
                    onChange={() => setType(item.value)}
                    type="radio"
                    value={item.value}
                  />
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] border transition-colors",
                      selected
                        ? "border-transparent bg-[var(--primary)] text-[var(--primary-foreground)]"
                        : "border-[var(--border)] text-[var(--text-secondary)]",
                    )}
                  >
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium">{item.name}</span>
                    <span className="mt-0.5 block text-xs leading-[18px] text-[var(--text-secondary)]">
                      {item.description}
                    </span>
                    <span className="technical-value mt-1.5 block text-[11px] text-[var(--text-tertiary)]">
                      {item.examples}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute top-3 right-3 flex size-4 items-center justify-center rounded-full border transition-all duration-[var(--motion-normal)] ease-[var(--ease-spring)]",
                      selected
                        ? "scale-100 border-transparent bg-[var(--primary)] text-[var(--primary-foreground)]"
                        : "scale-90 border-[var(--border-strong)]",
                    )}
                  >
                    {selected && <Check className="size-2.5" strokeWidth={3} />}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <Card>
          <CardHeader description="Shown to people when they sign in." title="Details" />
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <Field error={errors.name?.message} label="Name">
              <Input
                autoComplete="off"
                placeholder="Acme Dashboard"
                {...form.register("name", {
                  onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                    if (!slugEdited)
                      form.setValue("slug", createApplicationSlug(event.target.value), {
                        shouldValidate: form.formState.isSubmitted,
                      });
                  },
                })}
              />
            </Field>
            <Field
              description="Used in URLs and manifests. Lowercase letters, numbers, and hyphens."
              error={errors.slug?.message}
              label="Application ID"
            >
              <Input
                autoComplete="off"
                mono
                spellCheck={false}
                {...form.register("slug", { onChange: () => setSlugEdited(true) })}
              />
            </Field>
            <Field className="sm:col-span-2" label="Description" optional>
              <Textarea
                autoComplete="off"
                className="min-h-20"
                placeholder="What does this application do?"
                {...form.register("description")}
              />
            </Field>
            <Field
              className="sm:col-span-2"
              error={errors.logoUri?.message}
              label="Logo URL"
              optional
            >
              <Input
                autoComplete="url"
                mono
                placeholder="https://cdn.example.com/logo.png"
                spellCheck={false}
                type="url"
                {...form.register("logoUri")}
              />
            </Field>
          </div>
        </Card>
        {type !== "machine" && (
          <Card className="animate-enter">
            <CardHeader
              description="Where Authometry may send people after they sign in."
              title="Sign-in"
            />
            <div className="space-y-4 p-4 sm:p-5">
              <Field
                description="Must match exactly. You can add more callback URLs later."
                error={errors.redirectUri?.message}
                label="Callback URL"
                optional
              >
                <Input
                  autoComplete="off"
                  mono
                  placeholder="https://your-app.example/auth/callback"
                  spellCheck={false}
                  type="url"
                  {...form.register("redirectUri")}
                />
              </Field>
              <Field
                description="Used by the employee portal. Defaults to /login on the callback host."
                error={errors.launchUri?.message}
                label="Portal sign-in URL"
                optional
              >
                <Input
                  autoComplete="url"
                  mono
                  placeholder="https://your-app.example/login"
                  spellCheck={false}
                  type="url"
                  {...form.register("launchUri")}
                />
              </Field>
            </div>
          </Card>
        )}
        {errors.root?.message && (
          <Note role="alert" tone="danger">
            {errors.root.message}
          </Note>
        )}
        <div className="flex flex-col-reverse gap-2 border-t border-[var(--border)] pt-5 sm:flex-row sm:justify-end">
          <Button asChild>
            <Link href="/applications">Cancel</Link>
          </Button>
          <Button loading={form.formState.isSubmitting} type="submit" variant="primary">
            {form.formState.isSubmitting ? "Creating…" : "Create application"}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}
