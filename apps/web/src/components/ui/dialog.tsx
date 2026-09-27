"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button, cn } from "@authometry/ui";

/**
 * Geist Modal: centered on desktop, docked like a sheet on small screens.
 * Header, scrollable body, and a footer strip for actions.
 */
export function Modal({
  children,
  className,
  description,
  footer,
  onOpenChange,
  open,
  preventClose = false,
  title,
}: {
  children?: ReactNode;
  className?: string;
  description?: ReactNode;
  footer?: ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  preventClose?: boolean;
  title: ReactNode;
}) {
  return (
    <Dialog.Root
      onOpenChange={(next) => {
        if (!preventClose) onOpenChange(next);
      }}
      open={open}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="motion-overlay fixed inset-0 z-[var(--z-overlay)] bg-[var(--overlay)]" />
        <Dialog.Content
          className={cn(
            "motion-dialog fixed top-1/2 left-1/2 z-[var(--z-overlay)] flex max-h-[calc(100dvh-32px)] w-[calc(100%-24px)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[var(--radius-panel)] bg-[var(--surface-raised)] shadow-[var(--shadow-modal)] focus:outline-none",
            className,
          )}
          onEscapeKeyDown={(event) => {
            if (preventClose) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (preventClose) event.preventDefault();
          }}
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
            <div className="min-w-0">
              <Dialog.Title className="text-base leading-6 font-semibold tracking-[-0.01em] text-balance">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1 text-[13px] leading-5 text-[var(--text-secondary)]">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <Button
                aria-label="Close"
                className="-mt-1 -mr-2"
                disabled={preventClose}
                size="icon-compact"
                variant="ghost"
              >
                <X aria-hidden="true" className="size-4" />
              </Button>
            </Dialog.Close>
          </div>
          {children && <div className="min-h-0 overflow-y-auto px-5 pb-5">{children}</div>}
          {footer && (
            <div className="flex flex-col-reverse gap-2 border-t border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-3 sm:flex-row sm:justify-end">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
