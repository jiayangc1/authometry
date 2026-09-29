"use client";

import { ArrowRight, Check, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import styles from "./decision-inspector.module.css";
import { scenario } from "./demo-data";
import base from "./landing.module.css";
import { Container, SectionLabel, cx } from "./primitives";

interface Row {
  label: string;
  a: ReactNode;
  b: ReactNode;
  differs?: boolean;
  consequence?: boolean;
}

const rows: Row[] = [
  { label: "client_id", a: "itsagram-web", b: "itsagram-web" },
  { label: "scope", a: "openid profile media:read", b: "openid profile media:read" },
  { label: "user", a: scenario.user.email, b: scenario.user.email },
  { label: "environment", a: "production", b: "production" },
  {
    label: "user.groups",
    a: (
      <>
        <mark>bellaire-media</mark>, editors
      </>
    ),
    b: (
      <>
        <del>bellaire-media</del> editors
      </>
    ),
    differs: true,
  },
  {
    label: `policy ${scenario.policy.name}`,
    a: (
      <span className={styles.result} data-result="true">
        <Check aria-hidden="true" /> conditions matched
      </span>
    ),
    b: (
      <span className={styles.result} data-result="false">
        <X aria-hidden="true" /> conditions not matched
      </span>
    ),
    consequence: true,
  },
];

export function DecisionInspector() {
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const visible = rows.filter((row) => !onlyDifferences || row.differs || row.consequence);

  return (
    <section aria-labelledby="decisions-title" className={styles.section} id="decisions">
      <Container>
        <div className={styles.head}>
          <SectionLabel>policy.decisions</SectionLabel>
          <h2 className={cx(base.h2, styles.title)} id="decisions-title">
            Compare two decisions.
            <span className={base.h2Muted}> See what changed.</span>
          </h2>
          <p className={base.lead}>
            Same person, same application, same scopes, ninety minutes apart. Authometry keeps both
            requests, so the one attribute that changed is visible — along with the policy condition
            it failed.
          </p>
        </div>

        <div className={styles.board}>
          <div className={styles.toolbar}>
            <p>
              <span className={styles.count}>
                {rows.filter((row) => !row.consequence).length} attributes compared
              </span>
              <span className={cx(base.chip, base.chipSignal)}>1 differs</span>
            </p>
            <button
              aria-checked={onlyDifferences}
              className={styles.switch}
              onClick={() => setOnlyDifferences((value) => !value)}
              role="switch"
              type="button"
            >
              <span aria-hidden="true" className={styles.track}>
                <span />
              </span>
              Only differences
            </button>
          </div>

          <div className={styles.table} role="table" aria-label="Request comparison">
            <div className={cx(styles.row, styles.header)} role="row">
              <span className={styles.attrHead} role="columnheader">
                Attribute
              </span>
              <span role="columnheader">
                <span className={styles.requestHead}>
                  <span className={cx(base.chip, base.chipAllow)}>
                    <Check aria-hidden="true" /> Allowed
                  </span>
                  <code>{scenario.requestId}</code>
                </span>
                <span className={styles.time}>14:32:08</span>
              </span>
              <span role="columnheader">
                <span className={styles.requestHead}>
                  <span className={cx(base.chip, base.chipDeny)}>
                    <X aria-hidden="true" /> Denied
                  </span>
                  <code>{scenario.deniedRequestId}</code>
                </span>
                <span className={styles.time}>16:05:41</span>
              </span>
            </div>
            {visible.map((row) => (
              <div
                className={cx(
                  styles.row,
                  row.differs && styles.differs,
                  row.consequence && styles.consequence,
                )}
                key={row.label}
                role="row"
              >
                <span className={styles.attr} role="rowheader">
                  {row.label}
                  {row.differs && <span className={base.srOnly}> (differs)</span>}
                </span>
                <span className={styles.cell} role="cell">
                  {row.a}
                </span>
                <span className={styles.cell} role="cell">
                  {row.b}
                </span>
              </div>
            ))}
          </div>

          <div className={styles.between}>
            <span className={styles.betweenDot} aria-hidden="true" />
            <p>
              <code>user.groups_updated</code>
              <span className={styles.betweenTime}>15:47:12</span>
              <span>
                An administrator removed {scenario.user.name} from <code>bellaire-media</code>.
              </span>
            </p>
          </div>
        </div>

        <div className={styles.outcome}>
          <div className={styles.condition}>
            <p className={styles.conditionPath}>{scenario.policy.source}</p>
            <pre tabIndex={0}>
              <code>
                <span className={base.tokKey}>match</span>
                <span className={base.tokPunct}>:</span>
                {"\n  "}
                <span className={base.tokKey}>all</span>
                <span className={base.tokPunct}>:</span>
                {"\n    - "}
                <span className={base.tokKey}>field</span>
                <span className={base.tokPunct}>: </span>
                <span className={styles.hl}>user.groups</span>
                {"\n      "}
                <span className={base.tokKey}>operator</span>
                <span className={base.tokPunct}>: </span>
                <span className={base.tokString}>contains</span>
                {"\n      "}
                <span className={base.tokKey}>value</span>
                <span className={base.tokPunct}>: </span>
                <span className={base.tokString}>bellaire-media</span>
                {"\n"}
                <span className={base.tokKey}>decision</span>
                <span className={base.tokPunct}>:</span>
                {"\n  "}
                <span className={base.tokKey}>allow</span>
                <span className={base.tokPunct}>: </span>
                <span className={base.tokKeyword}>true</span>
                {"\n"}
                <span className={base.tokKey}>otherwise</span>
                <span className={base.tokPunct}>:</span>
                {"\n  "}
                <span className={base.tokKey}>deny</span>
                <span className={base.tokPunct}>:</span>
                {"\n    "}
                <span className={base.tokKey}>code</span>
                <span className={base.tokPunct}>: </span>
                <span className={base.tokString}>access_denied</span>
                {"\n    "}
                <span className={base.tokKey}>message</span>
                <span className={base.tokPunct}>: </span>
                <span className={base.tokString}>{scenario.policy.denyMessage}</span>
              </code>
            </pre>
          </div>
          <div className={styles.explanation}>
            <p className={styles.explanationStep}>
              <X aria-hidden="true" />
              Policy: {scenario.policy.displayName}
              <code>{scenario.deniedRequestId}</code>
            </p>
            <h3>Authorization policy denied the request</h3>
            <p>{scenario.policy.denyMessage}</p>
            <div className={styles.fix}>
              <p>How to fix it</p>
              <p>Review the user’s attributes or update the policy conditions.</p>
              <span className={styles.fixAction}>
                Open policy <ArrowRight aria-hidden="true" />
              </span>
            </div>
            <p className={styles.redirect}>
              The client receives <code>error=access_denied</code> with the policy’s message — and
              you keep the reason.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
