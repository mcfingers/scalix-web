import puppeteer from "puppeteer-core";
import fs from "fs";

const exe = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await puppeteer.launch({ executablePath: exe, headless: true });
const pg = await browser.newPage();
await pg.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });

const out = await pg.evaluate(async () => {
  const img = new Image();
  img.src = "logo-scalix.png";
  await img.decode();
  const W = img.naturalWidth,
    H = img.naturalHeight;
  const probe = new OffscreenCanvas(W, H);
  const pctx = probe.getContext("2d");
  pctx.drawImage(img, 0, 0);
  const { data } = pctx.getImageData(0, 0, W, H);

  // exact bbox of the arrow (left-most mark, x < 450 — everything before the "s")
  let x0 = W,
    y0 = H,
    x1 = 0,
    y1 = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < 450; x++) {
      if (data[(y * W + x) * 4 + 3] > 16) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  const aw = x1 - x0 + 1,
    ah = y1 - y0 + 1;

  // square canvas, arrow centred, width = side * ratio
  const mk = (side, ratio) => {
    const c = document.createElement("canvas");
    c.width = side;
    c.height = side;
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const w = Math.round(side * ratio),
      h = Math.round((w * ah) / aw);
    ctx.drawImage(img, x0, y0, aw, ah, Math.round((side - w) / 2), Math.round((side - h) / 2), w, h);
    return c;
  };
  const png = (c) => c.toDataURL("image/png").split(",")[1];

  const full = mk(160, 1); // embed point: covers every real favicon display size at a fraction of the weight
  const svgBody = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${aw} ${aw}" width="${aw}" height="${aw}"><image href="data:image/png;base64,${full
    .toDataURL("image/png")
    .split(",")[1]}" width="${aw}" height="${aw}"/></svg>`;

  return {
    bbox: { x0, y0, aw, ah },
    icons: {
      "favicon-16x16.png": png(mk(16, 1)),
      "favicon-32x32.png": png(mk(32, 1)),
      "favicon-48x48.png": png(mk(48, 1)),
      "apple-touch-icon.png": png(mk(180, 0.78)), // ~12% padding, iOS style
    },
    svg: svgBody,
  };
});

await browser.close();

fs.writeFileSync("favicon.svg", out.svg);
for (const [name, b64] of Object.entries(out.icons)) {
  fs.writeFileSync(name, Buffer.from(b64, "base64"));
}

// favicon.ico = PNG-in-ICO container (16 + 32 + 48)
const entries = ["favicon-16x16.png", "favicon-32x32.png", "favicon-48x48.png"].map((f) => ({
  size: parseInt(f.match(/(\d+)/)[1], 10),
  buf: fs.readFileSync(f),
}));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(entries.length, 4);
let offset = 6 + entries.length * 16;
const dir = [];
for (const e of entries) {
  const d = Buffer.alloc(16);
  d.writeUInt8(e.size >= 256 ? 0 : e.size, 0);
  d.writeUInt8(e.size >= 256 ? 0 : e.size, 1);
  d.writeUInt8(0, 2);
  d.writeUInt8(0, 3);
  d.writeUInt16LE(1, 4); // planes
  d.writeUInt16LE(32, 6); // bpp
  d.writeUInt32LE(e.buf.length, 8);
  d.writeUInt32LE(offset, 12);
  offset += e.buf.length;
  dir.push(d);
}
fs.writeFileSync("favicon.ico", Buffer.concat([header, ...dir, ...entries.map((e) => e.buf)]));

console.log(
  JSON.stringify(
    {
      arrowBBox: out.bbox,
      files: ["favicon.svg", "favicon.ico", ...Object.keys(out.icons)].map((f) => ({
        f,
        bytes: fs.statSync(f).size,
      })),
    },
    null,
    1
  )
);
