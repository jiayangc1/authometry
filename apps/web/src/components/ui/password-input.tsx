"use client";

import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { cn } from "@authometry/ui";
import { inputClass } from "./form";

/** Password input with an accessible show/hide toggle. */
export const PasswordInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { large?: boolean }
>(function PasswordInput({ className, large, ...props }, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative block">
      <input
        className={cn(inputClass, large && "h-10", "pr-10", className)}
        ref={ref}
        type={visible ? "text" : "password"}
        {...props}
      />
      <button
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="pressable absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-[4px] text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none"
        onClick={() => setVisible((value) => !value)}
        tabIndex={-1}
        type="button"
      >
        {visible ? (
          <EyeOff aria-hidden="true" className="size-3.5" />
        ) : (
          <Eye aria-hidden="true" className="size-3.5" />
        )}
      </button>
    </span>
  );
});
