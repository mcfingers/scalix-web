import puppeteer from "puppeteer-core";

const exe = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await puppeteer.launch({ executablePath: exe, headless: true });
const pg = await browser.newPage();
await pg.setViewport({ width: 1440, height: 900 });
const logs = [];
pg.on("console", (m) => logs.push(m.type() + ": " + m.text()));
pg.on("pageerror", (e) => logs.push("pageerror: " + e));
const responses = [];
pg.on("response", (r) => {
  if (r.url().includes("main.js")) responses.push(r.status() + " " + r.url() + " cache=" + r.headers()["x-cache"]);
});
await pg.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle0" });

const state = await pg.evaluate(() => ({
  count: document.querySelectorAll("[data-count-to]").length,
  scriptHasCounter: [...document.scripts].some((s) => s.src.includes("main.js")),
  reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  hasIO: "IntersectionObserver" in window,
  jsSnippet: null,
}));

// fetch main.js as the browser sees it
const jsText = await pg.evaluate(async () => (await fetch("assets/js/main.js")).text());
state.jsHasCounterCode = jsText.includes("data-count-to");

// force-run one counter manually to check formatting/RAF works
const manual = await pg.evaluate(
  () =>
    new Promise((res) => {
      const el = document.querySelector("[data-count-to]");
      const samples = [];
      const target = parseFloat(el.dataset.countTo);
      const start = performance.now();
      const tick = (now) => {
        const p = Math.min((now - start) / 400, 1);
        samples.push(el.textContent);
        if (p < 1) requestAnimationFrame(tick);
        else res(samples.slice(0, 3));
      };
      // mimic runCounter
      const run = () => {
        const t0 = performance.now();
        const tick2 = (n) => {
          const p = Math.min((n - t0) / 400, 1);
          el.textContent = "+" + Math.round(target * (1 - Math.pow(1 - p, 3)));
          samples.push(el.textContent);
          if (p < 1) requestAnimationFrame(tick2);
          else res(samples);
        };
        requestAnimationFrame(tick2);
      };
      run();
    })
);

// now scroll and sample
await pg.evaluate(() => document.querySelector("#clientes .grid").scrollIntoView({ block: "center" }));
const samples = [];
for (let i = 0; i < 8; i++) {
  await new Promise((r) => setTimeout(r, 100));
  samples.push(await pg.$$eval("#clientes [data-count-to]", (els) => els.map((e) => e.textContent).join("|")));
}

console.log(JSON.stringify({ state, responses, manual, samples, logs }, null, 1));
await browser.close();
