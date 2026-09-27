"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/** Read and update URL search parameters without scrolling or adding history entries. */
export function useQueryParams() {
  const router = useRouter();
  const pathname = usePathname();
  const parameters = useSearchParams();
  const update = useCallback(
    (updates: Record<string, string | undefined>) => {
      const next = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(updates)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      const queryString = next.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    },
    [pathname, router],
  );
  return [parameters, update] as const;
}

/**
 * Keeps a text input responsive while syncing its value to the URL after a short pause.
 * `query` is the committed (URL) value to use in fetch keys.
 */
export function useDebouncedSearchParam(key = "q", delay = 250) {
  const [parameters, update] = useQueryParams();
  const query = parameters.get(key) ?? "";
  const [value, setValue] = useState(query);
  const committed = useRef(query);

  useEffect(() => {
    if (value === committed.current) return;
    const timer = window.setTimeout(() => {
      committed.current = value;
      update({ [key]: value.trim() || undefined });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [delay, key, update, value]);

  const clear = useCallback(() => {
    committed.current = "";
    setValue("");
    update({ [key]: undefined });
  }, [key, update]);

  return { value, setValue, query, clear, update, parameters };
}
