"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { Button, cn } from "@authometry/ui";

interface ConfirmDialogProps {
  actionLabel: string;
  description: string;
  onConfirm: () => unknown;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pendingLabel?: string;
  title: string;
  tone?: "danger" | "neutral";
}

export function ConfirmDialog({
  actionLabel,
  description,
  onConfirm,
  onOpenChange,
  open,
  pendingLabel = "Working…",
  title,
  tone = "danger",
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // The action owns its error message. Keep the dialog open so it can be retried.
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog.Root
      onOpenChange={(nextOpen) => {
        if (!pending) onOpenChange(nextOpen);
      }}
      open={open}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-[1px]" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 z-[70] w-[calc(100%-24px)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] shadow-[0_24px_80px_rgba(0,0,0,0.22)]"
          onEscapeKeyDown={(event) => {
            if (pending) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (pending) event.preventDefault();
          }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void confirm();
            }}
          >
            <div className="flex gap-3 p-5">
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-md border",
                  tone === "danger"
                    ? "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)]"
                    : "border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]",
                )}
              >
                <AlertTriangle aria-hidden="true" className="size-4" />
              </span>
              <div className="min-w-0 pt-0.5">
                <Dialog.Title className="text-[15px] leading-5 font-semibold text-balance">
                  {title}
                </Dialog.Title>
                <Dialog.Description className="mt-1.5 text-[13px] leading-5 text-[var(--text-secondary)]">
                  {description}
                </Dialog.Description>
              </div>
            </div>
            <div
              className={cn(
                "flex justify-end gap-2 border-t bg-[var(--surface-subtle)] px-5 py-3",
                tone === "danger" ? "border-[var(--danger-border)]" : "border-[var(--border)]",
              )}
            >
              <Button disabled={pending} onClick={() => onOpenChange(false)} type="button">
                Cancel
              </Button>
              <Button
                disabled={pending}
                type="submit"
                variant={tone === "danger" ? "danger" : "primary"}
              >
                {pending ? pendingLabel : actionLabel}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
