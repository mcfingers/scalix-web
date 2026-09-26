import puppeteer from "puppeteer-core";

const exe = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await puppeteer.launch({ executablePath: exe, headless: true });
const pg = await browser.newPage();
await pg.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle0" });

for (const file of ["trustbar-1440.png", "trustbar-375.png"]) {
  const stats = await pg.evaluate(async (file) => {
    const res = await fetch("shots/" + file);
    const bmp = await createImageBitmap(await res.blob());
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = c.getContext("2d");
    ctx.drawImage(bmp, 0, 0);
    const { data } = ctx.getImageData(0, 0, bmp.width, bmp.height);
    let nonWhite = 0, dark = 0;
    const colors = new Set();
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      if (r < 250 || g < 250 || b < 250) nonWhite++;
      if (r < 200 && g < 200 && b < 200) dark++;
      if (colors.size < 5000) colors.add((r >> 3) + "," + (g >> 3) + "," + (b >> 3));
    }
    const total = data.length / 4;
    return {
      size: bmp.width + "x" + bmp.height,
      nonWhitePct: +(100 * nonWhite / total).toFixed(2),
      darkPct: +(100 * dark / total).toFixed(2),
      colorBuckets: colors.size,
    };
  }, file);
  console.log(file, JSON.stringify(stats));
}
await browser.close();
