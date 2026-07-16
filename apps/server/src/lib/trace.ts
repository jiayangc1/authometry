import type {
  AuthorizationTrace,
  TraceExplanation,
  TraceField,
  TraceStep,
  TraceStepStatus,
  TraceStatus,
} from "@authometry/domain";
import { performance } from "node:perf_hooks";
import { query } from "../db.js";
import { randomId } from "./crypto.js";

const sensitiveKey = /authorization|cookie|password|secret|token|code(?!_challenge)|assertion/i;

export function redactRecord(input: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      sensitiveKey.test(key) ? "[redacted]" : String(value ?? ""),
    ]),
  );
}

export class TraceRecorder {
  readonly id = crypto.randomUUID();
  readonly requestId = randomId("req", 7);
  readonly startedAt = new Date();
  readonly steps: TraceStep[] = [];
  private readonly startedAtMonotonic = performance.now();
  private lastStepCompletedOffsetMs = 0;

  constructor(
    private readonly context: {
      workspaceId: string;
      environmentId: string;
      endpoint: string;
      method: string;
      eventType: string;
      applicationId?: string;
      applicationName?: string;
      clientId?: string;
      grantType?: string;
      user?: { id: string; email: string; name: string };
      request: { query: Record<string, unknown>; headers: Record<string, unknown> };
    },
  ) {}

  step(
    name: string,
    status: TraceStepStatus,
    summary: string,
    description: string,
    options: {
      durationMs?: number;
      inputs?: TraceField[];
      outputs?: TraceField[];
      decision?: TraceStep["decision"];
      documentationPath?: string;
    } = {},
  ): TraceStep {
    const completedOffsetMs = this.elapsedMs();
    const durationMs =
      options.durationMs ?? Math.max(0, completedOffsetMs - this.lastStepCompletedOffsetMs);
    const step: TraceStep = {
      id: `${this.requestId}_step_${this.steps.length + 1}`,
      index: this.steps.length,
      name,
      status,
      summary,
      description,
      startedOffsetMs: this.lastStepCompletedOffsetMs,
      durationMs,
      ...(options.inputs === undefined ? {} : { inputs: options.inputs }),
      ...(options.outputs === undefined ? {} : { outputs: options.outputs }),
      ...(options.decision === undefined ? {} : { decision: options.decision }),
      ...(options.documentationPath === undefined
        ? {}
        : { documentationPath: options.documentationPath }),
    };
    this.steps.push(step);
    this.lastStepCompletedOffsetMs = completedOffsetMs;
    return step;
  }

  skipRemaining(names: string[]): void {
    const skippedAtOffsetMs = this.elapsedMs();
    for (const name of names) {
      this.steps.push({
        id: `${this.requestId}_step_${this.steps.length + 1}`,
        index: this.steps.length,
        name,
        status: "skipped",
        summary: "Not run",
        description: "This step was not run because an earlier step stopped the request.",
        startedOffsetMs: skippedAtOffsetMs,
      });
    }
  }

  async finish(
    status: TraceStatus,
    options: { oauthError?: string; explanation?: TraceExplanation } = {},
  ): Promise<AuthorizationTrace> {
    const completedAt = new Date();
    const durationMs = this.elapsedMs();
    const trace: AuthorizationTrace = {
      id: this.id,
      workspaceId: this.context.workspaceId,
      requestId: this.requestId,
      status,
      eventType: this.context.eventType,
      applicationId: this.context.applicationId ?? "",
      applicationName: this.context.applicationName ?? "Unknown application",
      clientId: this.context.clientId ?? "unknown",
      ...(this.context.user ? { user: this.context.user } : {}),
      environmentId: this.context.environmentId,
      grantType: this.context.grantType ?? "unknown",
      endpoint: this.context.endpoint,
      method: this.context.method,
      startedAt: this.startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs,
      ...(options.oauthError ? { oauthError: options.oauthError } : {}),
      ...(options.explanation ? { explanation: options.explanation } : {}),
      steps: this.steps,
      request: {
        query: redactRecord(this.context.request.query),
        headers: redactRecord(this.context.request.headers),
      },
    };

    await query(
      `INSERT INTO authorization_traces
        (id, workspace_id, environment_id, request_id, status, event_type, application_id,
         application_name, client_id, user_id, user_snapshot, grant_type, endpoint, method,
         started_at, completed_at, duration_ms, oauth_error, explanation, steps, redacted_request)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
      [
        trace.id,
        trace.workspaceId,
        trace.environmentId,
        trace.requestId,
        trace.status,
        trace.eventType,
        this.context.applicationId ?? null,
        trace.applicationName,
        trace.clientId,
        trace.user?.id ?? null,
        trace.user ? JSON.stringify(trace.user) : null,
        trace.grantType,
        trace.endpoint,
        trace.method,
        trace.startedAt,
        trace.completedAt,
        trace.durationMs,
        trace.oauthError ?? null,
        trace.explanation ? JSON.stringify(trace.explanation) : null,
        JSON.stringify(trace.steps),
        JSON.stringify(trace.request),
      ],
    );
    return trace;
  }

  private elapsedMs(): number {
    return Math.round((performance.now() - this.startedAtMonotonic) * 1_000) / 1_000;
  }
}
