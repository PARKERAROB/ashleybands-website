import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { resolveSponsorStudentCode } from "@/lib/sponsorStudentLinks";
import { carnegieLinkPreview, carnegieStudentFullUrl, carnegieStudentReadableUrl } from "@/lib/carnegieLetters.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOINDEX = { "X-Robots-Tag": "noindex, nofollow, noarchive" };

// Save-to-Photos card for one student's Carnegie link (#200): QR of the same https link Music Notes
// shows, "Help [first name] get to Carnegie Hall" and the short link. First name only, no amounts.
// A hosted PNG so it shows in Gmail and Outlook and saves with a long press.
export async function GET(_req, { params }) {
  const { code } = await params;
  const resolved = await resolveSponsorStudentCode(code);
  if (!resolved) return new Response("Not found", { status: 404, headers: { ...NOINDEX, "Cache-Control": "no-store" } });

  const svg = await QRCode.toString(carnegieStudentFullUrl(resolved.link.code), { type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark: "#191716", light: "#ffffff" } });
  const qr = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  const { title } = carnegieLinkPreview(resolved.student.public_name);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f7f3e8", border: "24px solid #7b1829", padding: "56px 64px", fontFamily: "serif" }}>
        <div style={{ fontSize: 30, letterSpacing: 4, color: "#7b1829", fontWeight: 700 }}>ASHLEY HIGH SCHOOL BANDS</div>
        <div style={{ fontSize: 76, lineHeight: 1.08, color: "#4f101c", marginTop: 28, textAlign: "center", display: "flex" }}>{title}</div>
        <div style={{ display: "flex", background: "#ffffff", padding: 24, borderRadius: 24, marginTop: 44 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} width={620} height={620} alt="" />
        </div>
        <div style={{ fontSize: 34, color: "#191716", marginTop: 36 }}>Scan to give, or visit</div>
        <div style={{ fontSize: 34, color: "#7b1829", fontWeight: 700, marginTop: 8 }}>{carnegieStudentReadableUrl(resolved.link.code)}</div>
      </div>
    ),
    { width: 1080, height: 1350, headers: { ...NOINDEX, "Cache-Control": "public, max-age=3600, s-maxage=86400" } }
  );
}
