"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@authometry/ui";
import { Modal } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/form";

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
    <Modal
      description={`Set a new password for ${email}. This signs them out of every active session.`}
      footer={
        <>
          <Button disabled={pending} onClick={() => changeOpen(false)} type="button">
            Cancel
          </Button>
          <Button form="reset-user-password-form" loading={pending} type="submit" variant="primary">
            {pending ? "Resetting…" : "Reset password"}
          </Button>
        </>
      }
      onOpenChange={changeOpen}
      open={open}
      preventClose={pending}
      title="Reset password"
    >
      <form className="space-y-4" id="reset-user-password-form" onSubmit={submit}>
        <Field description="At least 12 characters." label="New password">
          <Input
            autoComplete="new-password"
            autoFocus
            minLength={12}
            name="newPassword"
            required
            type="password"
          />
        </Field>
        <Field error={error || undefined} label="Confirm new password">
          <Input
            autoComplete="new-password"
            minLength={12}
            name="confirmation"
            onChange={() => setError("")}
            required
            type="password"
          />
        </Field>
      </form>
    </Modal>
  );
}
