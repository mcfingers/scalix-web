import puppeteer from "puppeteer-core";

const exe = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await puppeteer.launch({ executablePath: exe, headless: true });
const out = {};

for (const w of [375, 768, 1024, 1280, 1440]) {
  const pg = await browser.newPage();
  await pg.setViewport({ width: w, height: 900 });
  await pg.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle0" });
  out[w] = await pg.evaluate(() => {
    const fig = document.querySelector("#clientes figure.lg\\:col-span-2");
    const caption = fig.querySelector("figcaption");
    const text = caption.querySelector("div");
    const svg = caption.querySelector("svg");
    const tr = text.getBoundingClientRect();
    const sr = svg.getBoundingClientRect();
    const overlapsVertically = sr.top < tr.bottom && sr.bottom > tr.top;
    const sameRow = overlapsVertically && sr.left >= tr.right - 1;
    return {
      captionW: Math.round(caption.clientWidth),
      textW: Math.round(tr.width),
      textH: Math.round(tr.height),
      svgW: Math.round(sr.width),
      svgWanted: Math.round(svg.getBoundingClientRect().width),
      textRight: Math.round(tr.right),
      svgLeft: Math.round(sr.left),
      sameRow,
      overflows: svg.right > caption.getBoundingClientRect().right + 1,
    };
  });
  await pg.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
