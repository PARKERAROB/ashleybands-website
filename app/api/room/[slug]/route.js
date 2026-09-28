import board from "@/content/sources/classroom-board.json";

// Band room board data (#154). The board polls this every 5 minutes. Same slug check as the page.
export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const { slug } = await params;
  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" };
  if (slug !== board.slug) return Response.json({ error: "Not found" }, { status: 404, headers });
  const { slug: _omit, _readme: _note, ...data } = board;
  return Response.json(data, { headers });
}
