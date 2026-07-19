import { ImageResponse } from "next/og";

export const alt = "Authometry — transparent OAuth infrastructure";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#ffffff",
        color: "#111318",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
    >
      <div style={{ alignItems: "center", display: "flex", gap: 42 }}>
        <svg height="188" viewBox="0 0 32 32" width="188">
          <path
            d="M14.25 3.35A12.75 12.75 0 1 0 27.55 18.75"
            fill="none"
            stroke="#111318"
            strokeLinecap="round"
            strokeWidth="2.35"
          />
          <path
            d="M17.8 3.65a12.75 12.75 0 0 1 9.65 9.2"
            fill="none"
            stroke="#635bff"
            strokeLinecap="round"
            strokeWidth="2.35"
          />
          <path
            d="M23.45 11.7a8.5 8.5 0 1 0 0 8.6"
            fill="none"
            stroke="#111318"
            strokeLinecap="round"
            strokeWidth="1.9"
          />
          <path d="M16 16h9.2" stroke="#111318" strokeWidth="1.5" />
          <circle cx="16" cy="16" fill="#635bff" r="2.15" />
          <circle cx="25.2" cy="16" fill="#635bff" r="1.75" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 92, fontWeight: 700, letterSpacing: -5 }}>Authometry</div>
          <div style={{ color: "#5f5f68", fontSize: 30, marginTop: 10 }}>OAuth you can see.</div>
        </div>
      </div>
    </div>,
    size,
  );
}
