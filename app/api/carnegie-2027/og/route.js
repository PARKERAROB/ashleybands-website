import { ImageResponse } from "next/og";
import { notesChartSvgMarkup } from "@/lib/carnegieLetters.mjs";

export const runtime = "nodejs";

// Link-preview image for the Carnegie giving page and supporter links (#247). No names, no photos,
// no amounts, so it needs no media consent and never goes stale.
export async function GET() {
  const chart = `data:image/svg+xml;base64,${Buffer.from(notesChartSvgMarkup(0)).toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#f7f3e8", border: "18px solid #7b1829", fontFamily: "serif" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 0 0 56px", width: 580 }}>
          <div style={{ fontSize: 26, letterSpacing: 4, color: "#7b1829", fontWeight: 700 }}>ASHLEY HIGH SCHOOL BANDS</div>
          <div style={{ fontSize: 70, lineHeight: 1.05, color: "#4f101c", marginTop: 18 }}>Help Ashley students take the stage</div>
          <div style={{ fontSize: 30, color: "#191716", marginTop: 22 }}>Carnegie Hall · March 25, 2027</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img src={chart} width={540} height={420} />
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=86400" } }
  );
}
