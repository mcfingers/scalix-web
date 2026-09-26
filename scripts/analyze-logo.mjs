import puppeteer from "puppeteer-core";

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
  const c = new OffscreenCanvas(W, H);
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, W, H);

  // colour histogram (quantised) over opaque pixels
  const hist = new Map();
  let opaque = 0,
    transparent = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 16) {
      transparent++;
      continue;
    }
    opaque++;
    const key = `${data[i] >> 4},${data[i + 1] >> 4},${data[i + 2] >> 4},${a >> 5}`;
    hist.set(key, (hist.get(key) || 0) + 1);
  }
  const top = [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);

  // alpha bounding box
  let minX = W,
    minY = H,
    maxX = 0,
    maxY = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }

  // ASCII preview (120 cols) — colour-coded by dominant channel
  const cols = 120;
  const step = W / cols;
  const rows = Math.round(H / step / 2);
  let art = "";
  for (let r = 0; r < rows; r++) {
    for (let q = 0; q < cols; q++) {
      // sample the cell
      let rr = 0,
        gg = 0,
        bb = 0,
        aa = 0,
        n = 0;
      const x0 = Math.floor(q * step),
        x1 = Math.floor((q + 1) * step);
      const y0 = Math.floor(r * step * 2),
        y1 = Math.floor((r + 1) * step * 2);
      for (let y = y0; y < y1; y += 2)
        for (let x = x0; x < x1; x += 2) {
          const i = (y * W + x) * 4;
          rr += data[i];
          gg += data[i + 1];
          bb += data[i + 2];
          aa += data[i + 3];
          n++;
        }
      if (!n) continue;
      const a = aa / n;
      if (a < 40) {
        art += ".";
        continue;
      }
      const R = rr / n,
        G = gg / n,
        B = bb / n;
      const mx = Math.max(R, G, B),
        mn = Math.min(R, G, B);
      const sat = mx === 0 ? 0 : (mx - mn) / mx;
      if (sat < 0.25) art += "#"; // grey/black text
      else if (B >= R && B >= G) art += B > 200 && R < 150 ? "b" : "p"; // blue vs purple
      else if (G >= R && G >= B) art += "g"; // green/teal
      else if (R >= G && R > B) art += G > 150 ? "y" : "r"; // red/orange/yellow
      else art += "?";
    }
    art += "\n";
  }

  return { W, H, opaque, transparent, bbox: [minX, minY, maxX, maxY], top, art };
});

console.log(
  JSON.stringify(
    { W: out.W, H: out.H, opaque: out.opaque, transparent: out.transparent, bbox: out.bbox, top: out.top },
    null,
    1
  )
);
console.log(out.art);
await browser.close();
