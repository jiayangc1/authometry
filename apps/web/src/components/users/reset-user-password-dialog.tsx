"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { KeyRound, LoaderCircle } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button } from "@authometry/ui";
import { inputClass } from "@/components/auth/auth-shell";

interface ResetUserPasswordDialogProps {
  email: string;
  onOpenChange: (open: boolean) => void;
  onReset: (newPassword: string) => Promise<unknown>;
  open: boolean;
}

export function ResetUserPasswordDialog({
  email,
  onOpenChange,
  onReset,
  open,
}: ResetUserPasswordDialogProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  function changeOpen(nextOpen: boolean) {
    if (pending) return;
    if (!nextOpen) setError("");
    onOpenChange(nextOpen);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const newPassword = String(data.get("newPassword") ?? "");
    const confirmation = String(data.get("confirmation") ?? "");
    if (newPassword !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await onReset(newPassword);
      form.reset();
      onOpenChange(false);
    } catch {
      // The mutation displays the API error. Keep the dialog open so the admin can retry.
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog.Root onOpenChange={changeOpen} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-[1px]" />
        <Dialog.Content
          aria-describedby="reset-user-password-description"
          className="fixed top-1/2 left-1/2 z-[70] max-h-[calc(100dvh-24px)] w-[calc(100%-24px)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] shadow-[0_24px_80px_rgba(0,0,0,0.22)]"
          onEscapeKeyDown={(event) => {
            if (pending) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (pending) event.preventDefault();
          }}
        >
          <form onSubmit={submit}>
            <div className="flex gap-3 p-5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]">
                <KeyRound aria-hidden="true" className="size-4" />
              </span>
              <div className="min-w-0 pt-0.5">
                <Dialog.Title className="text-[15px] leading-5 font-semibold text-balance">
                  Reset user password
                </Dialog.Title>
                <Dialog.Description
                  className="mt-1.5 text-[13px] leading-5 text-[var(--text-secondary)]"
                  id="reset-user-password-description"
                >
                  Set a new password for {email}. This signs the user out of every active session.
                </Dialog.Description>
              </div>
            </div>
            <div className="space-y-4 border-t border-[var(--border)] px-5 py-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">New password</span>
                <input
                  autoComplete="new-password"
                  className={inputClass}
                  minLength={12}
                  name="newPassword"
                  required
                  type="password"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Confirm new password</span>
                <input
                  aria-describedby={error ? "reset-user-password-error" : undefined}
                  aria-invalid={Boolean(error)}
                  autoComplete="new-password"
                  className={inputClass}
                  minLength={12}
                  name="confirmation"
                  required
                  type="password"
                />
              </label>
              {error ? (
                <p
                  className="text-xs text-[var(--danger)]"
                  id="reset-user-password-error"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
              <p className="text-[11px] text-[var(--text-tertiary)]">At least 12 characters</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-3">
              <Button disabled={pending} onClick={() => changeOpen(false)} type="button">
                Cancel
              </Button>
              <Button disabled={pending} type="submit" variant="primary">
                {pending ? (
                  <>
                    <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" /> Resetting…
                  </>
                ) : (
                  "Reset password"
                )}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
