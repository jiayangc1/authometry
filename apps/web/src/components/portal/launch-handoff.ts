interface LaunchApplication {
  name: string;
  description?: string;
  logo_uri?: string | null;
}

interface LaunchContext {
  workspaceName?: string | undefined;
  userEmail?: string | undefined;
  dark: boolean;
}

const brandMark = `<svg aria-hidden="true" fill="none" viewBox="0 0 32 32"><path d="M14.25 3.35A12.75 12.75 0 1 0 27.55 18.75" stroke="currentColor" stroke-linecap="round" stroke-width="2.35" /><path d="M17.8 3.65a12.75 12.75 0 0 1 9.65 9.2" stroke="#635bff" stroke-linecap="round" stroke-width="2.35" /><path d="M23.45 11.7a8.5 8.5 0 1 0 0 8.6" stroke="currentColor" stroke-linecap="round" stroke-width="1.9" /><path d="M16 16h9.2" stroke="currentColor" stroke-width="1.5" /><circle cx="16" cy="16" fill="#635bff" r="2.15" /><circle cx="25.2" cy="16" fill="#635bff" r="1.75" /></svg>`;

const checkIcon = `<svg aria-hidden="true" class="check" fill="none" viewBox="0 0 16 16"><path d="M4 8.4 6.6 11 12 5.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" /></svg>`;
const errorIcon = `<svg aria-hidden="true" class="cross" fill="none" viewBox="0 0 16 16"><path d="M5.5 5.5l5 5m0-5-5 5" stroke="currentColor" stroke-linecap="round" stroke-width="1.6" /></svg>`;
const spinner = `<span aria-hidden="true" class="spinner">${Array.from({ length: 8 }, (_, index) => `<i style="--i:${index}"></i>`).join("")}</span>`;

function step(id: string, label: string, state: "done" | "active" | "pending") {
  return `<li class="step" data-step="${id}" data-state="${state}"><span class="step-icon">${checkIcon}${errorIcon}${spinner}<span class="dot"></span></span><span class="step-label">${label}</span></li>`;
}

