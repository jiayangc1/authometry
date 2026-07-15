// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useHydrated } from "./use-hydrated";

describe("useHydrated", () => {
  it("enables guarded controls after the client mounts", async () => {
    const { result } = renderHook(() => useHydrated());
    await waitFor(() => expect(result.current).toBe(true));
  });
});
