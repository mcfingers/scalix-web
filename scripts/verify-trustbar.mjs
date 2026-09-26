import puppeteer from "puppeteer-core";

const exe = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await puppeteer.launch({ executablePath: exe, headless: true });
const out = {};

for (const w of [375, 768, 1024, 1440]) {
  const pg = await browser.newPage();
  await pg.setViewport({ width: w, height: 900 });
  const fails = [];
  pg.on("requestfailed", (r) => fails.push(r.url()));
  pg.on("response", (r) => {
    if (r.status() >= 400) fails.push(r.status() + " " + r.url());
  });
  await pg.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle0" });
  out[w] = await pg.evaluate(() => {
    const ul = document.querySelector('section[aria-label^="Clientes que"] ul');
    const imgs = [...ul.querySelectorAll("img")];
    const rows = [...new Set(imgs.map((i) => Math.round(i.getBoundingClientRect().top)))];
    return {
      imgCount: imgs.length,
      loaded: imgs.every((i) => i.naturalWidth > 0),
      rows: rows.length,
      firstH: Math.round(imgs[0].getBoundingClientRect().height),
      pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      altMissing: imgs.filter((i) => !i.alt).length,
    };
  });
  out[w].fails = fails;
  if (w === 1440 || w === 375) {
    const el = await pg.$('section[aria-label^="Clientes que"]');
    await el.screenshot({ path: `shots/trustbar-${w}.png` });
  }
  await pg.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
