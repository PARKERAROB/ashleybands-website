#!/usr/bin/env node
/**
 * Sponsorship prospect contact enrichment via Firecrawl.
 *
 * Goal: maximize EMAIL coverage on the businesses table so Mr. Parker can run
 * cold EMAIL outreach (preferred over phone). For each local-sponsorable
 * prospect that lacks an email, scrape its homepage + likely contact/about
 * pages and extract the best email. Capture a contact-form URL + confidence +
 * source when no published email exists.
 *
 * Does NOT write to Supabase. Writes a staging CSV that a guarded apply step
 * merges later (layer separation: research/estimates stay out of canonical
 * until reviewed). Resumable: re-running skips prospects already in the CSV.
 *
 * Usage:
 *   node scripts/enrich-contacts-firecrawl.mjs            # full run
 *   node scripts/enrich-contacts-firecrawl.mjs --limit 5  # smoke test
 *   node scripts/enrich-contacts-firecrawl.mjs --with-website-only
 *
 * Requires: firecrawl CLI already authenticated (firecrawl scrape works).
 */
import { readFileSync, existsSync, appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const OUT = "/Users/parkerarob/Desktop/BandsofAHS/data/_work/contact-enrichment.csv";
const LIMIT = (() => { const i = process.argv.indexOf("--limit"); return i > -1 ? Number(process.argv[i + 1]) : Infinity; })();
const WITH_WEBSITE_ONLY = process.argv.includes("--with-website-only");

// ---- env / supabase ----
const ENV_PATH = "/Users/parkerarob/Desktop/Band/band-website/.env.local";
try {
  for (const line of readFileSync(ENV_PATH, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) { console.error("Missing Supabase env in .env.local"); process.exit(1); }

const canon = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

// ---- national-chain / non-prospect detection ----
// Cold-emailing a corporate store-locator page is pointless for a local HS band.
// These are flagged skip so we never waste a scrape or an outreach send on them.
const CHAIN_PATTERNS = [
  /^(target|walmart|wal-mart|home depot|lowe'?s|sam'?s club|costco|bj'?s|big lots|aldi|food lion|harris teeter|publix|trader joe)/i,
  /^(mcdonald'?s|burger king|wendy'?s|taco bell|kfc|chick-?fil-?a|popeyes|sonic|hardee'?s|arby'?s|bojangles|cook ?out|checkers|rally'?s|zaxby'?s|cookout|five guys|culver'?s|whataburger|raising cane)/i,
  /^(subway|jimmy john'?s|jersey mike'?s|firehouse subs|panera|chipotle|qdoba|moe'?s|einstein|jason'?s deli)/i,
  /^(starbucks|dunkin|krispy kreme|tim hortons|biscuitville)/i,
  /^(domino'?s|pizza hut|papa john'?s|little caesars|papa murphy'?s|marco'?s pizza)/i,
  /^(applebee'?s|chili'?s|outback|olive garden|red lobster|ihop|denny'?s|cracker barrel|texas roadhouse|longhorn|ruby tuesday|golden corral|waffle house)/i,
  /^(cvs|walgreens|rite aid|duane reade)/i,
  /^(bank of america|wells fargo|chase|truist|bb&t|suntrust|pnc|td bank|citibank|capital one|us bank|first citizens|state employees'? credit)/i,
  /^(shell|exxon|bp|chevron|mobil|valero|sunoco|7-?eleven|circle k|wawa|sheetz|speedway|marathon|citgo|kangaroo)/i,
  /^(family dollar|dollar general|dollar tree|five below)/i,
  /^(at&t|verizon|t-mobile|sprint|xfinity|spectrum|metropcs|boost mobile|cricket)/i,
  /^(advance auto|autozone|o'?reilly|napa auto|pep boys|firestone|midas|jiffy lube|valvoline|meineke|take 5)/i,
  /^(aaa |american automobile)/i,
  /^(planet fitness|anytime fitness|crunch fitness|orangetheory|ymca|gold'?s gym)/i,
  /^(great clips|supercuts|sport clips|fantastic sams)/i,
  /^(enterprise|hertz|avis|budget|u-?haul|penske)/i,
  /^(emergeortho|novant|nhrmc|atrium|cape fear valley)/i,  // large health systems — institutional, not local-owned sponsor
];
// Store-locator / national-brand host fragments — a "website" that is really a corp locator.
const LOCATOR_HOST = /(^|\.)(locations?|stores?|locator|local|maps)\./i;

function isChain(name) {
  return CHAIN_PATTERNS.some((r) => r.test(String(name || "")));
}

// ---- email extraction ----
const EMAIL_RE = /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/gi;
const JUNK_EMAIL = /(sentry|wix|wixpress|example\.com|domain\.com|email@|your@|name@|godaddy|squarespace|cloudflare|\.png|\.jpg|\.jpeg|\.gif|\.webp|@sentry|@2x|core-js|schema\.org|googleapis|gstatic|w3\.org|sentry\.io|jquery)/i;
// Role-based local addresses we most want for a cold first-touch.
const ROLE_PREF = /^(info|office|contact|hello|admin|frontdesk|front\.desk|reception|appointments|sales|team|mail|hi|booking|service)@/i;

function hostOf(u) {
  try { return new URL(u.startsWith("http") ? u : "https://" + u).hostname.replace(/^www\./, ""); }
  catch { return ""; }
}

// Tokens from a business name we can use to judge whether an email's domain
// actually belongs to that business (guards against grabbing a wrong company).
const STOP = new Set(["the","and","of","llc","inc","co","company","pa","dds","md","group","center","centre","services","service","shop","store","wilmington","carolina","beach","nc","north"]);
function nameTokens(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((t) => t.length >= 4 && !STOP.has(t));
}
// Strip a phone number or other digits mashed into the local part by bad
// page formatting: "states9103997212info@x" -> "info@x".
function cleanEmail(e) {
  let [local, domain] = e.split("@");
  if (!local || !domain) return e;
  const m = local.match(/\d{5,}([a-z][a-z0-9._%+\-]*)$/i);
  if (m) local = m[1];
  return `${local}@${domain}`;
}

// Related if the email's DOMAIN or its LOCAL part contains a business name token
// (free-mail addresses carry the identity in the local part, e.g. atasteofitalydeli@yahoo.com).
function emailRelated(email, tokens, siteHost) {
  const [local, dom = ""] = email.split("@");
  if (siteHost && dom.includes(siteHost.split(".").slice(-2).join("."))) return true;
  const domCore = dom.replace(/\.(com|net|org|us|co|biz|info).*$/, "").replace(/[^a-z0-9]/g, "");
  const localCore = (local || "").replace(/[^a-z0-9]/g, "");
  return tokens.some((t) => domCore.includes(t) || t.includes(domCore) || localCore.includes(t));
}

function extractEmails(text, siteHost, tokens = []) {
  const found = new Set();
  for (const raw of String(text || "").match(EMAIL_RE) || []) {
    const e = cleanEmail(raw.toLowerCase().replace(/\.$/, ""));
    if (JUNK_EMAIL.test(e)) continue;
    if (e.length > 60) continue;
    found.add(e);
  }
  const list = [...found];
  if (!list.length) return null;
  const related = list.filter((e) => emailRelated(e, tokens, siteHost));
  const isFree = (e) => /@(gmail|yahoo|aol|outlook|hotmail|icloud|live|comcast)\./.test(e);
  // Prefer related (domain/local) business addresses; within that prefer role-based, then shortest.
  const pool = related.length ? related : list;
  pool.sort((a, b) => (isFree(a) - isFree(b)) || (ROLE_PREF.test(b) - ROLE_PREF.test(a)) || (a.length - b.length));
  const best = pool[0];
  let confidence;
  if (related.length && !isFree(best)) confidence = ROLE_PREF.test(best) ? "high" : "medium";
  else if (related.length) confidence = "medium";           // related but free-mail domain
  else confidence = "low";                                   // not obviously tied to this business
  // Whether this email is safe to auto-use for a cold send.
  const usable = confidence !== "low";
  return { best, all: list.join("; "), confidence, usable };
}

function searchText(query) { return run(["search", query, "--limit", "5"]); } // returns {text, failed}

// ---- firecrawl wrapper ----
// Detect credit/rate-limit exhaustion so we can STOP cleanly instead of
// recording rate-limited businesses as "no email" (which would mark them done
// and skip them on next month's run). limitHit is checked in the main loop.
let limitHit = false;
const LIMIT_RE = /(payment required|insufficient|out of credit|no credits|credit limit|monthly limit|quota|rate ?limit|too many requests|\b402\b|\b429\b|upgrade your plan|exceeded)/i;
function run(args) {
  try {
    const text = execFileSync("firecrawl", args, {
      encoding: "utf8", timeout: 60000, maxBuffer: 20 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
    });
    return { text, failed: false };
  } catch (e) {
    const blob = `${e.stderr || ""}${e.stdout || ""}${e.message || ""}`;
    if (LIMIT_RE.test(blob)) limitHit = true;
    return { text: "", failed: true };
  }
}
function fc(u, format) { return run(["scrape", u, "-f", format]).text; }

function pickContactLinks(linksText, siteHost) {
  const out = [];
  for (const ln of String(linksText || "").split("\n")) {
    const u = ln.trim();
    if (!u || !/^https?:\/\//.test(u)) continue;
    if (hostOf(u) !== siteHost) continue;
    if (/(contact|about|connect|reach|location|staff|team|appointment)/i.test(u)) out.push(u);
  }
  return [...new Set(out)].slice(0, 3);
}

function findContactForm(linksText, mdText) {
  const blob = `${linksText}\n${mdText}`;
  const m = blob.match(/https?:\/\/[^\s)]*contact[^\s)"']*/i);
  return m ? m[0] : null;
}

// ---- CSV ----
const HEADER = "name_canonical,name_display,website,email_found,email_all,email_confidence,contact_url,method,scraped_at\n";
function csvCell(v) { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
function appendRow(r) {
  appendFileSync(OUT, [r.name_canonical, r.name_display, r.website, r.email_found, r.email_all, r.email_confidence, r.contact_url, r.method, r.scraped_at].map(csvCell).join(",") + "\n");
}

// ---- main ----
const res = await fetch(`${url}/rest/v1/businesses?select=*&order=name_display.asc`, {
  headers: { apikey: secret, Authorization: `Bearer ${secret}` },
});
const all = await res.json();

if (!existsSync(OUT)) writeFileSync(OUT, HEADER);
const done = new Set(
  readFileSync(OUT, "utf8").split("\n").slice(1).filter(Boolean).map((l) => l.split(",")[0].replace(/^"|"$/g, ""))
);

// Candidates: no email, not skip/already-sponsor, not a chain.
let candidates = all.filter((b) =>
  (!b.email || !b.email.trim()) &&
  !["skip", "already-sponsor", "declined"].includes(b.outreach_status) &&
  !isChain(b.name_display) &&
  !done.has(b.name_canonical)
);
if (WITH_WEBSITE_ONLY) candidates = candidates.filter((b) => b.website && b.website.trim());
candidates = candidates.slice(0, LIMIT);

console.log(`Total businesses: ${all.length}`);
console.log(`Chains flagged (skipped): ${all.filter((b) => isChain(b.name_display)).length}`);
console.log(`Already enriched in CSV: ${done.size}`);
console.log(`Candidates this run: ${candidates.length}\n`);

let withEmail = 0, withForm = 0, nothing = 0;
for (let i = 0; i < candidates.length; i++) {
  const b = candidates[i];
  const tag = `[${i + 1}/${candidates.length}] ${b.name_display}`;
  const tokens = nameTokens(b.name_display);
  const siteHost = b.website ? hostOf(b.website) : "";
  const locator = b.website && (LOCATOR_HOST.test(b.website) || LOCATOR_HOST.test(siteHost));
  const realSite = b.website && b.website.trim() && !locator;
  const scraped_at = new Date().toISOString();

  let hit = null, method = "", low = null;
  // Keep a usable hit; remember any low-confidence candidate for human review.
  const consider = (h, m) => { if (!h) return; if (h.usable && !hit) { hit = h; method = m; } else if (!h.usable && !low) { low = h; } };

  // 1) Search-first — highest yield (catches directory/social/Google-profile emails).
  const city = (b.city && b.city.trim()) || "Wilmington";
  const sres = searchText(`${b.name_display} ${city} NC contact email`);
  // Credit/rate limit: stop now WITHOUT recording this business, so it (and all
  // remaining) are retried next run. Resumable — already-done rows are skipped.
  if (limitHit) {
    console.log(`\nLIMIT REACHED at [${i + 1}/${candidates.length}] ${b.name_display}.`);
    console.log(`Stopped cleanly. ${i} processed this run; ${candidates.length - i} remain for next batch.`);
    break;
  }
  // Transient (non-limit) search failure: skip without recording so it retries later.
  if (sres.failed) { console.log(`${tag} -> search failed (transient), will retry next run`); continue; }
  consider(extractEmails(sres.text, siteHost, tokens), "search");

  // 2) Fallback: scrape the real homepage + a contact/about subpage.
  let homeLinks = "", homeMd = "";
  if (!hit && realSite) {
    homeMd = fc(b.website, "markdown");
    homeLinks = fc(b.website, "links");
    consider(extractEmails(homeMd, siteHost, tokens), "homepage");
    if (!hit) {
      for (const cu of pickContactLinks(homeLinks, siteHost)) {
        consider(extractEmails(fc(cu, "markdown"), siteHost, tokens), `subpage:${cu}`);
        if (hit) break;
      }
    }
  }

  // Limit hit during the scrape fallback (no usable hit) — stop without recording.
  if (limitHit && !hit) {
    console.log(`\nLIMIT REACHED at [${i + 1}/${candidates.length}] ${b.name_display} (during scrape).`);
    console.log(`Stopped cleanly. ${i} processed this run; ${candidates.length - i} remain for next batch.`);
    break;
  }

  if (hit) {
    appendRow({ name_canonical: b.name_canonical, name_display: b.name_display, website: b.website || "", email_found: hit.best, email_all: hit.all, email_confidence: hit.confidence, contact_url: "", method, scraped_at });
    withEmail++; console.log(`${tag} -> ${hit.best} (${hit.confidence}/${method})`);
  } else if (low) {
    // Found something, but not confidently tied to this business — record for review, do not promote.
    appendRow({ name_canonical: b.name_canonical, name_display: b.name_display, website: b.website || "", email_found: "", email_all: low.all, email_confidence: "low", contact_url: "", method: "low-confidence-review", scraped_at });
    nothing++; console.log(`${tag} -> low-confidence only (review): ${low.all}`);
  } else {
    const form = realSite ? findContactForm(homeLinks, homeMd) : "";
    const m = locator ? "chain-locator" : !b.website ? "no-website" : form ? "contact-form-only" : "no-email-found";
    appendRow({ name_canonical: b.name_canonical, name_display: b.name_display, website: b.website || "", email_found: "", email_all: "", email_confidence: "", contact_url: form || "", method: m, scraped_at });
    if (form) { withForm++; console.log(`${tag} -> no email, contact form: ${form}`); }
    else { nothing++; console.log(`${tag} -> ${m}`); }
  }
}

console.log(`\nDONE. email=${withEmail} contact-form=${withForm} nothing=${nothing}`);
