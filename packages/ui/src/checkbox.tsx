import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "./utils";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  wrapperClassName?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, wrapperClassName, ...props },
  ref,
) {
  return (
    <span className={cn("relative inline-flex size-4 shrink-0", wrapperClassName)}>
      <input
        className={cn(
          "peer size-4 cursor-pointer appearance-none rounded-[4px] border border-[var(--border-strong)] bg-[var(--surface-raised)]",
          "transition-[background-color,border-color,box-shadow,transform] duration-[var(--motion-fast)] ease-[var(--ease-out)]",
          "hover:border-[var(--text-tertiary)] active:scale-90",
          "checked:border-[var(--primary)] checked:bg-[var(--primary)]",
          "focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:border-[var(--border)] disabled:bg-[var(--geist-gray-100)] disabled:checked:bg-[var(--geist-gray-600)]",
          className,
        )}
        ref={ref}
        type="checkbox"
        {...props}
      />
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-4 p-[3px] text-[var(--primary-foreground)] opacity-0 peer-checked:opacity-100 peer-checked:[&_path]:animate-[draw-check_var(--motion-normal)_var(--ease-out)_both]"
        fill="none"
        viewBox="0 0 10 10"
      >
        <path
          d="M1.5 5.2 4 7.5l4.5-5"
          stroke="currentColor"
          strokeDasharray="12"
          strokeDashoffset="0"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.6"
        />
      </svg>
    </span>
  );
});

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  wrapperClassName?: string;
}

/** Geist Switch built on a native checkbox so forms, labels, and keyboard behavior keep working. */
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { className, wrapperClassName, ...props },
  ref,
) {
  return (
    <span className={cn("relative inline-flex h-5 w-8 shrink-0", wrapperClassName)}>
      <input
        className={cn(
          "peer h-5 w-8 cursor-pointer appearance-none rounded-full bg-[var(--geist-gray-500)]",
          "transition-[background-color,box-shadow] duration-[var(--motion-normal)] ease-[var(--ease-out)]",
          "checked:bg-[var(--primary)] hover:brightness-[1.05]",
          "focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        role="switch"
        type="checkbox"
        {...props}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.2)] transition-[background-color,transform] duration-[var(--motion-normal)] ease-[var(--ease-spring)] peer-checked:translate-x-3 peer-checked:bg-[var(--primary-foreground)] peer-active:scale-x-110"
      />
    </span>
  );
});
