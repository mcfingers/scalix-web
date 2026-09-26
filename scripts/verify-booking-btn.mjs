import puppeteer from "puppeteer-core";

const exe = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await puppeteer.launch({ executablePath: exe, headless: true });
const out = {};

for (const w of [375, 768, 1440]) {
  const pg = await browser.newPage();
  await pg.setViewport({ width: w, height: 900 });
  await pg.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle0" });
  out[w] = await pg.evaluate(() => {
    const btn = document.querySelector('#contacto a[href*="calendar.google.com"]');
    const icons = [...btn.querySelectorAll("svg")];
    const r = btn.getBoundingClientRect();
    return {
      btnWidth: Math.round(r.width),
      btnHeight: Math.round(r.height),
      iconSizes: icons.map((i) => {
        const b = i.getBoundingClientRect();
        return Math.round(b.width) + "x" + Math.round(b.height);
      }),
      padding: getComputedStyle(btn).padding,
      gap: getComputedStyle(btn).gap,
      fontSize: getComputedStyle(btn).fontSize,
      withinCard: r.right <= document.documentElement.clientWidth,
      pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  await pg.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
