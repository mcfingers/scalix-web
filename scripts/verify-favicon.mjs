import puppeteer from "puppeteer-core";
import fs from "fs";

const exe = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await puppeteer.launch({ executablePath: exe, headless: true });
const pg = await browser.newPage();
const errors = [];
const failed = [];
pg.on("console", (m) => m.type() === "error" && errors.push(m.text()));
pg.on("pageerror", (e) => errors.push(String(e)));
pg.on("requestfailed", (r) => failed.push(r.url()));
await pg.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle0" });

const out = await pg.evaluate(async () => {
  const loadImg = (url) =>
    new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("load failed: " + url));
      i.src = url;
    });

  const files = ["favicon-16x16.png", "favicon-32x32.png", "favicon-48x48.png", "apple-touch-icon.png", "favicon.svg"];
  const results = {};

  for (const f of files) {
    const r = await fetch(f);
    if (!r.ok) {
      results[f] = { status: r.status };
      continue;
    }
    const img = await loadImg(f + "?t=" + Date.now());
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    let opaque = 0,
      purple = 0,
      minX = c.width,
      minY = c.height,
      maxX = -1,
      maxY = -1;
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        if (data[i + 3] > 160) {
          opaque++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          const [R, G, B] = [data[i], data[i + 1], data[i + 2]];
          if (Math.abs(R - 71) < 45 && Math.abs(G - 13) < 45 && Math.abs(B - 250) < 45) purple++;
        }
      }
    const cw = maxX - minX + 1,
      ch = maxY - minY + 1;
    results[f] = {
      status: r.status,
      dims: c.width + "x" + c.height,
      opaquePx: opaque,
      purplePct: +(100 * purple / opaque).toFixed(1),
      contentBBox: [minX, minY, maxX, maxY],
      contentRatio: +(cw / ch).toFixed(2), // arrow ratio ≈ 353/303 = 1.17
      centred:
        Math.abs(minX - (c.width - 1 - maxX)) <= 2 && Math.abs(minY - (c.height - 1 - maxY)) <= 3,
    };
  }

  results.iconLinks = [...document.querySelectorAll("link[rel]")]
    .filter((l) => /icon/i.test(l.rel))
    .map((l) => ({ rel: l.rel, href: l.getAttribute("href"), type: l.type, sizes: l.sizes && l.sizes.value }));

  const ld = document.querySelector('script[type="application/ld+json"]');
  results.jsonldStillFullLogo = ld ? ld.textContent.includes("logo-scalix.png") : false;
  return results;
});

// favicon.ico structure
const ico = fs.readFileSync("favicon.ico");
const icoCheck = {
  bytes: ico.length,
  type: ico.readUInt16LE(2),
  count: ico.readUInt16LE(4),
  entries: [],
};
for (let i = 0; i < icoCheck.count; i++) {
  const off = 6 + i * 16;
  icoCheck.entries.push({
    size: ico.readUInt8(off) || 256,
    bpp: ico.readUInt16LE(off + 6),
    bytes: ico.readUInt32LE(off + 8),
    isPng: ico.readUInt32LE(ico.readUInt32LE(off + 12)) === 0x474e5089, // PNG magic, LE
  });
}

out["favicon.ico"] = icoCheck;
out.oldIconLinkGone = !out.iconLinks.some((l) => l.href === "logo-scalix.png");
out.errors = errors;
out.failedRequests = failed;

console.log(JSON.stringify(out, null, 1));
await browser.close();
