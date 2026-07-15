"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, Check, CircleDashed, CircleX, Clock3, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { TraceStep } from "@authometry/domain";
import { Button, StatusBadge, cn } from "@authometry/ui";
import { duration } from "@/lib/format";

export function TraceTimeline({ steps }: { steps: TraceStep[] }) {
  const [selected, setSelected] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const step = steps[selected];
  useEffect(() => {
    refs.current[selected]?.focus({ preventScroll: true });
  }, [selected]);
  function select(index: number, open = false) {
    setSelected(Math.max(0, Math.min(steps.length - 1, index)));
    if (open && window.matchMedia("(max-width: 1023px)").matches) setSheetOpen(true);
  }
  function keyDown(event: React.KeyboardEvent, index: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      select(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      select(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      select(0);
    } else if (event.key === "End") {
      event.preventDefault();
      select(steps.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      select(index, true);
    }
  }
  return (
    <>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
        <ol aria-label="Authorization trace steps" className="border-y border-[var(--border)]">
          {steps.map((item, index) => {
            const active = index === selected;
            const status = {
              passed: { icon: Check, color: "success" },
              failed: { icon: CircleX, color: "danger" },
              warning: { icon: AlertTriangle, color: "warning" },
              pending: { icon: Clock3, color: "info" },
              skipped: { icon: CircleDashed, color: "text-tertiary" },
            }[item.status];
            const Icon = status.icon;
            return (
              <li className="relative" key={item.id}>
                {index < steps.length - 1 && (
                  <span
                    className={cn(
                      "absolute top-7 bottom-[-28px] left-[26px] w-px",
                      item.status === "failed"
                        ? "bg-transparent"
                        : item.status === "passed"
                          ? "bg-[var(--success-border)]"
                          : "bg-[var(--border)]",
                    )}
                  />
                )}
                <button
                  aria-current={active ? "step" : undefined}
                  aria-label={`Step ${index + 1} of ${steps.length}, ${item.name}, ${item.status}${item.durationMs === undefined ? "" : ` in ${item.durationMs} milliseconds`}`}
                  className={cn(
                    "relative grid min-h-[72px] w-full grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--border-subtle)] px-2 py-3 text-left last:border-0 hover:bg-[var(--surface-hover)] focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none focus-visible:ring-inset",
                    active && "bg-[var(--accent-soft)]",
                  )}
                  onClick={() => select(index, true)}
                  onKeyDown={(event) => keyDown(event, index)}
                  ref={(node) => {
                    refs.current[index] = node;
                  }}
                  tabIndex={active ? 0 : -1}
                >
                  <span
                    className={cn(
                      "relative z-10 flex size-8 items-center justify-center rounded-full border bg-[var(--surface-raised)]",
                      active
                        ? "border-[var(--accent)] ring-2 ring-[var(--accent-border)]"
                        : `border-[var(--${status.color})]`,
                    )}
                  >
                    <Icon className={cn("size-3.5", `text-[var(--${status.color})]`)} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium">{item.name}</span>
                    <span className="technical-value mt-0.5 block truncate text-[var(--text-secondary)]">
                      {item.summary}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="technical-value block text-[var(--text-tertiary)]">
                      +{item.startedOffsetMs} ms
                    </span>
                    <span className="technical-value block text-[var(--text-secondary)]">
                      {duration(item.durationMs)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="hidden lg:block">
          <div className="sticky top-6">{step && <StepPanel step={step} />}</div>
        </div>
      </div>
      <Dialog.Root onOpenChange={setSheetOpen} open={sheetOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 lg:hidden" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed right-0 bottom-0 left-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-[10px] border border-[var(--border)] bg-[var(--surface-raised)] p-4 shadow-2xl lg:hidden"
          >
            <div className="mb-3 flex items-center justify-between">
              <Dialog.Title className="text-sm font-semibold">Step details</Dialog.Title>
              <Dialog.Close asChild>
                <Button aria-label="Close details" size="icon" variant="ghost">
                  <X className="size-4" />
                </Button>
              </Dialog.Close>
            </div>
            {step && <StepPanel step={step} compact />}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

function StepPanel({ step, compact = false }: { step: TraceStep; compact?: boolean }) {
  const tone =
    step.status === "passed"
      ? "success"
      : step.status === "failed"
        ? "danger"
        : step.status === "warning"
          ? "warning"
          : "neutral";
  return (
    <aside
      className={cn(
        "rounded-lg border border-[var(--border)] bg-[var(--surface-raised)]",
        compact && "border-0",
      )}
    >
      <div className="border-b border-[var(--border)] p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold">{step.name}</h2>
          <StatusBadge label={step.status} tone={tone} />
        </div>
        <p className="mt-2 text-[13px] leading-5 text-[var(--text-secondary)]">
          {step.description}
        </p>
      </div>
      <div className="space-y-5 p-4">
        {step.inputs?.length ? <FieldGroup fields={step.inputs} title="Inputs" /> : null}
        {step.decision && (
          <div>
            <h3 className="mb-2 text-xs font-semibold">Decision</h3>
            <div className="border-l-2 border-[var(--accent)] pl-3">
              <p className="text-[13px] font-medium capitalize">
                {step.decision.outcome.replaceAll("_", " ")}
              </p>
              <p className="mt-0.5 text-xs leading-5 text-[var(--text-secondary)]">
                {step.decision.reason}
              </p>
            </div>
          </div>
        )}
        {step.outputs?.length ? <FieldGroup fields={step.outputs} title="Output" /> : null}
        <dl className="grid grid-cols-[140px_1fr] gap-y-2 border-t border-[var(--border-subtle)] pt-4 text-xs">
          <dt className="text-[var(--text-secondary)]">Started</dt>
          <dd className="technical-value">+{step.startedOffsetMs} ms</dd>
          <dt className="text-[var(--text-secondary)]">Completed in</dt>
          <dd className="technical-value">{duration(step.durationMs)}</dd>
        </dl>
        {step.documentationPath && (
          <Button asChild size="compact" variant="ghost">
            <a href={step.documentationPath}>View documentation</a>
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
      <h3 className="mb-2 text-xs font-semibold">{title}</h3>
      <dl className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border)]">
        {fields.map((field) => (
          <div className="grid gap-1 py-2 sm:grid-cols-[140px_1fr]" key={field.label}>
            <dt className="text-xs text-[var(--text-secondary)]">{field.label}</dt>
            <dd className={field.format && field.format !== "text" ? "technical-value" : "text-xs"}>
              {Array.isArray(field.value) ? field.value.join(", ") : String(field.value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
