"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@authometry/ui";
import { Modal } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/form";

interface ConfirmDialogProps {
  actionLabel: string;
  description: ReactNode;
  onConfirm: () => unknown;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pendingLabel?: string;
  title: string;
  tone?: "danger" | "neutral";
  /** When set, the user must type this exact text before confirming. */
  confirmationText?: string;
}

export function ConfirmDialog({
  actionLabel,
  confirmationText,
  description,
  onConfirm,
  onOpenChange,
  open,
  pendingLabel = "Working…",
  title,
  tone = "danger",
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);
  const [typed, setTyped] = useState("");
  const confirmed = !confirmationText || typed.trim() === confirmationText;

  function change(next: boolean) {
    if (!next) setTyped("");
    onOpenChange(next);
  }

  async function confirm() {
    if (!confirmed) return;
    setPending(true);
    try {
      await onConfirm();
      change(false);
    } catch {
      // The action owns its error message. Keep the dialog open so it can be retried.
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      description={description}
      footer={
        <>
          <Button disabled={pending} onClick={() => change(false)} type="button">
            Cancel
          </Button>
          <Button
            disabled={!confirmed}
            form="confirm-dialog-form"
            loading={pending}
            type="submit"
            variant={tone === "danger" ? "danger" : "primary"}
          >
            {pending ? pendingLabel : actionLabel}
          </Button>
        </>
      }
      onOpenChange={change}
      open={open}
      preventClose={pending}
      title={title}
    >
      <form
        id="confirm-dialog-form"
        onSubmit={(event) => {
          event.preventDefault();
          void confirm();
        }}
      >
        {confirmationText && (
          <Field
            label={
              <>
                Type <span className="font-mono">{confirmationText}</span> to confirm
              </>
            }
          >
            <Input
              autoComplete="off"
              autoFocus
              mono
              onChange={(event) => setTyped(event.target.value)}
              spellCheck={false}
              value={typed}
            />
          </Field>
        )}
      </form>
    </Modal>
  );
}
