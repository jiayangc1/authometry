import { notFound } from "next/navigation";
import { AlertTriangle, AppWindow, CheckCircle2, Info, Plus, type LucideIcon } from "lucide-react";
import { AuthometryProviderButton, Button, EmptyState, StatusBadge } from "@authometry/ui";
import { inputClass } from "@/components/auth/auth-shell";
import { PageContainer, PageHeader, SectionHeader } from "@/components/layout/page";

export default function ComponentShowcasePage() {
  if (process.env.NODE_ENV === "production") notFound();
  const alerts: Array<[LucideIcon, string, string, string]> = [
    [CheckCircle2, "var(--success-soft)", "var(--success-border)", "Configuration applied"],
    [AlertTriangle, "var(--warning-soft)", "var(--warning-border)", "Issuer change pending"],
    [Info, "var(--info-soft)", "var(--info-border)", "Managed by Git"],
  ];
  return (
    <PageContainer>
      <PageHeader
        description="Internal development route for visual-system states and regression checks."
        title="Component showcase"
      />
      <div className="space-y-10">
        <section>
          <SectionHeader title="Buttons" />
          <div className="flex flex-wrap gap-2">
            <Button variant="primary">
              <Plus className="size-3.5" /> Primary
            </Button>
            <Button>Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button disabled>Disabled</Button>
          </div>
        </section>
        <section className="border-t border-[var(--border)] pt-7">
          <SectionHeader
            description="Branded entry points for applications that delegate sign-in to Authometry."
            title="OAuth provider buttons"
          />
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-5">
            <AuthometryProviderButton />
            <AuthometryProviderButton appearance="brand" />
            <AuthometryProviderButton appearance="dark" />
            <AuthometryProviderButton compact>Sign in with Authometry</AuthometryProviderButton>
          </div>
        </section>
        <section className="border-t border-[var(--border)] pt-7">
          <SectionHeader title="Status" />
          <div className="flex flex-wrap gap-2">
            <StatusBadge label="Success" tone="success" />
            <StatusBadge label="Denied" tone="warning" />
            <StatusBadge label="Error" tone="danger" />
            <StatusBadge label="Pending" tone="neutral" />
            <StatusBadge label="Informational" tone="info" />
          </div>
        </section>
        <section className="border-t border-[var(--border)] pt-7">
          <SectionHeader title="Form controls" />
          <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
            <label>
              <span className="mb-1.5 block text-xs font-medium">Client ID</span>
              <input
                className={`${inputClass} technical-value`}
                defaultValue="amt_client_M9bA2f7Jq"
              />
            </label>
            <label>
              <span className="mb-1.5 block text-xs font-medium">Disabled</span>
              <input className={inputClass} disabled value="Managed by Git" readOnly />
            </label>
            <label className="sm:col-span-2">
              <span className="mb-1.5 block text-xs font-medium">Validation error</span>
              <input
                aria-invalid
                className={`${inputClass} border-[var(--danger)]`}
                defaultValue="http://production.example.com"
              />
              <span className="mt-1 block text-xs text-[var(--danger)]">
                Use HTTPS unless the host is localhost.
              </span>
            </label>
          </div>
        </section>
        <section className="border-t border-[var(--border)] pt-7">
          <SectionHeader title="Alerts" />
          <div className="grid gap-3 lg:grid-cols-3">
            {alerts.map(([Icon, background, border, label]) => (
              <div
                className="flex items-center gap-3 border p-3 text-[13px]"
                key={label}
                style={{ background, borderColor: border }}
              >
                <Icon className="size-4" />
                {label}
              </div>
            ))}
          </div>
        </section>
        <section className="border-t border-[var(--border)] pt-7">
          <EmptyState
            description="Applications represent websites, mobile apps, APIs, and services that use Authometry."
            icon={AppWindow}
            primaryAction={<Button variant="primary">Add application</Button>}
            title="Create your first application"
          />
        </section>
      </div>
    </PageContainer>
  );
}
