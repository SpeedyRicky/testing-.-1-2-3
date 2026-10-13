import { ImageResponse } from "next/og";

// The card X, WhatsApp, LinkedIn and iMessage show when someone pastes the link.
export const alt = "Japa: The Great Escape. A Nigeria to Canada immigration game";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const stripe = (colors: string[], leaf = false) => (
  <div style={{ display: "flex", width: 150, height: 100, borderRadius: 12, overflow: "hidden" }}>
    {colors.map((c, i) => (
      <div key={i} style={{ flex: 1, background: c, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {leaf && i === 1 ? <div style={{ width: 26, height: 26, background: "#d52b1e", transform: "rotate(45deg)" }} /> : null}
      </div>
    ))}
  </div>
);

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
        padding: 64, background: "linear-gradient(135deg, #1a0b2e 0%, #09090b 55%, #052e2b 100%)", color: "white", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {stripe(["#008751", "#ffffff", "#008751"])}
          <div style={{ fontSize: 72, fontWeight: 900, color: "#fcd34d" }}>→</div>
          {stripe(["#d52b1e", "#ffffff", "#d52b1e"], true)}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 92, fontWeight: 900, letterSpacing: -2, lineHeight: 1 }}>Japa: The Great Escape</div>
          <div style={{ marginTop: 24, fontSize: 40, color: "#fda4af" }}>Can you japa from Nigeria to Canada?</div>
        </div>
        <div style={{ display: "flex", gap: 18, fontSize: 28, color: "#d4d4d8" }}>
          {["7 routes", "60+ endings", "Real 2026 rules", "Village People: 100%"].map((t) => (
            <div key={t} style={{ display: "flex", whiteSpace: "nowrap", padding: "10px 22px", borderRadius: 999, border: "2px solid rgba(255,255,255,0.25)" }}>{t}</div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
