import { ChevronDown } from "lucide-react";
import {
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@authometry/ui";

const controlBase = [
  "w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-primary)]",
  "transition-[border-color,box-shadow,background-color] duration-[var(--motion-fast)] ease-[var(--ease-out)]",
  "placeholder:text-[var(--text-tertiary)] hover:border-[var(--border-strong)]",
  "focus-visible:border-[var(--text-tertiary)] focus-visible:shadow-[0_0_0_3px_var(--geist-gray-alpha-200)] focus-visible:outline-none",
  "disabled:cursor-not-allowed disabled:bg-[var(--surface-subtle)] disabled:text-[var(--text-disabled)] disabled:hover:border-[var(--border)]",
  "aria-invalid:border-[var(--danger-solid)] aria-invalid:focus-visible:shadow-[0_0_0_3px_var(--danger-soft)]",
].join(" ");

/** Geist Input — 36px tall, subtle border, strong focus halo. */
export const inputClass = cn(controlBase, "h-9 px-3 text-sm");
/** Denser variant for toolbars and inline rows. */
export const inputCompactClass = cn(controlBase, "h-8 px-2.5 text-[13px]");

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { compact?: boolean; mono?: boolean }
>(function Input({ className, compact, mono, ...props }, ref) {
  return (
    <input
      className={cn(
        compact ? inputCompactClass : inputClass,
        mono && "font-mono text-[13px]",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { mono?: boolean }
>(function Textarea({ className, mono, ...props }, ref) {
  return (
    <textarea
      className={cn(
        controlBase,
        "min-h-24 resize-y px-3 py-2 text-sm leading-5",
        mono && "font-mono text-[12px] leading-[18px]",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});

/** Native select styled as Geist Select — keeps platform pickers on touch devices. */
export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { compact?: boolean; wrapperClassName?: string }
>(function Select({ className, compact, wrapperClassName, children, ...props }, ref) {
  return (
    <span className={cn("relative inline-flex w-full", wrapperClassName)}>
      <select
        className={cn(
          compact ? inputCompactClass : inputClass,
          "cursor-pointer appearance-none pr-8",
          className,
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-[var(--text-tertiary)]"
      />
    </span>
  );
});

type ControlElement = ReactElement<{
  id?: string | undefined;
  "aria-describedby"?: string | undefined;
  "aria-invalid"?: boolean | undefined;
}>;

/**
 * Label + control + help + inline error. Wires `id`, `aria-describedby`, and `aria-invalid`
 * onto the single child control so every field is accessible by default.
 */
export function Field({
  children,
  className,
  description,
  error,
  label,
  labelAction,
  optional,
}: {
  children: ReactNode;
  className?: string;
  description?: ReactNode;
  error?: ReactNode;
  label: ReactNode;
  labelAction?: ReactNode;
  optional?: boolean;
}) {
  const generatedId = useId();
  const child = isValidElement(children) ? (children as ControlElement) : undefined;
  const id = child?.props.id ?? generatedId;
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [child?.props["aria-describedby"], descriptionId, errorId].filter(Boolean).join(" ") ||
    undefined;
  return (
    <div className={cn("min-w-0", className)}>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <label className="text-[13px] font-medium text-[var(--text-primary)]" htmlFor={id}>
          {label}
          {optional && (
            <span className="ml-1.5 font-normal text-[var(--text-tertiary)]">Optional</span>
          )}
        </label>
        {labelAction}
      </div>
      {child
        ? cloneElement(child, {
            id,
            "aria-describedby": describedBy,
            ...(error ? { "aria-invalid": true } : {}),
          })
        : children}
      {description && !error && (
        <p
          className="mt-1.5 text-xs leading-[18px] text-[var(--text-secondary)]"
          id={descriptionId}
        >
          {description}
        </p>
      )}
      {error && (
        <p
          className="mt-1.5 flex animate-[enter_var(--motion-fast)_var(--ease-out)] items-start gap-1 text-xs leading-[18px] text-[var(--danger)]"
          id={errorId}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

/** Horizontal option with title and description — used for toggles and checkboxes. */
export function ChoiceRow({
  children,
  className,
  control,
  description,
  title,
}: {
  children?: ReactNode;
  className?: string;
  control: ReactNode;
  description?: ReactNode;
  title: ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-[var(--radius-control)] py-1 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60",
        className,
      )}
    >
      <span className="mt-0.5 flex">{control}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium">{title}</span>
        {description && (
          <span className="mt-0.5 block text-xs leading-[18px] text-[var(--text-secondary)]">
            {description}
          </span>
        )}
        {children}
      </span>
    </label>
  );
}
