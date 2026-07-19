import { createHmac } from "node:crypto";
import { query } from "./db.js";
import { decrypt } from "./lib/crypto.js";
import { assertSafeOutboundUrl } from "./lib/security.js";

interface Delivery {
  id: string;
  url: string;
  encrypted_secret: string;
  event_type: string;
  audit_event_id: string;
  body: Record<string, unknown>;
  attempt: number;
}

export async function dispatchPendingWebhooks(): Promise<void> {
  await query(
    `INSERT INTO webhook_deliveries(webhook_id, audit_event_id, event_type, status, redacted_request_body)
     SELECT w.id, e.id, e.event_type, 'pending',
       jsonb_strip_nulls(jsonb_build_object('id', e.id, 'type', e.event_type, 'summary', e.summary,
         'severity', e.severity, 'resourceType', e.resource_type, 'resourceId', e.resource_id,
         'data', CASE WHEN e.event_type IN ('user.created', 'user.deleted') THEN e.changes ELSE NULL END,
         'createdAt', e.created_at))
     FROM webhooks w JOIN audit_events e ON e.environment_id = w.environment_id
     WHERE w.status = 'enabled' AND e.event_type = ANY(w.subscribed_events)
       AND e.created_at > now() - interval '24 hours'
     ON CONFLICT (webhook_id, audit_event_id) WHERE audit_event_id IS NOT NULL DO NOTHING`,
  );
  const deliveries = await query<Delivery>(
    `SELECT d.id, w.url, w.encrypted_secret, d.event_type, d.audit_event_id,
            d.redacted_request_body AS body, d.attempt
     FROM webhook_deliveries d JOIN webhooks w ON w.id = d.webhook_id
     WHERE w.status = 'enabled' AND d.attempt <= 5
       AND (d.status = 'pending' OR d.status = 'failed' AND d.next_retry_at <= now())
     ORDER BY d.created_at FOR UPDATE SKIP LOCKED LIMIT 25`,
  );
  for (const delivery of deliveries) {
    const serialized = JSON.stringify(delivery.body);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac("sha256", decrypt(delivery.encrypted_secret))
      .update(`${timestamp}.${serialized}`)
      .digest("hex");
    const started = Date.now();
    try {
      const url = await assertSafeOutboundUrl(delivery.url);
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "Authometry-Webhook/1.0",
          "x-authometry-delivery": delivery.id,
          "x-authometry-event": delivery.event_type,
          "x-authometry-timestamp": timestamp,
          "x-authometry-signature": `v1=${signature}`,
        },
        body: serialized,
        signal: AbortSignal.timeout(10_000),
      });
      const responseBody = (await response.text()).slice(0, 4096);
      await query(
        `UPDATE webhook_deliveries SET status = $2, response_status = $3,
           response_headers = $4, response_body = $5, duration_ms = $6,
           next_retry_at = CASE WHEN $2 = 'failed' THEN now() + (interval '1 minute' * power(2, LEAST(attempt, 5))) ELSE NULL END,
           attempt = CASE WHEN $2 = 'failed' THEN attempt + 1 ELSE attempt END
         WHERE id = $1`,
        [
          delivery.id,
          response.ok ? "succeeded" : "failed",
          response.status,
          { "content-type": response.headers.get("content-type") },
          responseBody,
          Date.now() - started,
        ],
      );
    } catch (error) {
      await query(
        `UPDATE webhook_deliveries SET status = 'failed', response_body = $2, duration_ms = $3,
           next_retry_at = now() + (interval '1 minute' * power(2, LEAST(attempt, 5))), attempt = attempt + 1
         WHERE id = $1`,
        [
          delivery.id,
          error instanceof Error ? error.message.slice(0, 500) : "Webhook delivery failed.",
          Date.now() - started,
        ],
      );
    }
  }
}

export async function runRetention(): Promise<void> {
  await Promise.all([
    query("DELETE FROM revoked_access_tokens WHERE expires_at < now()"),
    query("DELETE FROM social_login_states WHERE expires_at < now() - interval '1 day'"),
    query("DELETE FROM one_time_tokens WHERE expires_at < now() - interval '1 day'"),
    query("DELETE FROM admin_refresh_sessions WHERE expires_at < now() - interval '30 days'"),
    query("DELETE FROM pending_authorization_requests WHERE expires_at < now() - interval '1 day'"),
    query("DELETE FROM pushed_authorization_requests WHERE expires_at < now() - interval '1 day'"),
    query("DELETE FROM agent_assertion_jtis WHERE expires_at < now()"),
    query("DELETE FROM dpop_proof_jtis WHERE expires_at < now()"),
    query(
      "UPDATE delegation_grants SET status = 'expired' WHERE status = 'active' AND expires_at <= now()",
    ),
    query(`DELETE FROM authorization_traces t USING environments e, workspace_settings s
           WHERE t.environment_id = e.id AND s.workspace_id = e.workspace_id
             AND t.created_at < now() - (s.trace_retention_days * interval '1 day')`),
    query(`DELETE FROM audit_events a USING workspace_settings s
           WHERE a.workspace_id = s.workspace_id
             AND a.created_at < now() - (s.audit_retention_days * interval '1 day')`),
    query(
      "UPDATE signing_keys SET status = 'retired' WHERE status = 'retiring' AND retires_at <= now()",
    ),
  ]);
}