const launchPageMarkup = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        color-scheme: light;
        --bg-100: #ffffff;
        --bg-200: #fafafa;
        --gray-100: #f2f2f2;
        --gray-200: #ebebeb;
        --gray-400: #eaeaea;
        --gray-500: #c9c9c9;
        --gray-700: #8f8f8f;
        --gray-900: #666666;
        --gray-1000: #171717;
        --gray-alpha-200: rgb(0 0 0 / 0.08);
        --gray-alpha-400: rgb(0 0 0 / 0.08);
        --blue-700: #0070f3;
        --green-700: #45a557;
        --green-100: #effbef;
        --red-100: #fff0f0;
        --red-400: #fdd8d8;
        --red-700: #e5484d;
        --red-900: #ca2a30;
        --shadow-modal:
          0 0 0 1px rgb(0 0 0 / 0.08), 0 1px 1px rgb(0 0 0 / 0.02), 0 8px 16px -4px rgb(0 0 0 / 0.04),
          0 24px 32px -8px rgb(0 0 0 / 0.08);
        --shadow-small: 0 1px 2px rgb(0 0 0 / 0.04);
        --radius-control: 6px;
        --radius-card: 8px;
        --radius-panel: 12px;
        --motion-instant: 90ms;
        --motion-fast: 150ms;
        --motion-normal: 220ms;
        --motion-slow: 340ms;
        --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
        --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
        --ease-spring: cubic-bezier(0.34, 1.4, 0.64, 1);
      }
      html[data-theme="dark"] {
        color-scheme: dark;
        --bg-100: #0a0a0a;
        --bg-200: #000000;
        --gray-100: #1a1a1a;
        --gray-200: #1f1f1f;
        --gray-400: #2e2e2e;
        --gray-500: #454545;
        --gray-700: #8f8f8f;
        --gray-900: #a1a1a1;
        --gray-1000: #ededed;
        --gray-alpha-200: rgb(255 255 255 / 0.09);
        --gray-alpha-400: rgb(255 255 255 / 0.14);
        --green-700: #46a758;
        --green-100: #0b2211;
        --red-100: #2a1314;
        --red-400: #561a1e;
        --red-700: #e5484d;
        --red-900: #ff6166;
        --shadow-modal:
          0 0 0 1px rgb(255 255 255 / 0.12), 0 1px 1px rgb(0 0 0 / 0.3), 0 8px 16px -4px rgb(0 0 0 / 0.5),
          0 24px 32px -8px rgb(0 0 0 / 0.6);
        --shadow-small: 0 1px 2px rgb(0 0 0 / 0.3);
      }
      * { box-sizing: border-box; }
      html, body { min-width: 320px; margin: 0; }
      body {
        min-height: 100vh;
        min-height: 100dvh;
        background: var(--bg-200);
        color: var(--gray-1000);
        font-family: var(--font-sans, "Geist"), ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 14px;
        line-height: 20px;
        -webkit-font-smoothing: antialiased;
      }
      .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
      .mono { font-family: var(--font-mono, "Geist Mono"), ui-monospace, SFMono-Regular, Menlo, monospace; }
      .shell {
        display: grid;
        min-height: 100vh;
        min-height: 100dvh;
        place-items: center;
        padding: 24px 16px;
      }
      .card {
        width: min(100%, 440px);
        overflow: hidden;
        border-radius: var(--radius-panel);
        background: var(--bg-100);
        box-shadow: var(--shadow-modal);
        animation: card-in var(--motion-slow) var(--ease-out) both;
      }
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        border-bottom: 1px solid var(--gray-400);
        padding: 12px 20px;
      }
      .brand {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        font-weight: 600;
        letter-spacing: -0.02em;
      }
      .brand svg { width: 20px; height: 20px; flex: none; }
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 22px;
        border: 1px solid var(--gray-400);
        border-radius: 999px;
        padding: 0 8px;
        color: var(--gray-900);
        font-size: 11px;
        font-weight: 500;
      }
      .pill svg { width: 12px; height: 12px; }
      .content { padding: 28px 20px 20px; }
      .reveal { animation: rise var(--motion-slow) var(--ease-out) both; animation-delay: calc(60ms + var(--d, 0) * 50ms); }
      .bridge {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .tile {
        position: relative;
        display: grid;
        width: 48px;
        height: 48px;
        flex: none;
        place-items: center;
        overflow: hidden;
        border-radius: var(--radius-card);
        background: var(--bg-100);
        box-shadow: 0 0 0 1px var(--gray-alpha-400), var(--shadow-small);
        animation: tile-in var(--motion-slow) var(--ease-spring) both;
        animation-delay: calc(80ms + var(--d, 0) * 60ms);
      }
      .tile.authometry svg { width: 26px; height: 26px; }
      .tile.app {
        background: linear-gradient(135deg, var(--gray-1000), var(--gray-700));
        color: var(--bg-100);
      }
      .app-fallback { font-size: 14px; font-weight: 600; letter-spacing: -0.02em; }
      .app-logo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; background: var(--bg-100); }
      .track {
        position: relative;
        flex: 1;
        height: 1px;
        background-image: linear-gradient(to right, var(--gray-500) 50%, transparent 0);
        background-size: 6px 1px;
      }
      .track::after {
        position: absolute;
        top: -1px;
        left: 0;
        width: 32px;
        height: 3px;
        border-radius: 999px;
        background: linear-gradient(to right, transparent, var(--gray-1000));
        content: "";
        animation: travel 1.4s var(--ease-in-out) infinite;
      }
      h1 {
        margin: 24px 0 0;
        font-size: 24px;
        font-weight: 600;
        line-height: 32px;
        letter-spacing: -0.029em;
        overflow-wrap: anywhere;
      }
      .description {
        margin: 6px 0 0;
        color: var(--gray-900);
        font-size: 14px;
        line-height: 20px;
        overflow-wrap: anywhere;
      }
      .steps {
        display: grid;
        gap: 2px;
        margin: 20px 0 0;
        border: 1px solid var(--gray-400);
        border-radius: var(--radius-card);
        padding: 6px;
        list-style: none;
      }
      .step {
        display: flex;
        align-items: center;
        gap: 10px;
        border-radius: var(--radius-control);
        padding: 6px 8px;
        color: var(--gray-900);
        font-size: 13px;
        transition: background-color var(--motion-normal) var(--ease-out), color var(--motion-normal) var(--ease-out);
      }
      .step[data-state="done"] { color: var(--gray-1000); }
      .step[data-state="active"] { background: var(--gray-100); color: var(--gray-1000); font-weight: 500; }
      .step[data-state="failed"] { background: var(--red-100); color: var(--red-900); font-weight: 500; }
      .step-icon { position: relative; display: grid; width: 16px; height: 16px; flex: none; place-items: center; }
      .step-icon > * { grid-area: 1 / 1; opacity: 0; transform: scale(.6); transition: opacity var(--motion-fast) var(--ease-out), transform var(--motion-normal) var(--ease-spring); }
      .check, .cross { width: 16px; height: 16px; }
      .check { color: var(--green-700); }
      .cross { color: var(--red-900); }
      .check path { stroke-dasharray: 14; stroke-dashoffset: 14; }
      .step[data-state="done"] .check { opacity: 1; transform: none; }
      .step[data-state="done"] .check path { animation: draw var(--motion-slow) var(--ease-out) forwards; animation-delay: 160ms; }
      .step[data-state="failed"] .cross { opacity: 1; transform: none; }
      .step[data-state="active"] .spinner { opacity: 1; transform: none; }
      .step[data-state="pending"] .dot { opacity: 1; transform: none; }
      .dot { width: 6px; height: 6px; border: 1px solid var(--gray-500); border-radius: 999px; }
      .spinner { position: relative; width: 16px; height: 16px; }
      .spinner i {
        position: absolute;
        top: 0;
        left: 7.25px;
        width: 1.5px;
        height: 4px;
        border-radius: 1px;
        background: currentColor;
        transform-origin: 0.75px 8px;
        transform: rotate(calc(var(--i) * 45deg));
        animation: fade 0.8s linear infinite;
        animation-delay: calc(var(--i) * 0.1s - 0.8s);
      }
      .error-note {
        display: none;
        margin-top: 12px;
        border: 1px solid var(--red-400);
        border-radius: var(--radius-card);
        background: var(--red-100);
        padding: 10px 12px;
        color: var(--red-900);
        font-size: 13px;
        line-height: 18px;
      }
      .actions { display: none; margin-top: 16px; justify-content: flex-end; gap: 8px; }
      button {
        height: 32px;
        border: 0;
        border-radius: var(--radius-control);
        background: var(--gray-1000);
        box-shadow: none;
        color: var(--bg-100);
        cursor: pointer;
        font: inherit;
        font-size: 14px;
        font-weight: 500;
        padding: 0 12px;
        transition: transform var(--motion-fast) var(--ease-spring), background-color var(--motion-fast) var(--ease-out), box-shadow var(--motion-fast) var(--ease-out);
      }
      button:hover { transform: translateY(-1px); box-shadow: 0 4px 12px -4px rgb(0 0 0 / 0.3); }
      button:active { transform: scale(.97); box-shadow: none; transition-duration: var(--motion-instant); }
      button:focus-visible { outline: 2px solid var(--blue-700); outline-offset: 2px; }
      .footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        border-top: 1px solid var(--gray-400);
        background: var(--bg-200);
        padding: 12px 20px;
        color: var(--gray-900);
        font-size: 12px;
        line-height: 16px;
      }
      .footer span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .workspace { color: var(--gray-1000); font-weight: 500; }
      body[data-state="error"] .track::after { animation: none; opacity: 0; }
      body[data-state="error"] .track { background-image: linear-gradient(to right, var(--red-700) 50%, transparent 0); opacity: .6; }
      body[data-state="error"] .tile.app { animation: shake var(--motion-slow) var(--ease-out); }
      body[data-state="error"] .error-note { display: block; animation: rise var(--motion-normal) var(--ease-out) both; }
      body[data-state="error"] .actions { display: flex; animation: rise var(--motion-normal) var(--ease-out) both; animation-delay: 60ms; }
      @keyframes card-in { from { opacity: 0; transform: translateY(8px) scale(.98); filter: blur(4px); } to { opacity: 1; transform: none; filter: none; } }
      @keyframes rise { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
      @keyframes tile-in { from { opacity: 0; transform: scale(.85); } to { opacity: 1; transform: none; } }
      @keyframes travel { 0% { left: -32px; opacity: 0; } 20% { opacity: 1; } 80% { opacity: 1; } 100% { left: 100%; opacity: 0; } }
      @keyframes draw { to { stroke-dashoffset: 0; } }
      @keyframes fade { from { opacity: 1; } to { opacity: .15; } }
      @keyframes shake { 0%, 100% { transform: none; } 25% { transform: translateX(-3px); } 50% { transform: translateX(3px); } 75% { transform: translateX(-1px); } }
      @media (max-width: 480px) {
        .header, .content, .footer { padding-left: 16px; padding-right: 16px; }
        .footer { flex-direction: column; align-items: flex-start; gap: 2px; }
        .footer span { max-width: 100%; }
        .actions button { width: 100%; }
      }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { animation-duration: 1ms !important; animation-iteration-count: 1 !important; transition-duration: 1ms !important; }
        .track::after { display: none; }
        .spinner i { animation: none; opacity: calc(1 - var(--i) * .1); }
        button:hover, button:active { transform: none; }
      }
    </style>
  </head>
  <body data-state="loading">
    <main class="shell">
      <section class="card" aria-labelledby="launch-title">
        <header class="header">
          <span class="brand">${brandMark}<span>Authometry</span></span>
          <span class="pill"><svg aria-hidden="true" fill="none" viewBox="0 0 16 16"><rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" stroke-width="1.4" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" stroke-width="1.4" /></svg>Secure handoff</span>
        </header>
        <div class="content">
          <div class="bridge" aria-hidden="true">
            <div class="tile authometry" style="--d:0">${brandMark}</div>
            <div class="track"></div>
            <div class="tile app" style="--d:1"><span class="app-fallback"></span><img alt="" class="app-logo" hidden referrerpolicy="no-referrer" /></div>
          </div>
          <h1 class="reveal" id="launch-title" style="--d:1"></h1>
          <p class="description reveal" id="launch-description" style="--d:2"></p>
          <ol class="steps reveal" aria-label="Launch progress" style="--d:3">
            ${step("session", "Portal session verified", "done")}
            ${step("authorize", "Requesting authorization", "active")}
            ${step("redirect", "Redirecting to application", "pending")}
          </ol>
          <p class="sr-only" id="launch-status" role="status" aria-live="polite">Verifying access and preparing your session…</p>
          <div class="error-note" id="launch-error" role="alert"></div>
          <div class="actions"><button id="close-button" type="button">Close window</button></div>
        </div>
        <footer class="footer"><span class="workspace" id="workspace-name"></span><span class="mono" id="user-email"></span></footer>
      </section>
    </main>
  </body>
