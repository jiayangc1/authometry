import { notFound } from "next/navigation";
import { AppWindow, Plus } from "lucide-react";
import {
  AuthometryProviderButton,
  Button,
  Checkbox,
  EmptyState,
  Kbd,
  LoadingDots,
  Note,
  Spinner,
  StatusBadge,
  StatusDot,
  Switch,
} from "@authometry/ui";
import { CodeBlock, Snippet } from "@/components/data-display/copyable-value";
import { Skeleton } from "@/components/data-display/states";
import { PageContainer, PageHeader, SectionHeader } from "@/components/layout/page";
import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { ChoiceRow, Field, Input, Select, Textarea } from "@/components/ui/form";

export default function ComponentShowcasePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <PageContainer>
      <PageHeader
        description="Internal route for checking every design-system state in both themes."
        title="Component showcase"
      />
      <div className="space-y-10">
        <section>
          <SectionHeader title="Buttons" />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary">
              <Plus aria-hidden="true" className="size-3.5" /> Primary
            </Button>
            <Button>Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button disabled>Disabled</Button>
            <Button loading variant="primary">
              Saving…
            </Button>
            <Button size="compact">Compact</Button>
            <Button size="large" variant="primary">
              Large
            </Button>
          </div>
        </section>
        <section>
          <SectionHeader
            description="Branded entry points for applications that delegate sign-in to Authometry."
            title="Provider buttons"
          />
          <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-subtle)] p-5">
            <AuthometryProviderButton />
            <AuthometryProviderButton appearance="brand" />
            <AuthometryProviderButton appearance="dark" />
            <AuthometryProviderButton compact>Sign in with Authometry</AuthometryProviderButton>
          </div>
        </section>
        <section>
          <SectionHeader title="Status" />
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge label="Authorized" tone="success" />
            <StatusBadge label="Denied" tone="warning" />
            <StatusBadge label="Error" tone="danger" />
            <StatusBadge label="Pending" tone="neutral" />
            <StatusBadge label="Info" tone="info" />
            <StatusDot label="Live" pulse tone="success" />
            <Spinner />
            <LoadingDots />
            <Kbd>⌘K</Kbd>
          </div>
        </section>
        <section>
          <SectionHeader title="Form controls" />
          <Card>
            <CardHeader description="Labels, help text, and inline errors." title="Example form" />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field description="Public identifier." label="Client ID">
                <Input defaultValue="amt_client_M9bA2f7Jq" mono />
              </Field>
              <Field label="Disabled">
                <Input disabled value="Managed by Git" readOnly />
              </Field>
              <Field error="Use HTTPS unless the host is localhost." label="Callback URL">
                <Input defaultValue="http://production.example.com" mono />
              </Field>
              <Field label="Type">
                <Select defaultValue="web">
                  <option value="web">Web application</option>
                  <option value="spa">Single-page application</option>
                </Select>
              </Field>
              <Field className="sm:col-span-2" label="Description" optional>
                <Textarea placeholder="What does this application do?" />
              </Field>
              <ChoiceRow
                control={<Checkbox defaultChecked />}
                description="Checkbox row."
                title="Require PKCE"
              />
              <ChoiceRow
                control={<Switch defaultChecked />}
                description="Switch row."
                title="Enforce policy"
              />
            </div>
            <CardFooter hint="Footer hint text.">
              <Button variant="primary">Save</Button>
            </CardFooter>
          </Card>
        </section>
        <section>
          <SectionHeader title="Notes" />
          <div className="grid gap-3 lg:grid-cols-2">
            <Note tone="success">Configuration applied.</Note>
            <Note tone="warning">Issuer change pending.</Note>
            <Note tone="info">Managed by Git.</Note>
            <Note tone="danger">The request was denied.</Note>
          </div>
        </section>
        <section>
          <SectionHeader title="Code" />
          <div className="space-y-3">
            <Snippet prompt value="npx authometry apply ./manifests" />
            <CodeBlock code={'{\n  "issuer": "https://auth.example.com"\n}'} label="JSON" />
          </div>
        </section>
        <section>
          <SectionHeader title="Loading" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </section>
        <EmptyState
          description="Applications represent websites, mobile apps, APIs, and services that use Authometry."
          icon={AppWindow}
          primaryAction={<Button variant="primary">Create application</Button>}
          title="Create your first application"
        />
      </div>
    </PageContainer>
  );
}
