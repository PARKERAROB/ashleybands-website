import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const CHECK = process.argv.includes("--check");
// PKA was retired 2026-06-01. The handful of pages that originated there are now
// vendored into this repo at content/pka-sources (same relative layout) so the
// content build is self-contained and needs no external PKA folder. PKA_ROOT can
// still override for one-off rebuilds against an archive copy.
const pkaRoot = process.env.PKA_ROOT
  ? path.resolve(process.env.PKA_ROOT)
  : path.resolve(root, "content/pka-sources");

const sources = {
  facts: "facts/bandsofahs-facts.md",
  carnegie: "content/sources/carnegie-2027.md",
  boosters: "content/sources/boosters.md",
  assistantOverview: "content/sources/assistant-overview.md",
  requiredItems: "knowledge/student-required-items.md",
  // 2026-2027-band-information now lives in this repo (content/sources), not PKA
  nextYear: "content/sources/2026-2027-band-information.md",
  springTrip: "content/sources/archive/spring-trip-2026.md",
  // marching-band-2026 now lives in this repo (content/sources), not PKA — see readRepoSource
  marchingBand: "content/sources/marching-band-2026.md",
  // marching-band-funding now lives in this repo (content/sources), not PKA — see readRepoSource
  marchingFunding: "content/sources/marching-band-funding.md",
  popcornFundraiser: "content/sources/fundraising/popcorn.md",
  mattressFundraiser: "content/sources/fundraising/mattress.md",
  instaraise: "content/sources/archive/instaraise-2026.md",
  bandFolder: "projects/band-website/public-pages/the-band-folder.md",
  corporateSponsorship: "projects/band-website/public-pages/corporate-sponsorship.md",
  familySponsorship: "projects/band-website/public-pages/family-sponsorship.md"
};

function readSource(relativePath) {
  const fullPath = path.join(pkaRoot, relativePath);
  if (!existsSync(fullPath)) {
    throw new Error(`Missing source file: ${fullPath}`);
  }
  return readFileSync(fullPath, "utf8");
}

// Read a source that lives inside this repo (not PKA).
function readRepoSource(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!existsSync(fullPath)) {
    throw new Error(`Missing repo source file: ${fullPath}`);
  }
  return readFileSync(fullPath, "utf8");
}

function section(markdown, heading) {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start === -1) return "";
  const end = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  return lines.slice(start + 1, end === -1 ? undefined : end).join("\n").trim();
}

