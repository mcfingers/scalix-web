import puppeteer from "puppeteer-core";

const exe = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await puppeteer.launch({ executablePath: exe, headless: true });
const out = {};

for (const width of [1440, 375]) {
  const pg = await browser.newPage();
  await pg.setViewport({ width, height: 900 });
  const errors = [];
  pg.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  pg.on("pageerror", (e) => errors.push(String(e)));
  await pg.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1800)); // let the video fade settle

  // geometry of the hero + curve svg
  const geo = await pg.evaluate(() => {
    const sec = document.getElementById("inicio").getBoundingClientRect();
    const svg = document.querySelector("#inicio svg[viewBox='0 0 1440 72']").getBoundingClientRect();
    return {
      secBottom: Math.round(sec.bottom + window.scrollY),
      svgTop: Math.round(svg.top + window.scrollY),
      svgH: Math.round(svg.height),
      videoOpacity: getComputedStyle(document.getElementById("hero-video")).opacity,
      videoPlaying: !document.getElementById("hero-video").paused,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  // scroll so the curve strip sits well above the mobile fixed bottom bar
  await pg.evaluate((b) => window.scrollTo(0, Math.max(0, b - 700)), geo.secBottom);
  await new Promise((r) => setTimeout(r, 300));

  const file = `hero-curve-${width}.png`;
  await pg.screenshot({ path: `shots/${file}` });

  const pixels = await pg.evaluate(async (file, secBottom, svgTop, svgH) => {
    const res = await fetch("shots/" + file + "?t=" + Date.now());
    const bmp = await createImageBitmap(await res.blob());
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = c.getContext("2d");
    ctx.drawImage(bmp, 0, 0);
    const { data, width: W } = ctx.getImageData(0, 0, bmp.width, bmp.height);
    // viewport-relative y of the curve strip (we scrolled so secBottom is near viewport bottom)
    const scrollY = window.scrollY;
    const rowAt = (yDoc) => Math.round(yDoc - scrollY);
    const px = (x, yVp) => {
      const i = (yVp * W + x) * 4;
      return [data[i], data[i + 1], data[i + 2]];
    };
    const isWhite = ([r, g, b]) => r > 235 && g > 235 && b > 235;
    const svgTopVp = rowAt(svgTop);
    const svgBotVp = rowAt(secBottom);
    const midVp = svgTopVp + Math.floor((svgBotVp - svgTopVp) / 2);
    // white fill at the edges occupies the BOTTOM of the strip (curve boundary is
    // ~28/72 down at x=0 and reaches the very bottom at centre) → sample 5px above bottom
    const edgeY = svgBotVp - 5;
    const inView = (y) => y >= 0 && y < bmp.height;
    const hit = (x, y) => {
      const el = document.elementFromPoint(x, y);
      return el ? el.tagName + (el.closest("#inicio") ? "" : " (OUTSIDE-HERO)") : "none";
    };
    const res1 = {
      svgTopVp,
      svgBotVp,
      bmpH: bmp.height,
      hitLeft: hit(6, edgeY),
      hitCentre: hit(Math.floor(bmp.width / 2), midVp),
      leftEdge: { at: [6, edgeY], rgb: px(6, edgeY), white: isWhite(px(6, edgeY)) },
      rightEdge: { at: [bmp.width - 7, edgeY], rgb: px(bmp.width - 7, edgeY), white: isWhite(px(bmp.width - 7, edgeY)) },
      centre: { at: [Math.floor(bmp.width / 2), midVp], rgb: px(Math.floor(bmp.width / 2), midVp), white: isWhite(px(Math.floor(bmp.width / 2), midVp)) },
      inView: inView(svgTopVp + 2) && inView(edgeY) && inView(midVp),
    };
    return res1;
  }, file, geo.secBottom, geo.svgTop, geo.svgH);

  out[width] = { geo, pixels, errors };
  await pg.close();
}

console.log(JSON.stringify(out, null, 1));
await browser.close();
