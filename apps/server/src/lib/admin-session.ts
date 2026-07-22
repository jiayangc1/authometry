export const ADMIN_REFRESH_REUSE_GRACE_MS = 15_000;

export function isConcurrentAdminRefresh(rotatedAt: Date, now: Date = new Date()): boolean {
  const age = now.getTime() - rotatedAt.getTime();
  return age >= 0 && age <= ADMIN_REFRESH_REUSE_GRACE_MS;
}
