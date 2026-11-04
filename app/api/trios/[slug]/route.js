import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { BOOKS, PAGE_COUNT, TRIOS_BUCKET, TRIOS_SLUG } from "@/lib/holidayTrios.mjs";

// Holiday trio picker page images (#255). Returns two-hour signed links for one instrument book.
// The bucket is private, so the music cannot be opened without passing through this slug check.
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" };

export async function GET(request, { params }) {
  const { slug } = await params;
  if (slug !== TRIOS_SLUG) return Response.json({ error: "Not found" }, { status: 404, headers });
  const book = new URL(request.url).searchParams.get("book");
  if (!Object.hasOwn(BOOKS, book || "")) return Response.json({ error: "Choose an instrument." }, { status: 400, headers });

  const paths = Array.from({ length: PAGE_COUNT }, (_, i) => `${book}/p-${String(i + 1).padStart(2, "0")}.jpg`);
  const { data, error } = await supabaseAdmin.storage.from(TRIOS_BUCKET).createSignedUrls(paths, 2 * 60 * 60);
  if (error || !data) return Response.json({ error: "The music did not load. Try again." }, { status: 502, headers });
  const pages = {};
  data.forEach((item, i) => { if (item.signedUrl) pages[i + 1] = item.signedUrl; });
  return Response.json({ book, pages }, { headers });
}
