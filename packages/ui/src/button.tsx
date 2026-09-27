import { Slot, Slottable } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { Spinner } from "./spinner";
import { cn } from "./utils";

export const buttonVariants = cva(
  [
    "pressable relative inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius-control)] font-medium whitespace-nowrap select-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
    "disabled:pointer-events-none disabled:opacity-100 aria-disabled:pointer-events-none",
    "[&_svg]:shrink-0 [&_svg]:transition-transform [&_svg]:duration-[var(--motion-normal)] [&_svg]:ease-[var(--ease-spring)]",
  ],
  {
    variants: {
      variant: {
        primary: [
          "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[var(--shadow-small)] hover:bg-[var(--primary-hover)]",
          "disabled:bg-[var(--geist-gray-100)] disabled:text-[var(--text-disabled)] disabled:shadow-[0_0_0_1px_var(--border)]",
        ],
        secondary: [
          "bg-[var(--surface-raised)] text-[var(--text-primary)] shadow-[0_0_0_1px_var(--border),var(--shadow-small)] hover:bg-[var(--surface-subtle)] hover:shadow-[0_0_0_1px_var(--border-strong),var(--shadow-small)]",
          "disabled:bg-[var(--geist-gray-100)] disabled:text-[var(--text-disabled)] disabled:shadow-[0_0_0_1px_var(--border)]",
        ],
        ghost: [
          "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] active:bg-[var(--surface-active)]",
          "disabled:text-[var(--text-disabled)]",
        ],
        danger: [
          "bg-[var(--danger-solid)] text-white shadow-[var(--shadow-small)] hover:bg-[var(--danger-hover)]",
          "disabled:bg-[var(--geist-gray-100)] disabled:text-[var(--text-disabled)] disabled:shadow-[0_0_0_1px_var(--border)]",
        ],
      },
      size: {
        default: "h-8 px-3 text-[13px]",
        compact: "h-7 gap-1 px-2 text-xs",
        large: "h-10 px-4 text-sm",
        icon: "size-8 p-0",
        "icon-compact": "size-7 p-0",
      },
    },
    defaultVariants: { variant: "secondary", size: "default" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Shows a spinner, keeps the button's width stable, and blocks further presses. */
  loading?: boolean;
}

export function Button({
  asChild,
  children,
  className,
  disabled,
  loading = false,
  size,
  variant,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ size, variant }), className)}
      disabled={asChild ? undefined : disabled || loading}
      {...props}
    >
      {loading && <Spinner className="size-3.5" />}
      <Slottable>{children}</Slottable>
    </Component>
  );
}
