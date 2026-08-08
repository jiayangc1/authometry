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

const launchPageMarkup = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        color-scheme: light;
        --canvas: #f3f4f7;
        --paper: rgba(255, 255, 255, .86);
        --ink: #171820;
        --muted: #696b78;
        --line: #dedfe5;
        --accent: #6d5dfb;
        --accent-soft: #efedff;
        --success: #168b69;
        --danger: #c72c32;
        --danger-soft: #fff1f1;
        --shadow: 0 28px 80px rgba(31, 29, 66, .13);
      }
      html[data-theme="dark"] {
        color-scheme: dark;
        --canvas: #0d0e13;
        --paper: rgba(19, 20, 27, .9);
        --ink: #f1f1f5;
        --muted: #a6a7b3;
        --line: #292a34;
        --accent: #928cff;
        --accent-soft: #23203e;
        --success: #4fd5aa;
        --danger: #fb7185;
        --danger-soft: #2b1418;
        --shadow: 0 28px 90px rgba(0, 0, 0, .42);
      }
      * { box-sizing: border-box; }
      html, body { min-width: 320px; min-height: 100%; margin: 0; }
      body {
        min-height: 100vh;
        min-height: 100dvh;
        overflow: hidden;
        background: var(--canvas);
        color: var(--ink);
        font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      body::before {
        position: fixed;
        inset: -25%;
        content: "";
        background:
          radial-gradient(circle at 22% 34%, color-mix(in srgb, var(--accent) 14%, transparent) 0, transparent 27%),
          radial-gradient(circle at 78% 68%, color-mix(in srgb, var(--success) 9%, transparent) 0, transparent 25%);
        animation: atmosphere 8s ease-in-out infinite alternate;
      }
      .shell {
        position: relative;
        display: grid;
        min-height: 100vh;
        min-height: 100dvh;
        place-items: center;
        padding: 24px;
      }
      .card {
        width: min(100%, 560px);
        overflow: hidden;
        border: 1px solid var(--line);
        border-radius: 26px;
        background: var(--paper);
        box-shadow: var(--shadow);
        backdrop-filter: blur(22px);
      }
      .content { padding: 34px 34px 30px; }
      .brand {
        display: flex;
        align-items: center;
        gap: 9px;
        font-size: 13px;
        font-weight: 680;
        letter-spacing: -.02em;
      }
      .brand svg { width: 22px; height: 22px; }
      .eyebrow {
        margin: 34px 0 0;
        color: var(--muted);
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 9px;
        line-height: 14px;
        letter-spacing: .13em;
        text-transform: uppercase;
      }
      h1 {
        margin: 8px 0 0;
        font-size: clamp(29px, 7vw, 39px);
        font-weight: 670;
        letter-spacing: -.052em;
        line-height: 1.08;
      }
      .description {
        max-width: 420px;
        min-height: 44px;
        margin: 13px 0 0;
        color: var(--muted);
        font-size: 13px;
        line-height: 21px;
      }
      .bridge {
        display: grid;
        grid-template-columns: 58px minmax(80px, 1fr) 58px;
        align-items: center;
        margin: 32px 0 30px;
      }
      .identity {
        position: relative;
        display: grid;
        width: 58px;
        height: 58px;
        place-items: center;
        overflow: hidden;
        border: 1px solid var(--line);
        border-radius: 17px;
        background: var(--canvas);
        color: var(--ink);
        box-shadow: 0 8px 22px rgba(20, 20, 40, .07);
      }
      .identity.authometry svg { width: 29px; height: 29px; }
      .app-fallback {
        font-size: 15px;
        font-weight: 720;
        letter-spacing: -.03em;
      }
      .app-logo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      .track { position: relative; height: 1px; overflow: visible; background: var(--line); }
      .track::after {
        position: absolute;
        top: -2px;
        left: 0;
        width: 5px;
        height: 5px;
        border-radius: 999px;
        background: var(--accent);
        box-shadow: 0 0 0 5px var(--accent-soft);
        content: "";
        animation: travel 1.65s cubic-bezier(.45, 0, .3, 1) infinite;
      }
      .status {
        display: flex;
        align-items: center;
        gap: 10px;
        border-radius: 12px;
        background: var(--accent-soft);
        padding: 12px 14px;
        color: var(--ink);
        font-size: 12px;
        font-weight: 580;
      }
      .spinner {
        width: 15px;
        height: 15px;
        flex: none;
        border: 2px solid color-mix(in srgb, var(--accent) 25%, transparent);
        border-top-color: var(--accent);
        border-radius: 999px;
        animation: spin .8s linear infinite;
      }
      .footer {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        border-top: 1px solid var(--line);
        padding: 17px 34px;
        color: var(--muted);
        font-size: 10px;
        line-height: 16px;
      }
      .email { max-width: 55%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .actions { display: none; margin-top: 14px; }
      button {
        border: 1px solid var(--line);
        border-radius: 999px;
        background: transparent;
        color: var(--ink);
        cursor: pointer;
        font: inherit;
        font-size: 12px;
        font-weight: 620;
        padding: 9px 15px;
      }
      button:hover { background: var(--canvas); }
      button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
      body[data-state="error"] .track::after, body[data-state="error"] .spinner { animation: none; }
      body[data-state="error"] .track::after { left: calc(100% - 5px); background: var(--danger); box-shadow: 0 0 0 5px var(--danger-soft); }
      body[data-state="error"] .status { background: var(--danger-soft); color: var(--danger); }
      body[data-state="error"] .spinner { border: 0; }
      body[data-state="error"] .spinner::before { content: "!"; font-size: 14px; line-height: 15px; font-weight: 800; }
      body[data-state="error"] .actions { display: block; }
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes travel { 0% { left: 0; opacity: 0; } 14% { opacity: 1; } 82% { opacity: 1; } 100% { left: calc(100% - 5px); opacity: 0; } }
      @keyframes atmosphere { to { transform: translate3d(2%, -1%, 0) scale(1.03); } }
      @media (max-width: 520px) {
        .shell { padding: 14px; }
        .card { border-radius: 21px; }
        .content { padding: 26px 22px 23px; }
        .eyebrow { margin-top: 28px; }
        .footer { align-items: flex-start; flex-direction: column; padding: 15px 22px; }
        .email { max-width: 100%; }
      }
      @media (prefers-reduced-motion: reduce) {
        body::before, .track::after, .spinner { animation: none; }
        .track::after { left: 50%; }
      }
    </style>
  </head>
  <body data-state="loading">
    <main class="shell">
      <section class="card" aria-labelledby="launch-title">
        <div class="content">
          <div class="brand">
            <svg aria-hidden="true" fill="none" viewBox="0 0 32 32">
              <path d="M14.25 3.35A12.75 12.75 0 1 0 27.55 18.75" stroke="currentColor" stroke-linecap="round" stroke-width="2.35" />
              <path d="M17.8 3.65a12.75 12.75 0 0 1 9.65 9.2" stroke="#6d5dfb" stroke-linecap="round" stroke-width="2.35" />
              <path d="M23.45 11.7a8.5 8.5 0 1 0 0 8.6" stroke="currentColor" stroke-linecap="round" stroke-width="1.9" />
              <path d="M16 16h9.2" stroke="currentColor" stroke-width="1.5" />
              <circle cx="16" cy="16" fill="#6d5dfb" r="2.15" /><circle cx="25.2" cy="16" fill="#6d5dfb" r="1.75" />
            </svg>
            <span>Authometry</span>
          </div>
          <p class="eyebrow">Secure app handoff</p>
          <h1 id="launch-title"></h1>
          <p class="description" id="launch-description"></p>
          <div class="bridge" aria-hidden="true">
            <div class="identity authometry">
              <svg fill="none" viewBox="0 0 32 32"><path d="M14.25 3.35A12.75 12.75 0 1 0 27.55 18.75" stroke="currentColor" stroke-linecap="round" stroke-width="2.35" /><path d="M17.8 3.65a12.75 12.75 0 0 1 9.65 9.2" stroke="#6d5dfb" stroke-linecap="round" stroke-width="2.35" /><path d="M23.45 11.7a8.5 8.5 0 1 0 0 8.6" stroke="currentColor" stroke-linecap="round" stroke-width="1.9" /><path d="M16 16h9.2" stroke="currentColor" stroke-width="1.5" /><circle cx="16" cy="16" fill="#6d5dfb" r="2.15" /><circle cx="25.2" cy="16" fill="#6d5dfb" r="1.75" /></svg>
            </div>
            <div class="track"></div>
            <div class="identity app"><span class="app-fallback"></span><img alt="" class="app-logo" hidden /></div>
          </div>
          <div class="status" role="status" aria-live="polite"><span class="spinner" aria-hidden="true"></span><span id="launch-status">Verifying access and preparing your session…</span></div>
          <div class="actions"><button id="close-button" type="button">Close this window</button></div>
        </div>
        <footer class="footer"><span id="workspace-name"></span><span class="email" id="user-email"></span></footer>
      </section>
    </main>
  </body>
</html>`;

function setText(document: Document, selector: string, value: string) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
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
    showError(message: string) {
      document.body.dataset.state = "error";
      document.title = `${application.name} could not be opened`;
      setText(document, "#launch-title", `${application.name} didn’t open`);
      setText(document, "#launch-description", message);
      setText(document, "#launch-status", "The secure handoff stopped before sign-in.");
      document.querySelector<HTMLButtonElement>("#close-button")?.focus();
    },
  };
}
