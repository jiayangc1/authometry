"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { scenario } from "./demo-data";
import styles from "./event-stream.module.css";
import base from "./landing.module.css";
import { Container, SectionLabel, cx, highlightLine } from "./primitives";
import { useInView } from "./use-motion";
import { usePrefersReducedMotion } from "./use-reduced-motion";

type Source = "trace" | "audit" | "security";
type Channel = "Webhook" | "API" | "MCP";

interface EventTemplate {
  source: Source;
  type: string;
  summary: string;
  ref: string;
  tone: "ok" | "deny" | "info" | "high";
  resourceType?: string;
}

const templates: EventTemplate[] = [
  {
    source: "trace",
    type: "authorization_code_issued",
    summary: "Itsagram Web, maya@bellaire.media",
    ref: scenario.requestId,
    tone: "ok",
  },
  {
    source: "trace",
    type: "token_request",
    summary: "Itsagram Web, token issued",
    ref: "req_Kp2vN8sLq0",
    tone: "ok",
  },
  {
    source: "audit",
    type: "user.groups_updated",
    summary: "maya@bellaire.media groups changed",
    ref: "user",
    tone: "info",
    resourceType: "user",
  },
  {
    source: "trace",
    type: "policy_denied",
    summary: "Workspace member denied the request",
    ref: scenario.deniedRequestId,
    tone: "deny",
  },
  {
    source: "audit",
    type: "configuration.applied",
    summary: "Applied 3 configuration changes",
    ref: "deployment",
    tone: "info",
    resourceType: "deployment",
  },
  {
    source: "trace",
    type: "authorization_request",
    summary: "invalid_scope: media:write is not assigned",
    ref: scenario.scopeRequestId,
    tone: "deny",
  },
  {
    source: "security",
    type: "refresh_token_reuse",
    summary: "A rotated refresh token was reused. The token family was revoked.",
    ref: "token_family",
    tone: "high",
    resourceType: "token_family",
  },
  {
    source: "audit",
    type: "application.created",
    summary: "Itsagram Studio registered",
    ref: "application",
    tone: "info",
    resourceType: "application",
  },
];

interface StreamEvent extends EventTemplate {
  id: number;
  time: string;
}

const channels = (event: StreamEvent): Channel[] =>
  event.source === "trace" ? ["API", "MCP"] : ["Webhook", "API"];

function clock(seconds: number): string {
  const total = 16 * 3600 + 12 * 60 + seconds;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((value) => String(value).padStart(2, "0")).join(":");
}

function make(index: number): StreamEvent {
  const template = templates[index % templates.length]!;
  return { ...template, id: index, time: clock(index * 3) };
}

const initial = Array.from({ length: 6 }, (_, index) => make(5 - index));

