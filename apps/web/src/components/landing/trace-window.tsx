"use client";

import {
  Check,
  ChevronsUpDown,
  CircleDashed,
  CircleX,
  Download,
  Search,
  type LucideIcon,
} from "lucide-react";
import { useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { navigation } from "@/config/navigation";
import { allowedTrace, clockAt, scenario, type StepStatus, type TraceStepDemo } from "./demo-data";
import base from "./landing.module.css";
import { MarkTile, cx } from "./primitives";
import styles from "./trace-window.module.css";

const statusIcon: Record<StepStatus, LucideIcon> = {
  passed: Check,
  failed: CircleX,
  skipped: CircleDashed,
};

const facts: Array<[string, string, boolean?]> = [
  ["Application", scenario.application.name],
  ["Client ID", scenario.application.clientId, true],
  ["User", scenario.user.email],
  ["Grant", "Authorization Code + PKCE", true],
  ["Endpoint", "GET /oauth/authorize", true],
  ["Environment", "Production"],
  ["Started", `Sep 28, 2026 ${scenario.startedAt}`, true],
  ["Duration", `${scenario.durationMs} ms`, true],
];

const total = scenario.durationMs;

export function TraceWindow() {
  const [selected, setSelected] = useState(4);
  const [playback, setPlayback] = useState<"static" | "armed" | "play">("static");
  const reduceMotion = useReducedMotion();
  const frame = useRef<HTMLDivElement>(null);
  const inView = useInView(frame, { once: true, amount: 0.25 });
  const rows = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (reduceMotion) return;
    if (!inView) setPlayback("armed");
  }, [inView, reduceMotion]);

  useEffect(() => {
    if (inView) setPlayback((value) => (value === "armed" ? "play" : value));
  }, [inView]);

  function select(index: number, focus = false) {
    const next = Math.max(0, Math.min(allowedTrace.length - 1, index));
    setSelected(next);
    if (focus) rows.current[next]?.focus();
  }

  function onKeyDown(event: KeyboardEvent, index: number) {
    const keys: Record<string, number> = {
      ArrowDown: index + 1,
      ArrowUp: index - 1,
      Home: 0,
      End: allowedTrace.length - 1,
    };
    const target = keys[event.key];
    if (target === undefined) return;
    event.preventDefault();
    select(target, true);
  }

  const step = allowedTrace[selected]!;

  return (
    <div className={styles.frame} data-playback={playback} ref={frame}>
      <div className={cx(base.window, styles.window)}>
        <header className={styles.topbar}>
          <MarkTile size={22} />
          <span className={styles.slash}>/</span>
          <span className={styles.switcher}>
            {scenario.workspace}
            <ChevronsUpDown aria-hidden="true" />
          </span>
          <span className={styles.slash}>/</span>
          <span className={styles.switcher}>
            Production
            <ChevronsUpDown aria-hidden="true" />
          </span>
          <span className={styles.search}>
            <Search aria-hidden="true" />
            Search
            <kbd>⌘K</kbd>
          </span>
          <span aria-hidden="true" className={styles.avatar}>
            MO
          </span>
        </header>

        <div className={styles.body}>
          <nav aria-label="Dashboard preview" className={styles.sidebar}>
            {navigation.map((group) => (
              <div key={group.label}>
                <p>{group.label}</p>
                <ul>
                  {group.items.map((item) => (
                    <li data-active={item.href === "/traces"} key={item.href}>
                      <item.icon aria-hidden="true" />
                      {item.label}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className={styles.main}>
            <p className={styles.crumbs}>
              Traces <span>/</span> <code>{scenario.requestId}</code>
            </p>
            <div className={styles.titleRow}>
              <div>
                <div className={styles.titleLine}>
                  <h3>Authorization code issued</h3>
                  <span className={cx(base.chip, base.chipAllow)}>Authorized</span>
                </div>
                <p className={styles.requestId}>{scenario.requestId}</p>
              </div>
              <span className={styles.export}>
                <Download aria-hidden="true" />
                Export JSON
              </span>
            </div>

            <dl className={styles.facts}>
              {facts.map(([label, value, mono]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd className={mono ? styles.monoValue : undefined}>{value}</dd>
                </div>
              ))}
            </dl>

            <div className={styles.split}>
              <ol aria-label="Authorization trace steps" className={styles.steps}>
                {allowedTrace.map((item, index) => {
                  const Icon = statusIcon[item.status];
                  const active = index === selected;
                  const left = (item.offsetMs / total) * 100;
                  const width = Math.max((item.durationMs / total) * 100, 0.9);
                  return (
                    <li
                      className={styles.stepItem}
                      data-active={active}
                      key={item.id}
                      style={{ "--i": index } as CSSProperties}
                    >
                      <button
                        aria-current={active ? "step" : undefined}
                        aria-label={`Step ${index + 1} of ${allowedTrace.length}, ${item.name}, ${item.status} in ${item.durationMs} milliseconds`}
                        className={styles.step}
                        onClick={() => select(index)}
                        onKeyDown={(event) => onKeyDown(event, index)}
                        ref={(element) => {
                          rows.current[index] = element;
                        }}
                        tabIndex={active ? 0 : -1}
                        type="button"
                      >
                        <span className={styles.stepIcon} data-status={item.status}>
                          <Icon aria-hidden="true" />
                        </span>
                        <span className={styles.stepText}>
                          <span className={styles.stepName}>
                            <span>{String(index + 1).padStart(2, "0")}</span>
                            {item.name}
                          </span>
                          <span className={styles.stepSummary}>{item.summary}</span>
                          <span aria-hidden="true" className={styles.bar}>
                            <span style={{ left: `${left}%`, width: `${width}%` }} />
                          </span>
                        </span>
                        <span className={styles.stepTime}>
                          <span>{item.durationMs.toFixed(1)} ms</span>
                          <span>{clockAt(item.offsetMs)}</span>
                        </span>
                      </button>
                      {active && (
                        <div className={styles.inlinePanel}>
                          <StepDetail step={item} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
              <aside aria-label="Selected step" className={styles.inspector}>
                <p className={styles.inspectorMeta}>
                  Step {selected + 1} of {allowedTrace.length}
                  <span>+{step.offsetMs.toFixed(1)} ms</span>
                </p>
                <div className={styles.inspectorHead}>
                  <h4>{step.name}</h4>
                  <span className={cx(base.chip, base.chipAllow)}>Passed</span>
                </div>
                <StepDetail key={step.id} step={step} />
              </aside>
            </div>
          </div>
        </div>
      </div>
      <p className={base.caption}>
        Trace view recreated with demo data. Step names, fields, and decisions match what the
        authorization endpoint records.
      </p>
    </div>
  );
}

function StepDetail({ step }: { step: TraceStepDemo }) {
  return (
    <div className={styles.detail}>
      <p className={styles.description}>{step.description}</p>
      {step.inputs && <FieldList fields={step.inputs} title="Inputs" />}
      {step.outputs && <FieldList fields={step.outputs} title="Outputs" />}
      {step.decision && (
        <div className={styles.decision}>
          <p>
            <span className={cx(base.chip, base.chipAllow)}>
              <Check aria-hidden="true" />
              Allowed
            </span>
          </p>
          <p>{step.decision.reason}</p>
        </div>
      )}
    </div>
  );
}

function FieldList({ fields, title }: { fields: TraceStepDemo["inputs"]; title: string }) {
  return (
    <div className={styles.fields}>
      <p>{title}</p>
      <dl>
        {fields?.map((field) => (
          <div key={field.label}>
            <dt>{field.label}</dt>
            <dd className={field.mono ? styles.monoValue : undefined}>{field.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
