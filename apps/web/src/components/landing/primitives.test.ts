// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { highlightLine, type Language } from "./highlight";

function tokens(line: string, language: Language) {
  const { container } = render(createElement("code", null, ...highlightLine(line, language)));
  return {
    text: container.textContent,
    spans: Array.from(container.querySelectorAll("span"), (span) => span.textContent),
  };
}

describe("highlightLine", () => {
  it("keeps the original text intact", () => {
    for (const [line, language] of [
      ["  - field: user.groups", "yaml"],
      ['  "scope": "openid profile media:read",', "json"],
      ['curl -u "$ID:$SECRET" \\', "bash"],
      ["const url = client.buildAuthorizationUrl(config, {", "ts"],
    ] as Array<[string, Language]>) {
      expect(tokens(line, language).text).toBe(line);
    }
  });

  it("separates YAML keys from their values", () => {
    const { spans } = tokens("  scopes: [openid, profile, media:read]", "yaml");
    expect(spans).toContain("scopes");
    expect(spans).toContain("media:read");
  });

  it("marks JSON keys apart from string values", () => {
    const { spans } = tokens('  "aud": "itsagram-web",', "json");
    expect(spans).toEqual(['"aud"', ":", '"itsagram-web"', ","]);
  });

  it("treats shell comments as comments", () => {
    const { spans } = tokens("# Exchange the authorization code", "bash");
    expect(spans).toEqual(["# Exchange the authorization code"]);
  });
});
