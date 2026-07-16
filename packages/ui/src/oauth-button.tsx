import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes } from "react";
import { AuthometryMark } from "./brand";
import { cn } from "./utils";

export interface AuthometryProviderButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  appearance?: "light" | "dark" | "brand";
  compact?: boolean;
}

export function AuthometryProviderButton({
  asChild,
  appearance = "light",
  children = "Continue with Authometry",
  className,
  compact = false,
  ...props
}: AuthometryProviderButtonProps) {
  const Component = asChild ? Slot : "button";

  return (
    <Component
      className={cn(
        "group inline-flex items-center justify-center gap-2.5 rounded-[10px] border font-semibold tracking-[-0.01em] shadow-[0_1px_2px_rgba(15,23,42,0.08)] transition-[background-color,border-color,box-shadow,transform] focus-visible:ring-2 focus-visible:ring-[#7c73ff] focus-visible:ring-offset-2 focus-visible:outline-none active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
        compact ? "h-9 px-3 text-[13px]" : "h-11 px-4 text-sm",
        appearance === "light" &&
          "border-[#d8d8df] bg-white text-[#18181b] hover:border-[#bbb9cb] hover:bg-[#fafaff] hover:shadow-[0_3px_10px_rgba(49,46,129,0.12)]",
        appearance === "dark" &&
          "border-[#34343a] bg-[#18181b] text-white hover:border-[#575260] hover:bg-[#232326] hover:shadow-[0_3px_12px_rgba(0,0,0,0.3)]",
        appearance === "brand" &&
          "border-[#635bff] bg-[#635bff] text-white hover:border-[#554ce8] hover:bg-[#554ce8] hover:shadow-[0_4px_14px_rgba(99,91,255,0.28)]",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "flex size-6 items-center justify-center rounded-full",
          appearance === "light" ? "bg-[#f0efff]" : "bg-white/10",
        )}
      >
        <AuthometryMark className="size-[17px]" />
      </span>
      <span>{children}</span>
    </Component>
  );
}
