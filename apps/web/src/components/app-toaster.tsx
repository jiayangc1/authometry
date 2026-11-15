"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";

/** Sonner defaults to a light theme; follow the dashboard theme instead. */
export function AppToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      closeButton
      position="bottom-right"
      richColors={false}
      theme={resolvedTheme === "dark" ? "dark" : "light"}
    />
  );
}
