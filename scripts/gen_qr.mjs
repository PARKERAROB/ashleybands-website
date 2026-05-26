#!/usr/bin/env node
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");

const OUTDIR = "/Users/parkerarob/Desktop/BandDirectorOS/projects/instrument-inventory/QR Codes";
fs.mkdirSync(OUTDIR, { recursive: true });

const pages = [
  { path: "/instrument-inventory", title: "🎺 Instrument Inventory", label: "instruments" },
  { path: "/music-library", title: "🎵 Music Library", label: "music-library" },
];

for (const { path: urlPath, title, label } of pages) {
  const url = `https://ashleybands.com${urlPath}`;

  // Generate PNG file
  await QRCode.toFile(path.join(OUTDIR, `qr_${label}.png`), url, { width: 800, margin: 2, color: { dark: "#000000", light: "#ffffff" } });
  console.log(`  -> qr_${label}.png`);

  // Generate SVG file
  const svg = await QRCode.toString(url, { type: "svg", width: 400, margin: 2, color: { dark: "#000000", light: "#ffffff" } });
  fs.writeFileSync(path.join(OUTDIR, `qr_${label}.svg`), svg);
  console.log(`  -> qr_${label}.svg`);

  // Print-friendly HTML
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title} QR</title>
<style>
  body { font-family: system-ui, sans-serif; text-align: center; padding: 40px; background: #f8f8f8; }
  .card { background: #fff; border-radius: 12px; padding: 30px; max-width: 500px; margin: 20px auto; box-shadow: 0 2px 12px rgba(0,0,0,0.1); }
  h1 { font-size: 28px; margin: 0 0 5px; }
  .sub { color: #777; font-size: 14px; margin-bottom: 20px; }
  .qr svg { max-width: 300px; height: auto; }
  .url { font-size: 13px; color: #999; word-break: break-all; margin-top: 12px; }
  @media print { body { background: #fff; padding: 20px; } .card { box-shadow: none; border: 1px solid #ddd; } }
</style></head><body>
<div class="card">
  <h1>${title}</h1>
  <div class="sub">Scan to open the form on your phone</div>
  <div class="qr">${svg}</div>
  <div class="url">${url}</div>
</div>
</body></html>`;
  fs.writeFileSync(path.join(OUTDIR, `qr_${label}_print.html`), html);
  console.log(`  -> qr_${label}_print.html`);
}

console.log(`\n✅ Done! ${pages.length} QR codes in ${OUTDIR}`);