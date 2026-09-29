"use client";

import { Check, ChevronDown, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import styles from "./auth-flow.module.css";
import { scenario } from "./demo-data";
import base from "./landing.module.css";
import { MarkTile, cx } from "./primitives";
import { playKeyframes, type Easing } from "./use-motion";
import { usePrefersReducedMotion } from "./use-reduced-motion";

interface FlowNode {
  id: string;
  kind: string;
  value: string;
  status: string;
  at: number;
  x: number;
  y: number;
  lane: "top" | "bottom";
  meta: Array<[string, string]>;
  emphasis?: boolean;
}

const VIEW = { width: 1200, height: 320 };
const TIMELINE_MS = 120;

const nodes: FlowNode[] = [
  {
    id: "client",
    kind: "Client",
    value: scenario.application.clientId,
    status: "registered client",
    at: 0,
    x: 104,
    y: 64,
    lane: "top",
    meta: [
      ["type", "web"],
      ["auth method", "client_secret_basic"],
      ["environment", scenario.environment],
    ],
  },
  {
    id: "request",
    kind: "Request",
    value: "/oauth/authorize",
    status: "S256 challenge",
    at: 0.4,
    x: 340,
    y: 64,
    lane: "top",
    meta: [
      ["method", "GET"],
      ["response_type", "code"],
      ["scope", scenario.scopes.join(" ")],
      ["code_challenge_method", "S256"],
      ["redirect_uri", scenario.application.redirectUri],
    ],
  },
  {
    id: "authometry",
    kind: "Authometry",
    value: "auth.itsagram.com",
    status: "client verified",
    at: 3.5,
    x: 590,
    y: 64,
    lane: "top",
    emphasis: true,
    meta: [
      ["issuer", scenario.issuer],
      ["request", scenario.requestId],
      ["environment", scenario.environment],
    ],
  },
  {
    id: "identity",
    kind: "Identity",
    value: scenario.user.email,
    status: "session valid",
    at: 41.2,
    x: 590,
    y: 246,
    lane: "bottom",
    meta: [
      ["user", scenario.user.name],
      ["session", "existing"],
      ["user.groups", scenario.user.groups.join(", ")],
    ],
  },
  {
    id: "policy",
    kind: "Policy",
    value: scenario.policy.name,
    status: "matched",
    at: 49.8,
    x: 836,
    y: 246,
    lane: "bottom",
    meta: [
      ["condition", `user.groups contains "${scenario.policy.value}"`],
      ["result", "allow"],
      ["source", scenario.policy.source],
    ],
  },
  {
    id: "consent",
    kind: "Consent",
    value: "3 of 3 scopes",
    status: "stored grant",
    at: 58.9,
    x: 1090,
    y: 246,
    lane: "bottom",
    meta: [
      ["openid", "granted"],
      ["profile", "granted"],
      ["media:read", "granted"],
    ],
  },
  {
    id: "token",
    kind: "Token",
    value: "access_token",
    status: "RS256, 15 min",
    at: 118.9,
    x: 1090,
    y: 64,
    lane: "top",
    meta: [
      ["alg", "RS256"],
      ["kid", scenario.signingKey],
      ["expires_in", "900"],
      ["id_token", "issued"],
    ],
  },
];

/** Wall-clock choreography: time to travel each connector, and time spent evaluating at each node. */
const travel = [380, 380, 520, 400, 420, 620];
const hold = [320, 200, 320, 240, 360, 260, 0];
const mobileStops = [0, 1, 2, 4, 6];

const spans = [
  { label: "GET /oauth/authorize", from: 0, to: 74.6 },
  { label: "POST /oauth/token", from: 97.2, to: 118.9 },
];

type Phase = { index: number; moving: boolean; started: boolean; done: boolean };

function timeAt(progress: number): number {
  const index = Math.min(nodes.length - 2, Math.floor(progress));
  const fraction = Math.min(1, Math.max(0, progress - index));
  const from = nodes[index]!.at;
  const to = nodes[index + 1]!.at;
  return from + (to - from) * fraction;
}

function mobileFill(progress: number): number {
  for (let i = 0; i < mobileStops.length - 1; i++) {
    const from = mobileStops[i]!;
    const to = mobileStops[i + 1]!;
    if (progress <= to) return (i + (progress - from) / (to - from)) / (mobileStops.length - 1);
  }
  return 1;
}

function nodeState(index: number, phase: Phase): "pending" | "active" | "passed" {
  if (!phase.started || index > phase.index) return "pending";
  if (phase.done || index < phase.index || phase.moving) return "passed";
  return "active";
}

export function AuthFlow() {
  const reduceMotion = usePrefersReducedMotion();
  const stop = useRef<(() => void) | null>(null);
  const [phase, setPhase] = useState<Phase>({
    index: 0,
    moving: false,
    started: false,
    done: false,
  });
  const phaseKey = useRef("");
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [explored, setExplored] = useState(false);
  const particle = useRef<SVGCircleElement>(null);
  const trails = useRef<Array<SVGLineElement | null>>([]);
  const ruler = useRef<HTMLDivElement>(null);
  const elapsed = useRef<Array<HTMLElement | null>>([]);
  const mobileRail = useRef<HTMLDivElement>(null);
  const captionId = useId();

  const render = useCallback((value: number) => {
    const index = Math.min(nodes.length - 2, Math.floor(value));
    const fraction = Math.min(1, Math.max(0, value - index));
    const from = nodes[index]!;
    const to = nodes[index + 1]!;
    const x = from.x + (to.x - from.x) * fraction;
    const y = from.y + (to.y - from.y) * fraction;
    particle.current?.setAttribute("cx", String(x));
    particle.current?.setAttribute("cy", String(y));
    trails.current.forEach((line, segment) => {
      if (!line) return;
      const a = nodes[segment]!;
      const b = nodes[segment + 1]!;
      const amount = Math.min(1, Math.max(0, value - segment));
      line.setAttribute("x2", String(a.x + (b.x - a.x) * amount));
      line.setAttribute("y2", String(a.y + (b.y - a.y) * amount));
    });
    const ms = timeAt(value);
    ruler.current?.style.setProperty("--t", String(ms / TIMELINE_MS));
    for (const node of elapsed.current) if (node) node.textContent = `${ms.toFixed(1)} ms`;
    mobileRail.current?.style.setProperty("--fill", String(mobileFill(value)));

    const moving = value - Math.floor(value) > 0.0001;
    const done = value >= nodes.length - 1;
    const key = `${Math.floor(value)}:${moving}:${done}`;
    if (key !== phaseKey.current) {
      phaseKey.current = key;
      setPhase({ index: Math.floor(value), moving, started: true, done });
    }
  }, []);

  const play = useCallback(() => {
    stop.current?.();
    phaseKey.current = "";
    render(0);
    const values: number[] = [0];
    const durations: number[] = [];
    const easings: Easing[] = [];
    hold.forEach((wait, index) => {
      if (wait > 0) {
        values.push(index);
        durations.push(wait);
        easings.push("linear");
      }
      if (index < travel.length) {
        values.push(index + 1);
        durations.push(travel[index]!);
        easings.push([0.55, 0, 0.3, 1]);
      }
    });
    stop.current = playKeyframes(values, durations, easings, render);
  }, [render]);

  useEffect(() => {
    if (reduceMotion) {
      stop.current?.();
      render(nodes.length - 1);
      return;
    }
    const timer = window.setTimeout(play, 650);
    return () => {
      window.clearTimeout(timer);
      stop.current?.();
    };
  }, [play, reduceMotion, render]);

  useEffect(() => {
    if (!pinned) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setPinned(null);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [pinned]);

  const open = pinned ?? hovered;
  const inspect = (id: string) => {
    setHovered(id);
    setExplored(true);
  };
  const decision = !phase.started
    ? "Waiting"
    : phase.index >= 5 || phase.done
      ? "Allowed"
      : "Evaluating";

  return (
    <figure aria-labelledby={captionId} className={styles.figure} data-done={phase.done}>
      <figcaption className={base.srOnly} id={captionId}>
        Authorization flow: itsagram-web sends an authorization request to Authometry, which
        authenticates {scenario.user.email}, matches the {scenario.policy.name} policy, confirms
        consent for {scenario.scopes.join(", ")}, and issues an RS256 access token 118.9
        milliseconds after the request began. Select any step to see its recorded data.
      </figcaption>

      {/* Desktop: two-lane graph over a millisecond ruler */}
      <div className={styles.graph}>
        <div className={styles.canvas}>
          <svg
            aria-hidden="true"
            className={styles.wires}
            preserveAspectRatio="none"
            viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
          >
            {nodes.slice(0, -1).map((node, segment) => {
              const next = nodes[segment + 1]!;
              const hot = open === node.id || open === next.id;
              return (
                <g key={node.id}>
                  <line
                    className={cx(styles.wire, hot && styles.wireHot)}
                    vectorEffect="non-scaling-stroke"
                    x1={node.x}
                    x2={next.x}
                    y1={node.y}
                    y2={next.y}
                  />
                  <line
                    className={styles.trail}
                    ref={(element) => {
                      trails.current[segment] = element;
                    }}
                    vectorEffect="non-scaling-stroke"
                    x1={node.x}
                    x2={node.x}
                    y1={node.y}
                    y2={node.y}
                  />
                </g>
              );
            })}
            <circle
              className={styles.particle}
              cx={nodes[0]!.x}
              cy={nodes[0]!.y}
              ref={particle}
              r="5"
            />
          </svg>

          {nodes.map((node, index) => {
            const state = nodeState(index, phase);
            const show = open === node.id;
            return (
              <div
                className={cx(styles.nodeWrap, node.emphasis && styles.nodeWrapWide)}
                data-lane={node.lane}
                key={node.id}
                style={{
                  left: `${(node.x / VIEW.width) * 100}%`,
                  top: `${(node.y / VIEW.height) * 100}%`,
                }}
              >
                <button
                  aria-describedby={show ? `${captionId}-${node.id}` : undefined}
                  aria-expanded={pinned === node.id}
                  className={cx(styles.node, node.emphasis && styles.nodeEmphasis)}
                  data-state={state}
                  onBlur={() => setHovered((value) => (value === node.id ? null : value))}
                  onClick={() => setPinned((value) => (value === node.id ? null : node.id))}
                  onFocus={() => inspect(node.id)}
                  onPointerEnter={(event) => event.pointerType === "mouse" && inspect(node.id)}
                  onPointerLeave={(event) =>
                    event.pointerType === "mouse" &&
                    setHovered((value) => (value === node.id ? null : value))
                  }
                  type="button"
                >
                  <span className={styles.nodeTop}>
                    {node.emphasis && <MarkTile className={styles.nodeMark} size={16} />}
                    <span className={styles.kind}>{node.kind}</span>
                    <span className={styles.stamp}>
                      {state === "pending" ? "—" : `+${node.at.toFixed(1)}ms`}
                    </span>
                  </span>
                  <span className={styles.value}>{node.value}</span>
                  <span className={styles.status}>
                    <Check aria-hidden="true" />
                    <span>{state === "pending" ? "pending" : node.status}</span>
                  </span>
                </button>
                {index === 0 && !explored && (
                  <span aria-hidden="true" className={styles.cue}>
                    Click a step to inspect its trace
                  </span>
                )}
                {show && (
                  <div className={styles.popover} id={`${captionId}-${node.id}`} role="tooltip">
                    <p className={styles.popoverTitle}>
                      {node.kind}
                      <span>{node.value}</span>
                    </p>
                    <dl>
                      {node.meta.map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                      <div>
                        <dt>recorded</dt>
                        <dd>+{node.at.toFixed(1)} ms</dd>
                      </div>
                    </dl>
                  </div>
                )}
              </div>
            );
          })}

          <dl className={styles.readout} aria-live="off">
            <div>
              <dt>Decision</dt>
              <dd>
                <span className={styles.decision} data-decision={decision.toLowerCase()}>
                  {decision}
                </span>
              </dd>
            </div>
            <div>
              <dt>Elapsed</dt>
              <dd
                ref={(element) => {
                  elapsed.current[0] = element;
                }}
              >
                0.0 ms
              </dd>
            </div>
            <div>
              <dt>Trace</dt>
              <dd className={styles.traceId} data-visible={phase.done}>
                {phase.done ? scenario.requestId : "recording"}
              </dd>
            </div>
          </dl>

          <div className={styles.controls}>
            <p>Click, or tab to, any step to inspect what Authometry recorded.</p>
            {!reduceMotion && (
              <button className={styles.replay} onClick={play} type="button">
                <RotateCcw aria-hidden="true" />
                Replay request
              </button>
            )}
          </div>
        </div>

        <div aria-hidden="true" className={styles.ruler} ref={ruler}>
          <div className={styles.spans}>
            {spans.map((span) => (
              <span
                className={styles.span}
                key={span.label}
                style={
                  {
                    "--from": span.from / TIMELINE_MS,
                    "--to": span.to / TIMELINE_MS,
                  } as CSSProperties
                }
              >
                <span className={styles.spanFill} />
                <span className={styles.spanLabel}>
                  {span.label}
                  <b>{(span.to - span.from).toFixed(1)} ms</b>
                </span>
              </span>
            ))}
          </div>
          <div className={styles.scale}>
            {nodes.map((node, index) => (
              <i
                className={styles.eventTick}
                data-reached={nodeState(index, phase) !== "pending"}
                key={node.id}
                style={{ left: `${(node.at / TIMELINE_MS) * 100}%` }}
              />
            ))}
            <span className={styles.cursor} />
          </div>
          <div className={styles.scaleLabels}>
            {[0, 20, 40, 60, 80, 100, 120].map((ms) => (
              <span key={ms} style={{ left: `${(ms / TIMELINE_MS) * 100}%` }}>
                {ms}
                {ms === 120 ? " ms" : ""}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Compact: the same request as a vertical sequence */}
      <div className={styles.vertical}>
        <dl className={styles.verticalReadout}>
          <div>
            <dt>Decision</dt>
            <dd>
              <span className={styles.decision} data-decision={decision.toLowerCase()}>
                {decision}
              </span>
            </dd>
          </div>
          <div>
            <dt>Elapsed</dt>
            <dd
              ref={(element) => {
                elapsed.current[1] = element;
              }}
            >
              0.0 ms
            </dd>
          </div>
        </dl>
        <p className={styles.verticalCue}>Tap a step to inspect its trace.</p>
        <div className={styles.rail} ref={mobileRail}>
          <ol>
            {mobileStops.map((stop) => {
              const node = nodes[stop]!;
              const state = nodeState(stop, phase);
              const isOpen = expanded === node.id;
              return (
                <li data-emphasis={node.emphasis ?? false} data-state={state} key={node.id}>
                  <button
                    aria-expanded={isOpen}
                    className={styles.row}
                    onClick={() => setExpanded((value) => (value === node.id ? null : node.id))}
                    type="button"
                  >
                    <span aria-hidden="true" className={styles.dot} />
                    <span className={styles.rowBody}>
                      <span className={styles.rowTop}>
                        <span className={styles.kind}>{node.kind}</span>
                        <span className={styles.stamp}>
                          {state === "pending" ? "—" : `+${node.at.toFixed(1)}ms`}
                        </span>
                      </span>
                      <span className={styles.value}>{node.value}</span>
                      <span className={styles.status}>
                        <Check aria-hidden="true" />
                        <span>{state === "pending" ? "pending" : node.status}</span>
                      </span>
                    </span>
                    <span className={styles.rowHint}>{isOpen ? "Hide" : "Inspect"}</span>
                    <ChevronDown aria-hidden="true" className={styles.chevron} />
                  </button>
                  {isOpen && (
                    <dl className={styles.rowMeta}>
                      {node.meta.map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
        <p className={styles.verticalTrace}>
          <span>Trace</span>
          <code data-visible={phase.done}>{phase.done ? scenario.requestId : "recording"}</code>
        </p>
        {!reduceMotion && (
          <button className={styles.replay} onClick={play} type="button">
            <RotateCcw aria-hidden="true" />
            Replay request
          </button>
        )}
      </div>
    </figure>
  );
}
