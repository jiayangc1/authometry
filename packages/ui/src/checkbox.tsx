import { Check } from "lucide-react";
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
          "peer size-4 cursor-pointer appearance-none rounded-[4px] border border-[var(--border-strong)] bg-[var(--surface-raised)] transition-colors checked:border-[var(--accent)] checked:bg-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] focus-visible:outline-none disabled:cursor-not-allowed disabled:border-[var(--border)] disabled:bg-[var(--surface-subtle)] disabled:opacity-60",
          className,
        )}
        ref={ref}
        type="checkbox"
        {...props}
      />
      <Check
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-4 stroke-[3] p-[2px] text-[var(--accent-foreground)] opacity-0 peer-checked:opacity-100 peer-disabled:text-[var(--text-disabled)]"
      />
    </span>
  );
});
