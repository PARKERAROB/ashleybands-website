import { ImageResponse } from "next/og";
import { carnegieLettersAccess } from "@/lib/carnegieLettersServer";
import { notesChartSvgMarkup } from "@/lib/carnegieLetters.mjs";

export const runtime = "nodejs";

// Generic link-preview image for student Carnegie links (#106). No names, no amounts.
export async function GET(req) {
  const access = await carnegieLettersAccess(req);
  // Crawlers carry no staff session, so in staff preview the image is visible to staff only.
  if (!access.open) return new Response("Not found", { status: 404 });
  const chart = `data:image/svg+xml;base64,${Buffer.from(notesChartSvgMarkup(0)).toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#f7f3e8", border: "18px solid #7b1829", fontFamily: "serif" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 0 0 56px", width: 560 }}>
          <div style={{ fontSize: 26, letterSpacing: 4, color: "#7b1829", fontWeight: 700 }}>ASHLEY HIGH SCHOOL BANDS</div>
          <div style={{ fontSize: 70, lineHeight: 1.05, color: "#4f101c", marginTop: 18 }}>Help us get to Carnegie Hall</div>
          <div style={{ fontSize: 34, color: "#191716", marginTop: 22 }}>Fill my Music Notes</div>
          <div style={{ fontSize: 26, color: "#4a4340", marginTop: 10 }}>March 25, 2027 · New York City</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img src={chart} width={560} height={436} />
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=3600" } }
  );
}
