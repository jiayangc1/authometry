export type TraceStatus = "success" | "denied" | "error" | "warning" | "pending";
export type TraceStepStatus = "passed" | "failed" | "warning" | "skipped" | "pending";

export interface TraceField {
  label: string;
  value: string | number | boolean | string[];
  format?: "text" | "code" | "uri" | "duration" | "redacted";
}

export interface TraceDecision {
  outcome: "allowed" | "denied" | "not_applicable";
  reason: string;
}

export interface TraceExplanation {
  code: string;
  title: string;
  message: string;
  observed?: TraceField[];
  expected?: TraceField[];
  resolution: string;
  action?: { label: string; href: string };
  documentationPath?: string;
  securityEvent?: boolean;
}

export interface TraceStep {
  id: string;
  index: number;
  name: string;
  status: TraceStepStatus;
  summary: string;
  description: string;
  startedOffsetMs: number;
  durationMs?: number;
  inputs?: TraceField[];
  outputs?: TraceField[];
  decision?: TraceDecision;
  documentationPath?: string;
}

export interface AuthorizationTrace {
  id: string;
  workspaceId: string;
  requestId: string;
  status: TraceStatus;
  eventType: string;
  applicationId: string;
  applicationName: string;
  clientId: string;
  user?: { id: string; email: string; name: string };
  environmentId: string;
  grantType: string;
  endpoint: string;
  method: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  oauthError?: string;
  explanation?: TraceExplanation;
  steps: TraceStep[];
  request: { query: Record<string, string>; headers: Record<string, string> };
}
