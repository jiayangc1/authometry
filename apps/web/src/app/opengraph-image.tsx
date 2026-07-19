import { ImageResponse } from "next/og";

export const alt = "Authometry — OAuth you can see";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#f8f7ff",
        color: "#19172c",
        display: "flex",
        height: "100%",
        overflow: "hidden",
        padding: "74px 76px",
        position: "relative",
        width: "100%",
      }}
    >
      <div
        style={{
          background: "#ff7f71",
          borderRadius: 999,
          display: "flex",
          height: 240,
          left: -95,
          position: "absolute",
          top: -105,
          width: 240,
        }}
      />
      <div
        style={{
          background: "#62cfba",
          borderRadius: 999,
          bottom: -95,
          display: "flex",
          height: 210,
          position: "absolute",
          right: -70,
          width: 210,
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", width: 620 }}>
        <div style={{ alignItems: "center", display: "flex", fontSize: 24, fontWeight: 700 }}>
          <div
            style={{
              background: "#625bdc",
              borderRadius: 999,
              display: "flex",
              height: 17,
              marginRight: 12,
              width: 17,
            }}
          />
          Authometry
        </div>
        <div
          style={{
            color: "#625bdc",
            display: "flex",
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: 1.5,
            marginTop: 76,
            textTransform: "uppercase",
          }}
        >
          Open-source authorization
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 67,
            fontWeight: 800,
            letterSpacing: -4,
            lineHeight: 0.98,
            marginTop: 18,
          }}
        >
          OAuth you can
          <span style={{ color: "#625bdc" }}>actually see.</span>
        </div>
        <div style={{ color: "#66627a", display: "flex", fontSize: 21, marginTop: 26 }}>
          Inspect every policy, token, and decision.
        </div>
      </div>

      <div
        style={{
          background: "#e8e5ff",
          border: "3px solid #ffffff",
          borderRadius: 42,
          boxShadow: "20px 24px 50px rgba(63,54,126,0.18)",
          display: "flex",
          height: 410,
          padding: 30,
          position: "absolute",
          right: 72,
          transform: "rotate(2deg)",
          width: 390,
        }}
      >
        <div
          style={{
            background: "rgba(255,255,255,0.75)",
            borderRadius: 27,
            display: "flex",
            flex: 1,
            flexDirection: "column",
            padding: "26px 24px",
          }}
        >
          <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#66627a", fontSize: 16 }}>req_a72b9c</span>
            <span style={{ color: "#22957d", fontSize: 16, fontWeight: 700 }}>Explained</span>
          </div>
          {["Client verified", "Redirect matched", "PKCE validated", "Policy evaluated"].map(
            (label, index) => (
              <div
                key={label}
                style={{
                  alignItems: "center",
                  borderBottom: index === 3 ? "none" : "1px solid #dedaf2",
                  display: "flex",
                  flex: 1,
                  fontSize: 17,
                }}
              >
                <span
                  style={{
                    background: index === 3 ? "#ff7f71" : "#62cfba",
                    borderRadius: 999,
                    display: "flex",
                    height: 11,
                    marginRight: 15,
                    width: 11,
                  }}
                />
                {label}
                <span style={{ color: "#8c879f", marginLeft: "auto" }}>
                  {index === 3 ? "8 ms" : "Passed"}
                </span>
              </div>
            ),
          )}
        </div>
      </div>
    </div>,
    size,
  );
}
