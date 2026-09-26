import puppeteer from "puppeteer-core";

const exe = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await puppeteer.launch({ executablePath: exe, headless: true });
const out = {};

for (const w of [375, 768, 1024, 1440]) {
  const pg = await browser.newPage();
  await pg.setViewport({ width: w, height: 900 });
  await pg.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle0" });
  out[w] = await pg.evaluate(() => {
    const card = document.querySelector("#comparativa .shadow-card");
    const r = card.getBoundingClientRect();
    const scroll = card.querySelector(".overflow-x-auto");
    return {
      cardWidth: Math.round(r.width),
      leftGap: Math.round(r.left),
      rightGap: Math.round(document.documentElement.clientWidth - r.right),
      tableScrolls: scroll.scrollWidth > scroll.clientWidth,
      pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  await pg.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
