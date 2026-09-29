"use client";

import {
  AppWindow,
  Check,
  FileCode2,
  GitBranch,
  GitPullRequest,
  KeyRound,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import styles from "./git-config.module.css";
import { diffStat, manifestFiles, pipelines, type ManifestFile } from "./git-config-data";
import base from "./landing.module.css";
import { Container, DemoBadge, SectionLabel, cx, highlightLine } from "./primitives";

const kindIcon: Record<ManifestFile["kind"], LucideIcon> = {
  Application: AppWindow,
  Scope: KeyRound,
  Policy: ShieldCheck,
};

export function GitConfig() {
  const [fileIndex, setFileIndex] = useState(0);
  const [block, setBlock] = useState<string | null>(null);
  const [pipeline, setPipeline] = useState(pipelines[0]!.id);
  const id = useId();
  const file = manifestFiles[fileIndex]!;

  function selectFile(index: number) {
    setFileIndex(index);
    setBlock(null);
  }

  function onTabKey(event: KeyboardEvent, index: number) {
    const moves: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1 };
    const target = moves[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const next = (target + manifestFiles.length) % manifestFiles.length;
    selectFile(next);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  }

  const activePipeline = pipelines.find((item) => item.id === pipeline)!;

  return (
    <section aria-labelledby="config-title" className={styles.section} id="configuration">
      <Container>
        <div className={styles.head}>
          <SectionLabel>configuration</SectionLabel>
          <h2 className={cx(base.h2, styles.title)} id="config-title">
            Auth configuration belongs in your workflow.
          </h2>
          <div className={styles.lede}>
            <p className={base.lead}>
              Define applications, scopes, claims, and policies as YAML next to your code. Each
              environment is a target; every change is a pull request.
            </p>
            <ol className={styles.verbs}>
              <li>
                <span>Review</span>
                <code>git diff</code>
              </li>
              <li>
                <span>Validate</span>
                <code>authometry validate</code>
              </li>
              <li>
                <span>Plan</span>
                <code>authometry plan</code>
              </li>
              <li>
                <span>Deploy</span>
                <code>authometry apply</code>
              </li>
            </ol>
          </div>
        </div>

        <DemoBadge className={base.demoBadgeAbove} />
        <div className={styles.workspace}>
          <div className={cx(base.darkWindow, styles.editor)}>
            <div className={styles.pr}>
              <GitPullRequest aria-hidden="true" className={styles.prIcon} />
              <div className={styles.prText}>
                <p>
                  Restrict Itsagram media to workspace members <span>#184</span>
                </p>
                <p className={styles.prMeta}>
                  <GitBranch aria-hidden="true" />
                  jiayang wants to merge <code>media-access</code> into <code>main</code>
                </p>
              </div>
              <p className={styles.prChecks}>
                <span>
                  <Check aria-hidden="true" /> validate
                </span>
                <span>
                  <Check aria-hidden="true" /> plan
                </span>
                <span className={styles.stat}>
                  <b>+{diffStat.added}</b> <i>−{diffStat.removed}</i>
                </span>
              </p>
            </div>

            <div aria-label="Changed files" className={styles.tabs} role="tablist">
              {manifestFiles.map((item, index) => (
                <button
                  aria-controls={`${id}-code`}
                  aria-selected={index === fileIndex}
                  className={styles.tab}
                  id={`${id}-tab-${index}`}
                  key={item.id}
                  onClick={() => selectFile(index)}
                  onKeyDown={(event) => onTabKey(event, index)}
                  role="tab"
                  tabIndex={index === fileIndex ? 0 : -1}
                  type="button"
                >
                  <FileCode2 aria-hidden="true" />
                  <span>{item.path}</span>
                  <em data-status={item.status}>{item.status === "added" ? "A" : "M"}</em>
                </button>
              ))}
            </div>

            <div
              aria-labelledby={`${id}-tab-${fileIndex}`}
              className={styles.code}
              id={`${id}-code`}
              role="tabpanel"
              tabIndex={0}
            >
              <pre>
                <code>
                  {file.lines.map(([text, lineBlock, added], index) => (
                    <span
                      className={styles.line}
                      data-added={Boolean(added)}
                      data-block={lineBlock ?? undefined}
                      data-lit={block !== null && block === lineBlock}
                      key={`${file.id}-${index}`}
                      onPointerEnter={() => lineBlock && setBlock(lineBlock)}
                      onPointerLeave={() => setBlock(null)}
                    >
                      <span aria-hidden="true" className={styles.gutter}>
                        {index + 1}
                      </span>
                      <span aria-hidden="true" className={styles.sign}>
                        {added ? "+" : ""}
                      </span>
                      <span className={styles.text}>{highlightLine(text, "yaml")}</span>
                      {"\n"}
                    </span>
                  ))}
                </code>
              </pre>
            </div>
          </div>

          <div className={styles.interpreted}>
            <p className={styles.interpretedLabel}>
              What Authometry applies to <code>production</code>
            </p>
            <div className={styles.resources}>
              {manifestFiles.map((item, index) => {
                const Icon = kindIcon[item.kind];
                const active = index === fileIndex;
                return (
                  <article
                    aria-label={`${item.kind} ${item.path}`}
                    className={styles.resource}
                    data-active={active}
                    key={item.id}
                  >
                    <button
                      aria-pressed={active}
                      className={styles.resourceHead}
                      onClick={() => selectFile(index)}
                      type="button"
                    >
                      <span className={styles.resourceIcon}>
                        <Icon aria-hidden="true" />
                      </span>
                      <span className={styles.resourceTitle}>
                        <span>{item.kind}</span>
                        <strong>{resourceTitle[item.id]}</strong>
                      </span>
                      <span
                        className={cx(
                          base.chip,
                          item.status === "added" ? base.chipAllow : base.chipWarn,
                        )}
                      >
                        {item.status === "added" ? "Create" : "Update"}
                      </span>
                    </button>
                    {active && (
                      <div className={styles.resourceBody}>
                        {resourceRows[item.id].map((row) => (
                          <div
                            className={styles.row}
                            data-lit={block === row.block}
                            key={row.block}
                            onClick={() =>
                              setBlock((value) => (value === row.block ? null : row.block))
                            }
                            onPointerEnter={(event) =>
                              event.pointerType === "mouse" && setBlock(row.block)
                            }
                            onPointerLeave={(event) =>
                              event.pointerType === "mouse" && setBlock(null)
                            }
                          >
                            <span className={styles.rowLabel}>{row.label}</span>
                            <span className={styles.rowValue}>{row.value}</span>
                          </div>
                        ))}
                        <p className={styles.source}>
                          Managed by manifest <code>{item.path}</code>
                        </p>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </div>

        <div className={cx(base.darkWindow, styles.terminal)}>
          <div className={styles.terminalBar}>
            <span className={styles.terminalTitle}>CI</span>
            <div aria-label="Pipeline" className={styles.segments} role="group">
              {pipelines.map((item) => (
                <button
                  aria-pressed={item.id === pipeline}
                  key={item.id}
                  onClick={() => setPipeline(item.id)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <pre className={styles.terminalBody} key={activePipeline.id} tabIndex={0}>
            <code>
              {activePipeline.steps.map((step) => (
                <span key={step.command}>
                  <span className={styles.prompt}>$ </span>
                  <span className={styles.command}>{step.command}</span>
                  {"\n"}
                  {step.output.map(([text, tone], index) => (
                    <span className={styles.out} data-tone={tone} key={index}>
                      {text}
                      {"\n"}
                    </span>
                  ))}
                  {"\n"}
                </span>
              ))}
            </code>
          </pre>
        </div>
      </Container>
    </section>
  );
}

const resourceTitle: Record<ManifestFile["id"], string> = {
  application: "Itsagram Web",
  scope: "media:read",
  policy: "Workspace member",
};

const resourceRows: Record<
  ManifestFile["id"],
  Array<{ block: string; label: string; value: ReactNode }>
> = {
  application: [
    {
      block: "identity",
      label: "Application",
      value: (
        <>
          <code>itsagram-web</code> <span className={styles.muted}>web, confidential</span>
        </>
      ),
    },
    {
      block: "redirects",
      label: "Redirect URIs",
      value: (
        <>
          <code>https://itsagram.com/auth/callback</code>
          <span className={styles.muted}>exact match only</span>
        </>
      ),
    },
    {
      block: "grants",
      label: "Grants",
      value: <code>authorization_code, refresh_token</code>,
    },
    {
      block: "scopes",
      label: "Scopes",
      value: (
        <span className={styles.scopes}>
          <span className={base.scope}>openid</span>
          <span className={base.scope}>profile</span>
          <span className={cx(base.scope, styles.newScope)}>media:read</span>
        </span>
      ),
    },
    {
      block: "security",
      label: "Security",
      value: <span>PKCE required, consent required, rotating refresh tokens</span>,
    },
    {
      block: "tokens",
      label: "Lifetimes",
      value: (
        <span>
          Access <code>15m</code>, refresh <code>30d</code>
        </span>
      ),
    },
    {
      block: "auth",
      label: "Client auth",
      value: (
        <>
          <code>client_secret_basic</code>
          <span className={styles.muted}>secret read from $ITSAGRAM_CLIENT_SECRET at apply</span>
        </>
      ),
    },
  ],
  scope: [
    {
      block: "value",
      label: "Scope",
      value: (
        <>
          <code>media:read</code> <span className={styles.muted}>Read media</span>
        </>
      ),
    },
    {
      block: "consent",
      label: "Consent screen",
      value: (
        <span className={styles.consent}>
          <span>Itsagram Web wants to</span>
          <strong>View your media</strong>
        </span>
      ),
    },
    {
      block: "sensitivity",
      label: "Sensitivity",
      value: <span className={base.chip}>standard</span>,
    },
  ],
  policy: [
    {
      block: "identity",
      label: "Policy",
      value: (
        <>
          Workspace member <span className={cx(base.chip, base.chipAllow)}>Enabled</span>
        </>
      ),
    },
    {
      block: "applications",
      label: "Applies to",
      value: <code>itsagram-web</code>,
    },
    {
      block: "match",
      label: "All must match",
      value: (
        <span className={styles.condition}>
          <code>user.groups</code>
          <span>contains</span>
          <code>bellaire-media</code>
        </span>
      ),
    },
    {
      block: "decision",
      label: "Then",
      value: <span className={cx(base.chip, base.chipAllow)}>Allow</span>,
    },
    {
      block: "otherwise",
      label: "Otherwise",
      value: (
        <>
          <span className={cx(base.chip, base.chipDeny)}>Deny</span>
          <code>access_denied</code>
          <span className={styles.muted}>A Bellaire Media workspace account is required.</span>
        </>
      ),
    },
  ],
};
