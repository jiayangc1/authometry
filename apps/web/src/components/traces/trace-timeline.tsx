"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, BookOpen, Check, CircleDashed, CircleX, Clock3, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type ComponentType } from "react";
import type { TraceStep } from "@authometry/domain";
import { Button, EmptyState, StatusBadge, cn, type StatusTone } from "@authometry/ui";
import { CopyButton } from "@/components/data-display/copyable-value";
import { duration, durationOffset } from "@/lib/format";
import { humanize } from "@/lib/status";

const stepStatus: Record<
  TraceStep["status"],
  { icon: ComponentType<{ className?: string }>; tone: StatusTone; ring: string; bar: string }
> = {
  passed: {
    icon: Check,
    tone: "success",
    ring: "border-[var(--success-border)] text-[var(--success)]",
    bar: "bg-[var(--success-solid)]",
  },
  failed: {
    icon: CircleX,
    tone: "danger",
    ring: "border-[var(--danger-border)] text-[var(--danger)]",
    bar: "bg-[var(--danger-solid)]",
  },
  warning: {
    icon: AlertTriangle,
    tone: "warning",
    ring: "border-[var(--warning-border)] text-[var(--warning)]",
    bar: "bg-[var(--warning-solid)]",
  },
  pending: {
    icon: Clock3,
    tone: "info",
    ring: "border-[var(--info-border)] text-[var(--info)]",
    bar: "bg-[var(--accent)]",
  },
  skipped: {
    icon: CircleDashed,
    tone: "neutral",
    ring: "border-[var(--border)] text-[var(--text-tertiary)]",
    bar: "bg-[var(--geist-gray-500)]",
  },
};

