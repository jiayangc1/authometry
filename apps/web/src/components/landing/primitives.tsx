import type { ReactNode } from "react";
import { AuthometryMark } from "@authometry/ui";
import styles from "./landing.module.css";

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  return <div className={cx(styles.container, className)}>{children}</div>;
}

/** Measurement ticks crossed by a single event, followed by a resource-style identifier. */
export function SectionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <p className={cx(styles.label, className)}>
      <span aria-hidden="true" className={styles.ruler} />
      <span>{children}</span>
    </p>
  );
}

/** The existing gauge mark, set in an ink tile with the signal accent. */
export function MarkTile({
  size = 28,
  className,
}: {
  size?: number;
  className?: string | undefined;
}) {
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        flex: "none",
        borderRadius: Math.round(size * 0.26),
        background: "var(--ink)",
        color: "var(--paper)",
      }}
    >
      <AuthometryMark
        accent="#ccf24a"
        style={{ width: Math.round(size * 0.72), height: Math.round(size * 0.72) }}
      />
    </span>
  );
}

export type Language = "yaml" | "ts" | "tsx" | "js" | "go" | "swift" | "bash" | "json" | "http";

const keywords: Record<Language, string[]> = {
  yaml: ["true", "false", "null"],
  ts: [
    "import",
    "from",
    "export",
    "const",
    "let",
    "await",
    "async",
    "function",
    "return",
    "new",
    "if",
    "throw",
    "default",
    "type",
  ],
  tsx: [
    "import",
    "from",
    "export",
    "const",
    "let",
    "await",
    "async",
    "function",
    "return",
    "new",
    "if",
    "default",
  ],
  js: ["import", "from", "export", "const", "let", "await", "async", "function", "return", "new"],
  go: ["package", "import", "func", "return", "if", "err", "nil", "var", ":=", "defer", "go"],
  swift: ["import", "let", "var", "func", "guard", "else", "return", "self", "nil", "in", "try"],
  bash: ["curl", "export", "npx", "brew"],
  json: ["true", "false", "null"],
  http: ["GET", "POST", "HTTP/1.1"],
};

const tokenClass = {
  keyword: styles.tokKeyword,
  string: styles.tokString,
  number: styles.tokNumber,
  comment: styles.tokComment,
  key: styles.tokKey,
  punct: styles.tokPunct,
  fn: styles.tokFunction,
  type: styles.tokType,
} as const;

type TokenKind = keyof typeof tokenClass;

/**
 * A deliberately small highlighter: enough to make static samples legible without shipping a
 * grammar engine to the marketing page.
 */
export function highlightLine(line: string, language: Language): ReactNode[] {
  const out: ReactNode[] = [];
  const push = (text: string, kind?: TokenKind) => {
    if (!text) return;
    out.push(
      kind ? (
        <span className={tokenClass[kind]} key={out.length}>
          {text}
        </span>
      ) : (
        text
      ),
    );
  };

  if (language === "yaml") {
    const comment = line.match(/^(\s*)(#.*)$/);
    if (comment) {
      push(comment[1]!);
      push(comment[2]!, "comment");
      return out;
    }
    const pair = line.match(/^(\s*-?\s*)([A-Za-z_][\w./-]*)(:)(\s*)(.*)$/);
    if (pair) {
      push(pair[1]!, pair[1]!.includes("-") ? "punct" : undefined);
      push(pair[2]!, "key");
      push(pair[3]!, "punct");
      push(pair[4]!);
      yamlValue(pair[5]!, push);
      return out;
    }
    const item = line.match(/^(\s*-\s+)(.*)$/);
    if (item) {
      push(item[1]!, "punct");
      yamlValue(item[2]!, push);
      return out;
    }
    push(line);
    return out;
  }

  if (language === "json") {
    let cursor = 0;
    for (const match of line.matchAll(
      /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\b\d+(?:\.\d+)?\b|true|false|null)|([{}[\],])/g,
    )) {
      const index = match.index ?? 0;
      push(line.slice(cursor, index));
      const [text, str, colon, literal, punct] = match;
      if (str && colon) {
        push(str, "key");
        push(colon, "punct");
      } else if (str) push(str, "string");
      else if (literal) push(literal, "number");
      else if (punct) push(punct, "punct");
      else push(text);
      cursor = index + text.length;
    }
    push(line.slice(cursor));
    return out;
  }

  const commentPrefix = language === "bash" ? "#" : "//";
  const pattern =
    /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\/\/.*$|#(?![\w{]).*$)|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_][\w]*\b)(?=\s*\()|([A-Za-z_][\w-]*)(?=:\s)|(\b[A-Z][A-Za-z0-9_]*\b)|(\b[A-Za-z_]+\b|:=)|([{}()[\];,.=<>+|&!?-])/g;
  let last = 0;
  for (const match of line.matchAll(pattern)) {
    const index = match.index ?? 0;
    push(line.slice(last, index));
    const [text, str, comment, num, fn, key, type, word, punct] = match;
    if (str) push(str, "string");
    else if (comment) {
      if (comment.startsWith(commentPrefix) || (language !== "bash" && comment.startsWith("//")))
        push(comment, "comment");
      else push(comment);
    } else if (num) push(num, "number");
    else if (fn) push(fn, keywords[language].includes(fn) ? "keyword" : "fn");
    else if (key) push(key, "key");
    else if (type) push(type, keywords[language].includes(type) ? "keyword" : "type");
    else if (word) push(word, keywords[language].includes(word) ? "keyword" : undefined);
    else if (punct) push(punct, "punct");
    else push(text);
    last = index + text.length;
  }
  push(line.slice(last));
  return out;
}

function yamlValue(value: string, push: (text: string, kind?: TokenKind) => void) {
  if (!value) return;
  const commentIndex = value.indexOf(" #");
  const main = commentIndex >= 0 ? value.slice(0, commentIndex) : value;
  const trailing = commentIndex >= 0 ? value.slice(commentIndex) : "";
  if (/^\d+(\.\d+)?[smhd]?$/.test(main)) push(main, "number");
  else if (/^(true|false|null)$/.test(main)) push(main, "keyword");
  else if (/^\[.*\]$/.test(main)) {
    push("[", "punct");
    main
      .slice(1, -1)
      .split(/(,\s*)/)
      .forEach((part) => push(part, /^,/.test(part) ? "punct" : "string"));
    push("]", "punct");
  } else push(main, "string");
  if (trailing) push(trailing, "comment");
}
