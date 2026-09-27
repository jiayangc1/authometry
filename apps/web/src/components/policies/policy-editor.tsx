"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Plus, X, XCircle } from "lucide-react";
import { Button, Checkbox, Switch, cn } from "@authometry/ui";
import { Card, CardHeader } from "@/components/ui/card";
import { ChoiceRow, Field, Input, Select, Textarea } from "@/components/ui/form";
import { SegmentedControl } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";

export type Operator = "equals" | "not_equals" | "contains" | "in";
export interface ConditionDraft {
  field: string;
  operator: Operator;
  value: string;
}
export interface PolicyDraft {
  displayName: string;
  description: string;
  enabled: boolean;
  applicationIds: string[];
  conditions: ConditionDraft[];
  message: string;
}
export interface TestContext {
  groups: string;
  email: string;
  environment: string;
  applicationType: string;
  applicationSlug: string;
  scopes: string;
}

export const fields = [
  { value: "user.groups", label: "User groups", list: true },
  { value: "user.email", label: "User email", list: false },
  { value: "environment", label: "Environment", list: false },
  { value: "application.type", label: "Application type", list: false },
  { value: "application.slug", label: "Application ID", list: false },
  { value: "request.scopes", label: "Requested scopes", list: true },
] as const;

const operators: Array<{ value: Operator; label: string }> = [
  { value: "contains", label: "contains" },
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "in", label: "is one of" },
];

const splitList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

/** Serialize a draft condition the way the server evaluator expects (`in` needs an array). */
export function serializeCondition(condition: ConditionDraft) {
  return {
    field: condition.field,
    operator: condition.operator,
    value: condition.operator === "in" ? splitList(condition.value) : condition.value.trim(),
  };
}

export function deserializeCondition(condition: {
  field: string;
  operator: Operator;
  value: unknown;
}): ConditionDraft {
  return {
    field: condition.field,
    operator: condition.operator,
    value: Array.isArray(condition.value)
      ? condition.value.join(", ")
      : String(condition.value ?? ""),
  };
}

function observedValue(field: string, context: TestContext): unknown {
  switch (field) {
    case "user.groups":
      return splitList(context.groups);
    case "user.email":
      return context.email;
    case "environment":
      return context.environment;
    case "application.type":
      return context.applicationType;
    case "application.slug":
      return context.applicationSlug;
    case "request.scopes":
      return splitList(context.scopes);
    default:
      return "";
  }
}

/** Mirrors apps/server/src/lib/policy.ts so the test panel matches production decisions. */
export function evaluate(condition: ConditionDraft, context: TestContext): boolean {
  const serialized = serializeCondition(condition);
  const observed = observedValue(condition.field, context);
  switch (serialized.operator) {
    case "equals":
      return observed === serialized.value;
    case "not_equals":
      return observed !== serialized.value;
    case "contains":
      return Array.isArray(observed)
        ? observed.includes(serialized.value)
        : typeof observed === "string" && observed.includes(serialized.value as string);
    case "in":
      return (serialized.value as string[]).includes(String(observed));
  }
}