export function TraceTimeline({ steps }: { steps: TraceStep[] }) {
  const [selected, setSelected] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const step = steps[selected];
  const total = Math.max(1, ...steps.map((item) => item.startedOffsetMs + (item.durationMs ?? 0)));

  if (steps.length === 0)
    return (
      <EmptyState
        description="This request finished before any validation steps were recorded."
        headingLevel="h3"
        title="No steps recorded"
      />
    );

  function select(index: number, { open = false, focus = false } = {}) {
    const next = Math.max(0, Math.min(steps.length - 1, index));
    setSelected(next);
    if (focus) refs.current[next]?.focus();
    if (open && window.matchMedia("(max-width: 1023px)").matches) setSheetOpen(true);
  }
  function keyDown(event: React.KeyboardEvent, index: number) {
    const keys: Record<string, number> = {
      ArrowDown: index + 1,
      ArrowUp: index - 1,
      Home: 0,
      End: steps.length - 1,
    };
    if (event.key in keys) {
      event.preventDefault();
      select(keys[event.key]!, { focus: true });
    }
  }
  return (
    <>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <ol
          aria-label="Authorization trace steps"
          className="stagger overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-raised)]"
        >
          {steps.map((item, index) => {
            const active = index === selected;
            const status = stepStatus[item.status];
            const Icon = status.icon;
            const left = (item.startedOffsetMs / total) * 100;
            const width = Math.max(((item.durationMs ?? 0) / total) * 100, 0.8);
            return (
              <li className="relative border-b border-[var(--border)] last:border-0" key={item.id}>
                <button
                  aria-current={active ? "step" : undefined}
                  aria-label={`Step ${index + 1} of ${steps.length}, ${item.name}, ${item.status}${item.durationMs === undefined ? "" : ` in ${item.durationMs} milliseconds`}`}
                  className={cn(
                    "relative grid min-h-[68px] w-full grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 text-left transition-colors duration-[var(--motion-fast)] focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none focus-visible:ring-inset",
                    active ? "bg-[var(--surface-hover)]" : "hover:bg-[var(--surface-subtle)]",
                  )}
                  onClick={() => select(index, { open: true })}
                  onKeyDown={(event) => keyDown(event, index)}
                  ref={(node) => {
                    refs.current[index] = node;
                  }}
                  tabIndex={active ? 0 : -1}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-y-0 left-0 w-0.5 bg-[var(--text-primary)] transition-transform duration-[var(--motion-normal)] ease-[var(--ease-out)]",
                      active ? "scale-y-100" : "scale-y-0",
                    )}
                  />
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full border bg-[var(--surface-raised)] transition-transform duration-[var(--motion-normal)] ease-[var(--ease-spring)]",
                      status.ring,
                      active && "scale-110",
                    )}
                  >
                    <Icon aria-hidden="true" className="size-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-baseline gap-2">
                      <span className="technical-value text-[11px] text-[var(--text-tertiary)]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="truncate text-[13px] font-medium">{item.name}</span>
                    </span>
                    <span className="technical-value mt-0.5 block truncate text-[var(--text-secondary)]">
                      {item.summary}
                    </span>
                    <span
                      aria-hidden="true"
                      className="relative mt-2 block h-1 overflow-hidden rounded-full bg-[var(--geist-gray-100)]"
                    >
                      <span
                        className={cn("absolute inset-y-0 rounded-full", status.bar)}
                        style={{ left: `${left}%`, width: `${width}%` }}
                      />
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="technical-value block text-[var(--text-primary)]">
                      {duration(item.durationMs)}
                    </span>
                    <span className="technical-value block text-[11px] text-[var(--text-tertiary)]">
                      {durationOffset(item.startedOffsetMs)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="hidden lg:sticky lg:top-6 lg:block">
          {step && <StepPanel key={step.id} step={step} />}
        </div>
      </div>
      <Dialog.Root onOpenChange={setSheetOpen} open={sheetOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="motion-overlay fixed inset-0 z-[var(--z-overlay)] bg-[var(--overlay)] lg:hidden" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed inset-x-0 bottom-0 z-[var(--z-overlay)] max-h-[85dvh] animate-[enter_var(--motion-slow)_var(--ease-out)] overflow-y-auto overscroll-contain rounded-t-[var(--radius-panel)] bg-[var(--surface-raised)] pb-[env(safe-area-inset-bottom)] shadow-[var(--shadow-modal)] focus:outline-none lg:hidden"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-raised)] px-4 py-2">
              <Dialog.Title className="text-sm font-semibold">
                Step {selected + 1} of {steps.length}
              </Dialog.Title>
              <div className="flex items-center gap-1">
                <Button
                  disabled={selected === 0}
                  onClick={() => select(selected - 1)}
                  size="compact"
                  variant="ghost"
                >
                  Previous
                </Button>
                <Button
                  disabled={selected === steps.length - 1}
                  onClick={() => select(selected + 1)}
                  size="compact"
                  variant="ghost"
                >
                  Next
                </Button>
                <Dialog.Close asChild>
                  <Button aria-label="Close details" size="icon-compact" variant="ghost">
                    <X aria-hidden="true" className="size-4" />
                  </Button>
                </Dialog.Close>
              </div>
            </div>
            {step && <StepPanel compact key={step.id} step={step} />}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

function StepPanel({ step, compact = false }: { step: TraceStep; compact?: boolean }) {
  const status = stepStatus[step.status];
  return (
    <aside
      className={cn(
        "animate-[fade-in_var(--motion-normal)_var(--ease-out)] bg-[var(--surface-raised)]",
        !compact && "rounded-[var(--radius-card)] border border-[var(--border)]",
      )}
    >
      <div className="border-b border-[var(--border)] p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold">{step.name}</h2>
          <StatusBadge label={humanize(step.status)} tone={status.tone} />
        </div>
        <p className="mt-1.5 text-[13px] leading-5 text-[var(--text-secondary)]">
          {step.description}
        </p>
      </div>
      <div className="space-y-5 p-4">
        {step.decision && (
          <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
            <p className="text-xs text-[var(--text-secondary)]">Decision</p>
            <p className="mt-0.5 text-[13px] font-medium">{humanize(step.decision.outcome)}</p>
            <p className="mt-0.5 text-xs leading-5 text-[var(--text-secondary)]">
              {step.decision.reason}
            </p>
          </div>
        )}
        {step.inputs?.length ? <FieldGroup fields={step.inputs} title="Inputs" /> : null}
        {step.outputs?.length ? <FieldGroup fields={step.outputs} title="Output" /> : null}
        <dl className="grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-4">
          <div>
            <dt className="text-xs text-[var(--text-secondary)]">Started</dt>
            <dd className="technical-value mt-0.5">{durationOffset(step.startedOffsetMs)}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--text-secondary)]">Duration</dt>
            <dd className="technical-value mt-0.5">{duration(step.durationMs)}</dd>
          </div>
        </dl>
        {step.documentationPath && (
          <Button asChild size="compact">
            <Link href={step.documentationPath}>
              <BookOpen aria-hidden="true" className="size-3.5" /> Read about this check
            </Link>
          </Button>
        )}
      </div>
    </aside>
  );
}

function FieldGroup({
  title,
  fields,
}: {
  title: string;
  fields: NonNullable<TraceStep["inputs"]>;
}) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium text-[var(--text-secondary)]">{title}</h3>
      <dl className="divide-y divide-[var(--border)] rounded-[var(--radius-control)] border border-[var(--border)]">
        {fields.map((field) => {
          const value = Array.isArray(field.value) ? field.value.join(", ") : String(field.value);
          const technical = field.format && field.format !== "text";
          return (
            <div
              className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 px-3 py-2 sm:grid-cols-[130px_minmax(0,1fr)_auto]"
              key={field.label}
            >
              <dt className="col-span-2 text-xs text-[var(--text-secondary)] sm:col-span-1">
                {field.label}
              </dt>
              <dd
                className={cn("min-w-0 break-words", technical ? "technical-value" : "text-[13px]")}
              >
                {value}
              </dd>
              <CopyButton
                className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                label={`Copy ${field.label}`}
                value={value}
              />
            </div>
          );
        })}
      </dl>
    </div>
  );
}