function cleanGoogleSiteDraft(markdown) {
  return markdown
    .replace(/^# Google Site Page Draft[^\n]*\n+/i, "")
    .replace(/^\*\*(Page title|Suggested page title|Suggested URL path):\*\*.*\n+/gim, "")
    .replace(/^---\n+/m, "")
    .trim();
}

const facts = readSource(sources.facts);
const requiredItems = readSource(sources.requiredItems);

const pages = [
  {
    slug: "carnegie-2027",
    title: "Carnegie Hall 2027",
    summary: "Family response, conditional deposit, and current trip-planning information.",
    audience: "Families",
    source: sources.carnegie,
    category: "Current information",
    body: readRepoSource(sources.carnegie).trim()
  },
  {
    slug: "2026-2027-band-information",
    title: "2026-2027 Band Information",
    summary: "Major dates, communication channels, materials, attire, and parent involvement.",
    audience: "Families",
    source: sources.nextYear,
    category: "Current information",
    body: cleanGoogleSiteDraft(readRepoSource(sources.nextYear))
  },
  {
    slug: "spring-trip",
    title: "Spring Trip 2026 (Archive)",
    summary: "Historical information for May 15-16, 2026. These are not current travel or payment instructions.",
    audience: "Families",
    source: sources.springTrip,
    category: "Archive",
    archived: true,
    body: cleanGoogleSiteDraft(readRepoSource(sources.springTrip))
  },
  {
    slug: "marching-band-2026",
    title: "Marching Band 2026",
    summary: "Fall participation, competitive marching band planning, working dates, and next steps.",
    audience: "Families and students",
    source: sources.marchingBand,
    category: "Current information",
    body: cleanGoogleSiteDraft(readRepoSource(sources.marchingBand))
  },
  {
    slug: "marching-band-funding",
    title: "Competitive Marching Band Funding",
    summary: "Working cost estimates and fair-share funding approach for a competitive season.",
    audience: "Families",
    source: sources.marchingFunding,
    category: "Current information",
    body: cleanGoogleSiteDraft(readRepoSource(sources.marchingFunding))
  },
  {
    slug: "instaraise-fundraiser",
    title: "InstaRaise 2026 (Archive)",
    summary: "Historical information for the campaign ending May 14, 2026. Visit Current Fundraisers for active campaigns.",
    audience: "Families",
    source: sources.instaraise,
    category: "Archive",
    archived: true,
    body: cleanGoogleSiteDraft(readRepoSource(sources.instaraise))
  },
  {
    slug: "required-items",
    title: "Required Items",
    summary: "Standard student equipment, materials, and baseline program expectations.",
    audience: "Students and families",
    source: sources.requiredItems,
    category: "Everyday resources",
    body: requiredItems.trim()
  },
  {
    slug: "the-band-folder",
    title: "The Band Folder",
    summary: "Everything needed for band: calendar, Family Portal, student supplies, clothing, and methods.",
    audience: "Students and families",
    source: sources.bandFolder,
    category: "Everyday resources",
    body: readSource(sources.bandFolder).trim()
  },
  {
    slug: "corporate-sponsorship",
    title: "Corporate Sponsorship",
    summary: "Business sponsorship levels, benefits, tax information, and contact details.",
    audience: "Community supporters",
    source: sources.corporateSponsorship,
    category: "Support the band",
    body: readSource(sources.corporateSponsorship).trim()
  },
  {
    slug: "family-sponsorship",
    title: "Family Sponsorship",
    summary: "Family giving levels, recognition, tax information, and contact details.",
    audience: "Families",
    source: sources.familySponsorship,
    category: "Support the band",
    body: readSource(sources.familySponsorship).trim()
  }
];

const fundraisers = [
  {
    slug: "popcorn",
    title: "Perry's Popcorn Fundraiser",
    summary: "Shop online, credit a student, and share one link. Orders ship directly to the purchaser.",
    status: "Open now",
    timing: "Ends midnight Wednesday, September 9",
    location: "Online",
    source: sources.popcornFundraiser,
    externalHref: "https://www.perrysgourmetpopcornfundraising.com/",
    externalLabel: "Shop Perry's Popcorn",
    body: readRepoSource(sources.popcornFundraiser).trim()
  },
  {
    slug: "mattress",
    title: "Ashley Bands Mattress Fundraiser",
    summary: "Find one household that needs a mattress and invite them personally to the sale.",
    status: "Coming September 26",
    timing: "Saturday, September 26 · 10:00 a.m.-4:00 p.m.",
    location: "Ashley High School full-size gym",
    source: sources.mattressFundraiser,
    externalHref: "https://raleigh.cfsbeds.com/events/eugene-ashley-high-school",
    externalLabel: "Open the CFS event page",
    body: readRepoSource(sources.mattressFundraiser).trim(),
    flyers: [
      {
        src: "/fundraising/mattress-vip-flyer.jpg",
        alt: "CFS mattress fundraiser event and VIP discount flyer",
        label: "Event and VIP flyer"
      },
      {
        src: "/fundraising/mattress-referral-flyer.jpg",
        alt: "CFS mattress fundraiser student referral flyer",
        label: "Student referral flyer"
      }
    ]
  }
];

const siteDataBody = {
  sourceRoot: process.env.PKA_ROOT ? "external PKA_ROOT override" : "content/pka-sources",
  program: {
    name: "Bands of Ashley High School",
    school: "Ashley High School",
    address: "555 Halyburton Memorial Parkway, Wilmington, NC 28412",
    phone: "(910) 790-2360",
    email: "robert.parker@nhcs.net",
    director: "Robert Parker",
    overview: section(facts, "Program Overview"),
    staff: section(facts, "Director & Staff"),
    boosters: section(facts, "Band Boosters"),
    calendar: section(facts, "Major Concert / Assessment Dates — 2026–2027"),
    communication: section(facts, "Communication Platforms"),
    attire: section(facts, "Concert Attire — Musician Black"),
    sponsorships: section(facts, "Sponsorships"),
    sponsors: section(facts, "Current Sponsors")
  },
  publicBoundary: [
    "Public pages may use stable program facts, event information, required items, sponsor information, trip information, fundraising information, and general procedures.",
    "Do not publish student-specific details, internal PKA notes, family-specific balances, accommodation details, private decisions, or working drafts not intended for families."
  ],
  memberArea: {
    status: "planned",
    note: "Future sign-in area for curated member-only information. Authentication is intentionally not part of the MVP."
  },
  quickLinks: [
    {
      label: "Calendar subscription",
      href: "https://ashleybands.com/calendar"
    },
    {
      label: "Family Portal",
      href: "https://ashleybands.com/portal"
    },
    {
      label: "Current Fundraisers",
      href: "https://ashleybands.com/fundraising"
    },
    {
      label: "Band Shirts Store",
      href: "https://ashleybandshirts.printify.me/"
    }
  ],
  boosters: readRepoSource(sources.boosters).trim(),
  fundraisers,
  pages,
};

const contentDir = path.join(root, "content");
const publicDir = path.join(root, "public");
const siteDataPath = path.join(contentDir, "site-data.json");
const chatbotPath = path.join(publicDir, "chatbot-knowledge.txt");

let existingSiteData = null;
try {
  existingSiteData = JSON.parse(readFileSync(siteDataPath, "utf8"));
} catch {}
const existingBody = existingSiteData
  ? Object.fromEntries(Object.entries(existingSiteData).filter(([key]) => key !== "generatedAt"))
  : null;
const siteDataCurrent = existingBody && JSON.stringify(existingBody) === JSON.stringify(siteDataBody);
const siteData = {
  generatedAt:
    siteDataCurrent && existingSiteData?.generatedAt
      ? existingSiteData.generatedAt
      : new Date().toISOString(),
  ...siteDataBody,
};

const chatbotKnowledge = [
  "ASHLEY HIGH SCHOOL BAND PUBLIC KNOWLEDGE BASE",
  "",
  "The band calendar at ashleybands.com/calendar is the official source of truth for dates and times. Families subscribe to it once and updates appear automatically. If a date conflicts with another source, tell families to use the calendar or contact Mr. Parker.",
  "",
  readRepoSource(sources.assistantOverview).trim(),
  siteData.boosters,
  // Only current family-facing pages belong in answers. Legacy sponsorship
  // sheets redirect to /sponsors and must not compete with that live offer.
  ...pages.filter((page) => !page.archived && !["corporate-sponsorship", "family-sponsorship"].includes(page.slug))
    .map((page) => `\n\n${page.title.toUpperCase()}\nSource: https://ashleybands.com/info/${page.slug}\n${page.body}`),
  ...fundraisers.map((fundraiser) => `\n\n${fundraiser.title.toUpperCase()}\n${fundraiser.body}`)
].join("\n").replace(/\n{3,}/g, "\n\n");

const chatbotCurrent = existsSync(chatbotPath) && readFileSync(chatbotPath, "utf8") === chatbotKnowledge;

if (CHECK) {
  if (!siteDataCurrent || !chatbotCurrent) {
    if (!siteDataCurrent) console.error(`Public content projection drift: ${siteDataPath}`);
    if (!chatbotCurrent) console.error(`Chatbot projection drift: ${chatbotPath}`);
    process.exit(1);
  }
  console.log(`Public content projection OK: ${pages.length} pages, ${fundraisers.length} fundraisers`);
  process.exit(0);
}

mkdirSync(contentDir, { recursive: true });
mkdirSync(publicDir, { recursive: true });
writeFileSync(siteDataPath, JSON.stringify(siteData, null, 2));
writeFileSync(chatbotPath, chatbotKnowledge);

console.log(`Built public site content from ${pkaRoot}`);
