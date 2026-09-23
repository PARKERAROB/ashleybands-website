import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  MATTRESS_SALE_BANNER_ENDS_AT,
  MATTRESS_SALE_BANNER_ENDS_MS,
  MATTRESS_SALE_EVENT_URL,
  isMattressSaleBannerActive
} from "../lib/mattressSaleBanner.mjs";

const easternParts = (ms) => Object.fromEntries(
  new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  }).formatToParts(ms).map(({ type, value }) => [type, value])
);

test("the banner ends exactly at midnight after Saturday, September 26, 2026, Eastern time", () => {
  const end = easternParts(MATTRESS_SALE_BANNER_ENDS_MS);
  assert.deepEqual([end.year, end.month, end.day, end.hour, end.minute, end.second], ["2026", "09", "27", "00", "00", "00"]);
  const lastMoment = easternParts(MATTRESS_SALE_BANNER_ENDS_MS - 1);
  assert.deepEqual([lastMoment.month, lastMoment.day, lastMoment.hour, lastMoment.minute], ["09", "26", "23", "59"]);
  assert.equal(MATTRESS_SALE_BANNER_ENDS_AT, "2026-09-27T04:00:00.000Z");
});

test("the banner shows through the sale and hides after it", () => {
  assert.equal(isMattressSaleBannerActive(Date.parse("2026-09-23T12:00:00-04:00")), true);
  assert.equal(isMattressSaleBannerActive(Date.parse("2026-09-26T16:00:00-04:00")), true);
  assert.equal(isMattressSaleBannerActive(Date.parse("2026-09-26T23:59:59.999-04:00")), true);
  assert.equal(isMattressSaleBannerActive(Date.parse("2026-09-27T00:00:00-04:00")), false);
  assert.equal(isMattressSaleBannerActive(Date.parse("2026-09-28T09:00:00-04:00")), false);
  assert.equal(isMattressSaleBannerActive(Number.NaN), false);
});

test("the banner links to the current event and keeps the public copy rules", () => {
  assert.equal(MATTRESS_SALE_EVENT_URL, "https://www.facebook.com/events/1781228726134496");
  const component = readFileSync(new URL("../components/MattressSaleBanner.jsx", import.meta.url), "utf8");
  assert.match(component, /target="_blank" rel="noopener noreferrer"/);
  assert.doesNotMatch(component, /1737935664123955/);
  assert.doesNotMatch(component, /—/, "no em dashes in public copy");
  assert.match(component, /September 26/);
  assert.match(component, /10 AM to 4 PM in the Ashley gym\. Open to the public\. Every purchase supports the band\./);
  const home = readFileSync(new URL("../app/page.jsx", import.meta.url), "utf8");
  assert.ok(home.indexOf("<MattressSaleBanner />") < home.indexOf('className="home-campaign-hero"'), "banner sits above the Carnegie hero");
});
