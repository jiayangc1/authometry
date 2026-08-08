// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useUnsavedChanges } from "./use-unsaved-changes";

describe("useUnsavedChanges", () => {
  it("only warns while unsaved changes are enabled", () => {
    const preventDefault = vi.fn();
    const { rerender, unmount } = renderHook(({ enabled }) => useUnsavedChanges(enabled), {
      initialProps: { enabled: false },
    });

    window.dispatchEvent(Object.assign(new Event("beforeunload"), { preventDefault }));
    expect(preventDefault).not.toHaveBeenCalled();

    rerender({ enabled: true });
    window.dispatchEvent(Object.assign(new Event("beforeunload"), { preventDefault }));
    expect(preventDefault).toHaveBeenCalledOnce();

    unmount();
    window.dispatchEvent(Object.assign(new Event("beforeunload"), { preventDefault }));
    expect(preventDefault).toHaveBeenCalledOnce();
  });
});
