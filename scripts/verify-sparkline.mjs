import puppeteer from "puppeteer-core";

const exe = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await puppeteer.launch({ executablePath: exe, headless: true });
const pg = await browser.newPage();
await pg.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
await pg.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle0" });

const dom = await pg.evaluate(() => {
  const svg = [...document.querySelectorAll("#clientes svg")].find((s) => s.getAttribute("viewBox") === "0 0 120 40");
  const paths = svg.querySelectorAll("path");
  const grad = svg.querySelector("linearGradient");
  return {
    lineStroke: paths[1].getAttribute("stroke"),
    areaFill: paths[0].getAttribute("fill"),
    gradientStops: [...grad.querySelectorAll("stop")].map((s) => s.getAttribute("stop-color") + "@" + s.getAttribute("stop-opacity")),
    dotFill: svg.querySelector("circle").getAttribute("fill"),
    aria: svg.getAttribute("aria-label"),
  };
});

// reveal the section first (it's a .reveal element, opacity 0 until scrolled into view)
await pg.evaluate(() => {
  const svg = [...document.querySelectorAll("#clientes svg")].find((s) => s.getAttribute("viewBox") === "0 0 120 40");
  svg.scrollIntoView({ block: "center" });
});
await new Promise((r) => setTimeout(r, 800));

// clip a screenshot to the sparkline and count purple pixels
const svgEl = await pg.evaluateHandle(() => {
  const svg = [...document.querySelectorAll("#clientes svg")].find((s) => s.getAttribute("viewBox") === "0 0 120 40");
  return svg;
});
const box = await svgEl.asElement().boundingBox();
await svgEl.asElement().screenshot({ path: "shots/top3-sparkline.png" });

const purple = await pg.evaluate(async () => {
  const res = await fetch("shots/top3-sparkline.png?" + Date.now());
  const bmp = await createImageBitmap(await res.blob());
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = c.getContext("2d");
  ctx.drawImage(bmp, 0, 0);
  const { data } = ctx.getImageData(0, 0, bmp.width, bmp.height);
  let brand = 0, teal = 0, total = data.length / 4;
  const buckets = {};
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    if (Math.abs(r - 77) < 45 && g < 70 && b > 200) brand++; // #470dfa
    if (r < 120 && g > 140 && b > 140 && Math.abs(g - b) < 50) teal++; // #45a9a9
    if (r < 245 || g < 245 || b < 245) {
      const key = (r >> 4) + "," + (g >> 4) + "," + (b >> 4);
      buckets[key] = (buckets[key] || 0) + 1;
    }
  }
  const top = Object.entries(buckets).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return { total, brandPx: brand, tealPx: teal, topNonWhite: top };
});

console.log(JSON.stringify({ dom, purple }, null, 1));
await browser.close();
