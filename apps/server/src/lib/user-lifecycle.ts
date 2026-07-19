import { randomUUID } from "node:crypto";

export const userLifecycleEvents = ["user.created", "user.deleted"] as const;

export interface IdentityUserLifecycleRow {
  id: string;
  email: string;
  name: string;
  groups: string[];
  status: string;
  email_verified_at: Date | string | null;
}

export function userLifecycleData(user: IdentityUserLifecycleRow) {
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      groups: user.groups,
      status: user.status,
      emailVerified: Boolean(user.email_verified_at),
    },
  };
}

export function createProvisioningEventBody(
  type: (typeof userLifecycleEvents)[number],
  user: IdentityUserLifecycleRow,
  createdAt = new Date(),
) {
  return {
    id: randomUUID(),
    type,
    summary: `${user.email} ${type === "user.created" ? "created" : "deleted"}`,
    severity: type === "user.created" ? "info" : "warning",
    resourceType: "user",
    resourceId: user.id,
    data: userLifecycleData(user),
    createdAt: createdAt.toISOString(),
  };
}
