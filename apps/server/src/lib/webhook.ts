export function canonicalWebhookBody(body: Record<string, unknown>): Record<string, unknown> {
  if (typeof body.createdAt !== "string") return body;
  const createdAt = new Date(body.createdAt);
  if (Number.isNaN(createdAt.getTime())) return body;
  return { ...body, createdAt: createdAt.toISOString() };
}
