import assert from "node:assert/strict";
import test from "node:test";
import {
  isLocationWithinResource,
  maximumUsage,
  reduceAuthorizationDetails,
  type AgentAuthorizationDetails,
} from "./agents.js";

const details: AgentAuthorizationDetails[] = [
  {
    type: "agent_action",
    actions: ["read", "create", "delete"],
    locations: ["https://calendar.example.com/events"],
    resource: "calendar",
    constraints: { maximum_events: 1 },
  },
];

await test("resource locations reject lookalike hosts", () => {
  assert.equal(
    isLocationWithinResource(
      "https://calendar.example.com/events/1",
      "https://calendar.example.com",
    ),
    true,
  );
  assert.equal(
    isLocationWithinResource(
      "https://calendar.example.com.attacker.test/events",
      "https://calendar.example.com",
    ),
    false,
  );
});

await test("child authorization details monotonically reduce with scope", () => {
  assert.deepEqual(
    reduceAuthorizationDetails(details, ["calendar.events:read", "calendar.events:create"])[0]
      ?.actions,
    ["read", "create"],
  );
  assert.deepEqual(reduceAuthorizationDetails(details, ["calendar.events:update"]), []);
});

await test("the narrowest structured usage limit wins", () => {
  assert.equal(maximumUsage(details), 1);
  assert.equal(
    maximumUsage([
      {
        type: "agent_action",
        actions: ["read"],
        locations: ["https://calendar.example.com/events"],
        resource: "calendar",
      },
    ]),
    null,
  );
});