export function PolicyEditor({
  draft,
  onChange,
  readOnly = false,
  identifier,
}: {
  draft: PolicyDraft;
  onChange: (draft: PolicyDraft) => void;
  readOnly?: boolean;
  identifier?: React.ReactNode;
}) {
  const applications = useQuery({
    queryKey: ["applications", "", "", ""],
    queryFn: () =>
      apiFetch<{ data: Array<{ id: string; name: string; slug: string }> }>(
        "/api/v1/applications?q=&type=&status=",
      ),
  });
  function updateCondition(index: number, patch: Partial<ConditionDraft>) {
    onChange({
      ...draft,
      conditions: draft.conditions.map((condition, conditionIndex) =>
        conditionIndex === index ? { ...condition, ...patch } : condition,
      ),
    });
  }
  const scoped = draft.applicationIds.length > 0;
  return (
    <fieldset className="space-y-6" disabled={readOnly}>
      <Card>
        <CardHeader title="Details" />
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
          {identifier}
          <Field className={identifier ? undefined : "sm:col-span-2"} label="Display name">
            <Input
              maxLength={100}
              minLength={2}
              onChange={(event) => onChange({ ...draft, displayName: event.target.value })}
              placeholder="Production admins only"
              required
              value={draft.displayName}
            />
          </Field>
          <Field className="sm:col-span-2" label="Description" optional>
            <Textarea
              className="min-h-16"
              maxLength={500}
              onChange={(event) => onChange({ ...draft, description: event.target.value })}
              rows={2}
              value={draft.description}
            />
          </Field>
          <ChoiceRow
            className="sm:col-span-2"
            control={
              <Switch
                checked={draft.enabled}
                onChange={(event) => onChange({ ...draft, enabled: event.target.checked })}
              />
            }
            description="Disabled policies are skipped during authorization."
            title="Enforce this policy"
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          actions={
            <SegmentedControl
              label="Applies to"
              onChange={(value) =>
                onChange({
                  ...draft,
                  applicationIds:
                    value === "all"
                      ? []
                      : draft.applicationIds.length
                        ? draft.applicationIds
                        : applications.data?.data[0]
                          ? [applications.data.data[0].id]
                          : [],
                })
              }
              options={[
                { value: "all", label: "All apps" },
                { value: "some", label: "Selected apps" },
              ]}
              size="compact"
              value={scoped ? "some" : "all"}
            />
          }
          description="Which applications this policy is evaluated for."
          title="Applies to"
        />
        {scoped ? (
          <ul className="max-h-64 animate-[fade-in_var(--motion-normal)_var(--ease-out)] scrollbar-thin overflow-y-auto">
            {(applications.data?.data ?? []).map((application) => {
              const checked = draft.applicationIds.includes(application.id);
              return (
                <li className="border-b border-[var(--border)] last:border-0" key={application.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--surface-subtle)] sm:px-5">
                    <Checkbox
                      checked={checked}
                      onChange={(event) =>
                        onChange({
                          ...draft,
                          applicationIds: event.target.checked
                            ? [...draft.applicationIds, application.id]
                            : draft.applicationIds.filter((id) => id !== application.id),
                        })
                      }
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                      {application.name}
                    </span>
                    <code className="technical-value text-[var(--text-tertiary)]">
                      {application.slug}
                    </code>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-4 py-3 text-[13px] text-[var(--text-secondary)] sm:px-5">
            Evaluated for every application in this environment.
          </p>
        )}
      </Card>

      <Card>
        <CardHeader
          description="Authorization is allowed only when every condition matches."
          title="Rules"
        />
        <div className="space-y-2 p-4 sm:p-5">
          {draft.conditions.map((condition, index) => {
            const field = fields.find((item) => item.value === condition.field);
            return (
              <div
                className="grid animate-[enter_var(--motion-normal)_var(--ease-out)] items-center gap-2 sm:grid-cols-[56px_minmax(0,1fr)_150px_minmax(0,1fr)_32px]"
                key={index}
              >
                <span className="technical-value text-[11px] font-medium text-[var(--text-tertiary)]">
                  {index === 0 ? "WHEN" : "AND"}
                </span>
                <Select
                  aria-label={`Condition ${index + 1} field`}
                  compact
                  onChange={(event) => updateCondition(index, { field: event.target.value })}
                  value={condition.field}
                >
                  {fields.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                  {!field && <option value={condition.field}>{condition.field}</option>}
                </Select>
                <Select
                  aria-label={`Condition ${index + 1} operator`}
                  compact
                  onChange={(event) =>
                    updateCondition(index, { operator: event.target.value as Operator })
                  }
                  value={condition.operator}
                >
                  {operators.map((operator) => (
                    <option key={operator.value} value={operator.value}>
                      {operator.label}
                    </option>
                  ))}
                </Select>
                <Input
                  aria-label={`Condition ${index + 1} value`}
                  compact
                  mono
                  onChange={(event) => updateCondition(index, { value: event.target.value })}
                  placeholder={condition.operator === "in" ? "admin, owner" : "admin"}
                  required
                  value={condition.value}
                />
                <Button
                  aria-label={`Remove condition ${index + 1}`}
                  disabled={draft.conditions.length === 1}
                  onClick={() =>
                    onChange({
                      ...draft,
                      conditions: draft.conditions.filter(
                        (_, conditionIndex) => conditionIndex !== index,
                      ),
                    })
                  }
                  size="icon-compact"
                  type="button"
                  variant="ghost"
                >
                  <X aria-hidden="true" className="size-3.5" />
                </Button>
              </div>
            );
          })}
          <Button
            className="mt-1"
            onClick={() =>
              onChange({
                ...draft,
                conditions: [
                  ...draft.conditions,
                  { field: "user.email", operator: "contains", value: "" },
                ],
              })
            }
            size="compact"
            type="button"
            variant="ghost"
          >
            <Plus aria-hidden="true" className="size-3.5" /> Add condition
          </Button>
          <div className="mt-3 grid items-center gap-2 border-t border-[var(--border)] pt-4 sm:grid-cols-[56px_minmax(0,1fr)]">
            <span className="technical-value text-[11px] font-medium text-[var(--text-tertiary)]">
              THEN
            </span>
            <p className="flex items-center gap-2 text-[13px] text-[var(--success)]">
              <CheckCircle2 aria-hidden="true" className="size-4" /> Allow authorization
            </p>
          </div>
          <div className="grid items-start gap-2 sm:grid-cols-[56px_minmax(0,1fr)]">
            <span className="technical-value pt-2 text-[11px] font-medium text-[var(--text-tertiary)]">
              ELSE
            </span>
            <Field description="Shown to the person who was denied." label="Deny with message">
              <Input
                maxLength={300}
                onChange={(event) => onChange({ ...draft, message: event.target.value })}
                required
                value={draft.message}
              />
            </Field>
          </div>
        </div>
      </Card>
    </fieldset>
  );
}

export function PolicyTester({
  conditions,
  context,
  message,
  onChange,
}: {
  conditions: ConditionDraft[];
  context: TestContext;
  message: string;
  onChange: (context: TestContext) => void;
}) {
  const results = conditions.map((condition) => evaluate(condition, context));
  const allowed = results.every(Boolean);
  const used = new Set(conditions.map((condition) => condition.field));
  const inputs: Array<[keyof TestContext, string, string, string]> = [
    ["groups", "user.groups", "User groups", "engineering, admin"],
    ["email", "user.email", "User email", "ada@example.com"],
    ["environment", "environment", "Environment", "production"],
    ["applicationType", "application.type", "Application type", "web"],
    ["applicationSlug", "application.slug", "Application ID", "acme-dashboard"],
    ["scopes", "request.scopes", "Requested scopes", "openid, profile"],
  ];
  return (
    <Card className="overflow-hidden">
      <CardHeader description="Try a sample request. Nothing is saved." title="Test" />
      <div className="space-y-3 p-4">
        {inputs
          .filter(([, field]) => used.has(field))
          .map(([key, , label, placeholder]) => (
            <Field key={key} label={label}>
              <Input
                compact
                mono
                onChange={(event) => onChange({ ...context, [key]: event.target.value })}
                placeholder={placeholder}
                value={context[key]}
              />
            </Field>
          ))}
      </div>
      <div
        aria-live="polite"
        className={cn(
          "border-t px-4 py-3 transition-colors duration-[var(--motion-normal)]",
          allowed
            ? "border-[var(--success-border)] bg-[var(--success-soft)]"
            : "border-[var(--danger-border)] bg-[var(--danger-soft)]",
        )}
      >
        <p
          className={cn(
            "flex items-center gap-2 text-sm font-semibold",
            allowed ? "text-[var(--success)]" : "text-[var(--danger)]",
          )}
          key={String(allowed)}
        >
          {allowed ? (
            <CheckCircle2 aria-hidden="true" className="animate-pop size-4" />
          ) : (
            <XCircle aria-hidden="true" className="animate-pop size-4" />
          )}
          {allowed ? "Allowed" : "Denied"}
        </p>
        <ul className="mt-2 space-y-1">
          {conditions.map((condition, index) => (
            <li
              className="technical-value flex items-start gap-1.5 text-[var(--text-secondary)]"
              key={index}
            >
              <span className={results[index] ? "text-[var(--success)]" : "text-[var(--danger)]"}>
                {results[index] ? "✓" : "✗"}
              </span>
              {condition.field} {condition.operator.replaceAll("_", " ")} {condition.value || "…"}
            </li>
          ))}
        </ul>
        {!allowed && <p className="mt-2 text-xs text-[var(--text-secondary)]">“{message}”</p>}
      </div>
    </Card>
  );
}
