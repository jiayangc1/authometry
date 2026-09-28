import { ImageResponse } from "next/og";

export const alt = "Authometry — Authentication, measured.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const paper = "#f4f4f0";
const ink = "#12130f";
const signal = "#ccf24a";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        background: paper,
        color: ink,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "space-between",
        padding: "72px 80px",
        width: "100%",
      }}
    >
      <div style={{ alignItems: "center", display: "flex", gap: 22 }}>
        <div
          style={{
            alignItems: "center",
            background: ink,
            borderRadius: 22,
            display: "flex",
            height: 84,
            justifyContent: "center",
            width: 84,
          }}
        >
          <svg height="62" viewBox="0 0 32 32" width="62">
            <path
              d="M14.25 3.35A12.75 12.75 0 1 0 27.55 18.75"
              fill="none"
              stroke={paper}
              strokeLinecap="round"
              strokeWidth="2.35"
            />
            <path
              d="M17.8 3.65a12.75 12.75 0 0 1 9.65 9.2"
              fill="none"
              stroke={signal}
              strokeLinecap="round"
              strokeWidth="2.35"
            />
            <path
              d="M23.45 11.7a8.5 8.5 0 1 0 0 8.6"
              fill="none"
              stroke={paper}
              strokeLinecap="round"
              strokeWidth="1.9"
            />
            <path d="M16 16h9.2" stroke={paper} strokeWidth="1.5" />
            <circle cx="16" cy="16" fill={signal} r="2.15" />
            <circle cx="25.2" cy="16" fill={signal} r="1.75" />
          </svg>
        </div>
        <div style={{ fontSize: 44, fontWeight: 600, letterSpacing: -1.5 }}>Authometry</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 132, fontWeight: 500, letterSpacing: -7, lineHeight: 0.9 }}>
          Authentication,
        </div>
        <div style={{ fontSize: 132, fontWeight: 500, letterSpacing: -7, lineHeight: 0.9 }}>
          measured.
        </div>
      </div>
      <div style={{ alignItems: "center", display: "flex", gap: 24 }}>
        <div style={{ background: "#bebeb5", display: "flex", flex: 1, height: 2 }} />
        <div
          style={{
            background: signal,
            border: `3px solid ${ink}`,
            borderRadius: 999,
            display: "flex",
            height: 22,
            width: 22,
          }}
        />
        <div style={{ color: "#4c4d46", display: "flex", fontSize: 26 }}>
          Open-source OAuth 2.0 and OpenID Connect
        </div>
      </div>
    </div>,
    size,
  );
}
