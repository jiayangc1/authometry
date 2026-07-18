"use client";

import { useEffect } from "react";

export function useUnsavedChanges(enabled: boolean) {
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
  }, [enabled]);
}
