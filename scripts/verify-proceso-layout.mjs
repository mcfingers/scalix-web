import puppeteer from "puppeteer-core";

const exe = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await puppeteer.launch({ executablePath: exe, headless: true });
const out = {};

for (const w of [375, 768, 1024, 1440]) {
  const pg = await browser.newPage();
  await pg.setViewport({ width: w, height: 900 });
  await pg.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle0" });
  await pg.evaluate(() => document.querySelector("#proceso").scrollIntoView({ block: "center" }));
  await new Promise((r) => setTimeout(r, 700));
  out[w] = await pg.evaluate(() => {
    const root = document.querySelector("[data-process]");
    const tabs = [...root.querySelectorAll('[role="tab"]')];
    const panel = root.querySelector(".process-panel.is-active");
    const r = root.getBoundingClientRect();
    const activePanelVisible = +getComputedStyle(panel).opacity === 1;
    const stacked = tabs[0].getBoundingClientRect().top < panel.getBoundingClientRect().top;
    const sideBySide = tabs[0].getBoundingClientRect().right <= panel.getBoundingClientRect().left;
    return {
      rootWidth: Math.round(r.width),
      layout: sideBySide ? "tabs-left" : stacked ? "stacked" : "overlap",
      activePanelVisible,
      pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      tabRows: [...new Set(tabs.map((t) => Math.round(t.getBoundingClientRect().top)))].length,
    };
  });
  await pg.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
