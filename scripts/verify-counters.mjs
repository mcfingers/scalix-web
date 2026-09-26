import puppeteer from "puppeteer-core";

const exe = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await puppeteer.launch({ executablePath: exe, headless: true });

const getValues = (pg) =>
  pg.$$eval("#clientes [data-count-to]", (els) => els.map((e) => e.textContent));

const pg = await browser.newPage();
await pg.setViewport({ width: 1440, height: 900 });
const errors = [];
pg.on("console", (m) => m.type() === "error" && errors.push(m.text()));
pg.on("pageerror", (e) => errors.push(String(e)));
await pg.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle0" });

const before = await getValues(pg);
const fontVariant = await pg.$eval(
  "#clientes [data-count-to]",
  (el) => getComputedStyle(el).fontVariantNumeric
);

await pg.evaluate(() => document.querySelector("#clientes .grid").scrollIntoView({ block: "center" }));
await new Promise((r) => setTimeout(r, 950));
const mid = await getValues(pg);
await new Promise((r) => setTimeout(r, 2000));
const after = await getValues(pg);

// reduced motion: values must never change from the static HTML
const rm = await browser.newPage();
await rm.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await rm.setViewport({ width: 1440, height: 900 });
await rm.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle0" });
const rmBefore = await getValues(rm);
await rm.evaluate(() => document.querySelector("#clientes .grid").scrollIntoView({ block: "center" }));
await new Promise((r) => setTimeout(r, 600));
const rmAfter = await getValues(rm);

console.log(JSON.stringify({ before, mid, after, fontVariant, rmBefore, rmAfter, errors }, null, 1));
await browser.close();
