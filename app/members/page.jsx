import { getSiteData } from "@/lib/siteData";

export const metadata = {
  title: "Members | Bands of AHS"
};

export default function MembersPage() {
  const data = getSiteData();

  return (
    <main className="narrow-page">
      <p className="eyebrow">Planned</p>
      <h1>Member Area</h1>
      <p className="lede">{data.memberArea.note}</p>
      <div className="notice">
        <h2>Public/private boundary</h2>
        {data.publicBoundary.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </div>
      <p>
        When this becomes active, it should use real authentication and a curated private data source. It should not
        expose raw PKA folders or internal working notes to the browser.
      </p>
    </main>
  );
}
