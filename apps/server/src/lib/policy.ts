import type { PolicyCondition } from "@authometry/domain";

export interface PolicyContext {
  environment: string;
  user: { groups: string[]; email: string; [key: string]: unknown };
  application: { id: string; slug: string; type: string };
  request: { scopes: string[]; ipAddress?: string };
}

function getPath(context: PolicyContext, path: string): unknown {
  return path.split(".").reduce<unknown>((value, segment) => {
    if (value && typeof value === "object" && segment in value) {
      return (value as Record<string, unknown>)[segment];
    }
    return undefined;
  }, context);
}

export function evaluateCondition(condition: PolicyCondition, context: PolicyContext): boolean {
  const observed = getPath(context, condition.field);
  switch (condition.operator) {
    case "equals":
      return observed === condition.value;
    case "not_equals":
      return observed !== condition.value;
    case "contains":
      return Array.isArray(observed)
        ? observed.includes(condition.value)
        : typeof observed === "string" && typeof condition.value === "string"
          ? observed.includes(condition.value)
          : false;
    case "in":
      return Array.isArray(condition.value) && condition.value.includes(String(observed));
  }
}

export function evaluateAll(conditions: PolicyCondition[], context: PolicyContext): boolean {
  return conditions.every((condition) => evaluateCondition(condition, context));
}
