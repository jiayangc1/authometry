// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { LandingPage } from "./landing-page";
import { PlatformPage } from "./platform-page";

beforeAll(() => {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: false,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(cleanup);

function anchors(container: HTMLElement) {
  return Array.from(container.querySelectorAll("a[href*='#']"), (link) =>
    link.getAttribute("href"),
  ).filter((href): href is string => href !== null);
}

/** Resolves each hash link rendered on `page` to the path whose section it must exist on. */
function targets(page: "/" | "/platform", hrefs: string[]) {
  return hrefs.map((href) => {
    const [path, id] = href.split("#") as [string, string];
    return { path: path === "" ? page : path, id };
  });
}

describe("landing page structure", () => {
  it("tells one story in three chapters", () => {
    const { container } = render(createElement(LandingPage));
    const chapters = Array.from(container.querySelectorAll("h2"), (heading) => heading.id);
    expect(chapters.indexOf("traces-title")).toBeLessThan(chapters.indexOf("black-box-title"));
    expect(chapters.indexOf("black-box-title")).toBeLessThan(chapters.indexOf("developers-title"));
    for (const moved of ["flow", "configuration", "standards", "agents", "events", "security"])
      expect(container.querySelector(`#${moved}`)).toBeNull();
  });

  it("uses one starting destination for every primary action", () => {
    const { container } = render(createElement(LandingPage));
    const starts = Array.from(
      container.querySelectorAll("a[href='/docs/getting-started']"),
      (link) => link.textContent?.trim(),
    );
    expect(starts).toEqual(
      expect.arrayContaining([
        "Get started",
        "Read the quickstart",
        "Follow the setup guide",
        "Get started with Authometry",
      ]),
    );
  });

  it("links only to sections that exist", () => {
    const landing = render(createElement(LandingPage)).container;
    const links = targets("/", anchors(landing));
    const landingIds = new Set(Array.from(landing.querySelectorAll("[id]"), (node) => node.id));
    cleanup();
    const platform = render(createElement(PlatformPage)).container;
    links.push(...targets("/platform", anchors(platform)));
    const platformIds = new Set(Array.from(platform.querySelectorAll("[id]"), (node) => node.id));

    for (const { path, id } of links) {
      const ids = path === "/" ? landingIds : platformIds;
      expect(ids.has(id), `${path}#${id}`).toBe(true);
    }
  });
});
