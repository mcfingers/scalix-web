import puppeteer from "puppeteer-core";

const exe = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const regions = [
  { name: "glyph@461 (component 6)", x0: 445, y0: 250, x1: 775, y1: 585, cols: 100 },
  { name: "glyph@773 (component 2)", x0: 758, y0: 250, x1: 1090, y1: 585, cols: 100 },
  { name: "glyph@1083 (component 3)", x0: 1068, y0: 250, x1: 1425, y1: 585, cols: 100 },
  { name: "final cluster (components 4,8,9)", x0: 1675, y0: 255, x1: 2070, y1: 585, cols: 110 },
];

const browser = await puppeteer.launch({ executablePath: exe, headless: true });
const pg = await browser.newPage();
await pg.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });

for (const r of regions) {
  const art = await pg.evaluate(async (r) => {
    const img = new Image();
    img.src = "logo-scalix.png";
    await img.decode();
    const W = img.naturalWidth,
      H = img.naturalHeight;
    const c = new OffscreenCanvas(W, H);
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, W, H);
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : data[(y * W + x) * 4 + 3]);
    const rw = r.x1 - r.x0,
      rh = r.y1 - r.y0;
    const sx = rw / r.cols;
    const rows = Math.max(1, Math.round(rh / sx / 2));
    let art = "";
    for (let row = 0; row < rows; row++) {
      for (let q = 0; q < r.cols; q++) {
        let hit = 0,
          n = 0;
        const x0 = Math.floor(r.x0 + q * sx),
          x1 = Math.floor(r.x0 + (q + 1) * sx);
        const y0 = Math.floor(r.y0 + (row * rh) / rows),
          y1 = Math.floor(r.y0 + ((row + 1) * rh) / rows);
        for (let y = y0; y < y1; y++)
          for (let x = x0; x < x1; x++) {
            if (at(x, y) > 100) hit++;
            n++;
          }
        art += n && hit / n > 0.4 ? "#" : ".";
      }
      art += "\n";
    }
    return art;
  }, r);
  console.log(`\n=== ${r.name} ===`);
  console.log(art);
}
await browser.close();