</html>`;

function setText(document: Document, selector: string, value: string) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function setStep(document: Document, id: string, state: string) {
  const element = document.querySelector<HTMLElement>(`[data-step="${id}"]`);
  if (element) element.dataset.state = state;
}

// The handoff tab has no stylesheets of its own, so borrow the portal's
// self-hosted Geist @font-face rules and font-family variables.
function inheritFonts(source: Document, target: Document) {
  const rules: string[] = [];
  for (const sheet of Array.from(source.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        if (rule instanceof CSSFontFaceRule) rules.push(rule.cssText);
      }
    } catch {
      // Cross-origin stylesheet; skip it.
    }
  }
  const computed = source.defaultView?.getComputedStyle(source.body);
  const sans = computed?.getPropertyValue("--font-geist-sans").trim();
  const mono = computed?.getPropertyValue("--font-geist-mono").trim();
  const variables = [sans && `--font-sans: ${sans};`, mono && `--font-mono: ${mono};`]
    .filter(Boolean)
    .join(" ");
  const style = target.createElement("style");
  style.textContent = `${rules.join("\n")}\n:root { ${variables} }`;
  target.head.append(style);
}

export function createPortalLaunchHandoff(
  tab: Window,
  application: LaunchApplication,
  context: LaunchContext,
) {
  const document = tab.document;
  document.open();
  document.write(launchPageMarkup);
  document.close();
  inheritFonts(window.document, document);

  document.documentElement.dataset.theme = context.dark ? "dark" : "light";
  document.title = `Opening ${application.name}…`;
  setText(document, "#launch-title", `Opening ${application.name}`);
  setText(
    document,
    "#launch-description",
    application.description || "Your verified identity is being handed off to this application.",
  );
  setText(document, ".app-fallback", application.name.slice(0, 2).toUpperCase());
  setText(document, "#workspace-name", context.workspaceName || "Your workspace");
  setText(document, "#user-email", context.userEmail || "Session verified");

  const logo = document.querySelector<HTMLImageElement>(".app-logo");
  if (logo && application.logo_uri) {
    logo.addEventListener("load", () => {
      logo.hidden = false;
    });
    logo.addEventListener("error", () => {
      logo.hidden = true;
    });
    logo.src = application.logo_uri;
  }

  document.querySelector("#close-button")?.addEventListener("click", () => tab.close());

  return {
    showRedirecting() {
      setStep(document, "authorize", "done");
      setStep(document, "redirect", "active");
      setText(document, "#launch-status", `Redirecting to ${application.name}…`);
    },
    showError(message: string) {
      document.body.dataset.state = "error";
      document.title = `${application.name} could not be opened`;
      setStep(document, "authorize", "failed");
      setText(document, "#launch-title", `${application.name} didn’t open`);
      setText(document, "#launch-description", "The secure handoff stopped before sign-in.");
      setText(document, "#launch-error", message);
      setText(document, "#launch-status", "The secure handoff stopped before sign-in.");
      document.querySelector<HTMLButtonElement>("#close-button")?.focus();
    },
  };
}