export function EventStream() {
  const [events, setEvents] = useState<StreamEvent[]>(initial);
  const [selected, setSelected] = useState<StreamEvent>(initial[0]!);
  const [channel, setChannel] = useState<Channel>("API");
  const [paused, setPaused] = useState(false);
  const reduceMotion = usePrefersReducedMotion();
  const panel = useRef<HTMLDivElement>(null);
  const inView = useInView(panel, { amount: 0.3 });
  const counter = useRef(initial.length);
  const id = useId();

  useEffect(() => {
    if (!inView || paused || reduceMotion) return;
    const timer = window.setInterval(() => {
      const next = make(counter.current++);
      setEvents((current) => [next, ...current].slice(0, 7));
    }, 2600);
    return () => window.clearInterval(timer);
  }, [inView, paused, reduceMotion]);

  function select(event: StreamEvent) {
    setSelected(event);
    if (!channels(event).includes(channel)) setChannel(channels(event)[0]!);
  }

  const available = channels(selected);
  const activeChannel = available.includes(channel) ? channel : available[0]!;

  return (
    <section aria-labelledby="events-title" className={styles.section} id="events">
      <Container>
        <div className={styles.head}>
          <div>
            <SectionLabel>events</SectionLabel>
            <h2 className={cx(base.h2, styles.title)} id="events-title">
              Your auth system should speak your language.
            </h2>
          </div>
          <div className={styles.copy}>
            <p className={base.lead}>
              Every request becomes a trace; every change becomes an audit event. Read them from the
              dashboard, the management API, or an MCP client — or have them pushed to you as signed
              webhooks.
            </p>
            <ul className={styles.channels}>
              <li>
                <strong>Signed webhooks</strong>
                <span>HMAC-SHA-256 over timestamp and body, retried with exponential backoff</span>
              </li>
              <li>
                <strong>Management API</strong>
                <span>
                  <code>/api/v1/traces</code> and <code>/api/v1/events</code> with scoped tokens
                </span>
              </li>
              <li>
                <strong>MCP tools</strong>
                <span>
                  <code>list_authorization_traces</code>, <code>get_authorization_trace</code>
                </span>
              </li>
              <li>
                <strong>Request IDs</strong>
                <span>
                  <code>x-request-id</code> on every response, for your own logs
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className={styles.console} ref={panel}>
          <div className={cx(base.darkWindow, styles.stream)}>
            <div className={styles.streamBar}>
              <p>
                <span
                  aria-hidden="true"
                  className={styles.live}
                  data-paused={paused || !!reduceMotion}
                />
                production
                <span className={styles.dim}>traces and audit events</span>
              </p>
              {!reduceMotion && (
                <button
                  aria-pressed={paused}
                  className={styles.pause}
                  onClick={() => setPaused((value) => !value)}
                  type="button"
                >
                  {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
                  {paused ? "Resume" : "Pause"}
                </button>
              )}
            </div>
            <ul aria-label="Recent events" className={styles.rows}>
              {events.map((event) => (
                <li key={event.id}>
                  <button
                    aria-pressed={selected.id === event.id}
                    className={styles.row}
                    data-tone={event.tone}
                    onClick={() => select(event)}
                    type="button"
                  >
                    <span className={styles.time}>{event.time}</span>
                    <span className={styles.source} data-source={event.source}>
                      {event.source}
                    </span>
                    <span className={styles.type}>{event.type}</span>
                    <span className={styles.summary}>{event.summary}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className={cx(base.darkWindow, styles.delivery)}>
            <div aria-label="Delivery channel" className={styles.tabs} role="tablist">
              {available.map((item) => (
                <button
                  aria-controls={`${id}-delivery`}
                  aria-selected={item === activeChannel}
                  id={`${id}-${item}`}
                  key={item}
                  onClick={() => setChannel(item)}
                  role="tab"
                  type="button"
                >
                  {item}
                </button>
              ))}
              <span className={styles.selectedType}>{selected.type}</span>
            </div>
            <pre
              aria-labelledby={`${id}-${activeChannel}`}
              className={styles.payload}
              id={`${id}-delivery`}
              key={`${selected.id}-${activeChannel}`}
              role="tabpanel"
              tabIndex={0}
            >
              <code>
                {render(selected, activeChannel)
                  .split("\n")
                  .map((line, index) => (
                    <span key={index}>
                      {line.startsWith("{") || line.startsWith(" ") || line.startsWith("}")
                        ? highlightLine(line, "json")
                        : highlightHttp(line)}
                      {"\n"}
                    </span>
                  ))}
              </code>
            </pre>
          </div>
        </div>
        <p className={base.caption}>
          Event types and payload fields match what Authometry records and delivers. Webhooks carry
          audit and security events; traces are read through the API and MCP.
        </p>
      </Container>
    </section>
  );
}

function highlightHttp(line: string) {
  const header = line.match(/^([a-z-]+)(:\s)(.*)$/);
  if (header)
    return (
      <>
        <span className={base.tokKey}>{header[1]}</span>
        <span className={base.tokPunct}>{header[2]}</span>
        {header[3]}
      </>
    );
  const request = line.match(/^(GET|POST|tool)(\s)(.*)$/);
  if (request)
    return (
      <>
        <span className={base.tokString}>{request[1]}</span>
        {request[2]}
        {request[3]}
      </>
    );
  return line;
}

function render(event: StreamEvent, channel: Channel): string {
  const createdAt = `2026-09-28T${event.time}.${String(100 + event.id * 37).slice(-3)}Z`;
  if (channel === "Webhook")
    return `POST https://hooks.bellaire.media/authometry
content-type: application/json
user-agent: Authometry-Webhook/1.0
x-authometry-event: ${event.type}
x-authometry-timestamp: ${1790612000 + event.id * 3}
x-authometry-signature: v1=5f2c9e41d0b7a8…

{
  "type": "${event.type}",
  "summary": "${event.summary}",
  "severity": "${event.tone === "high" ? "high" : "info"}",
  "resourceType": "${event.resourceType ?? event.ref}",
  "environment": { "slug": "production", "issuer": "${scenario.issuer}" },
  "createdAt": "${createdAt}"
}`;
  if (channel === "MCP")
    return `tool get_authorization_trace
{ "traceId": "${event.ref}", "environment": "production" }

{
  "request_id": "${event.ref}",
  "status": "${event.tone === "deny" ? "denied" : "success"}",
  "event_type": "${event.type}",
  "application_name": "Itsagram Web",
  "steps": [ … ]
}`;
  if (event.source === "trace")
    return `GET /api/v1/traces/${event.ref}
authorization: Bearer amt_…

{
  "request_id": "${event.ref}",
  "status": "${event.tone === "deny" ? "denied" : "success"}",
  "event_type": "${event.type}",
  "application_name": "Itsagram Web",
  "client_id": "itsagram-web",
  "started_at": "${createdAt}"
}`;
  return `GET /api/v1/events
authorization: Bearer amt_…

{
  "data": [
    {
      "event_type": "${event.type}",
      "summary": "${event.summary}",
      "severity": "${event.tone === "high" ? "high" : "info"}",
      "resource_type": "${event.resourceType ?? event.ref}",
      "created_at": "${createdAt}"
    }
  ]
}`;
}
