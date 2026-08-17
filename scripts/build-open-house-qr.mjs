import QRCode from "qrcode";
import fs from "node:fs";
import path from "node:path";

const output = path.join(process.cwd(), "tmp", "pdfs", "open-house-challenge-qr.png");
fs.mkdirSync(path.dirname(output), { recursive: true });
await QRCode.toFile(output, "https://ashleybands.com/open-house", {
  width: 1200,
  margin: 3,
  errorCorrectionLevel: "H",
  color: { dark: "#111111", light: "#ffffff" }
});
console.log(output);

