// Clip-based section captures with deterministic page coordinates
import puppeteer from "puppeteer-core";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUT = "C:\\Users\\mcfin\\Documents\\Scalix\\shots";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--hide-scrollbars", "--disable-gpu"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle0", timeout: 60000 });

// Force all reveals visible so captures are deterministic
await page.evaluate(() => {
  document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible"));
  document.documentElement.style.scrollBehavior = "auto";
});
await new Promise((r) => setTimeout(r, 500));

const secs = await page.evaluate(() => {
  const out = {};
  document.querySelectorAll("main > section[id]").forEach((s) => {
    const r = s.getBoundingClientRect();
    out[s.id] = { top: Math.round(r.top + window.scrollY), h: Math.round(r.height) };
  });
  return out;
});

const results = {};
for (const [id, { top, h }] of Object.entries(secs)) {
  const clip = { x: 0, y: top, width: 1440, height: Math.min(h, 1400) };
  await page.screenshot({ path: `${OUT}\\cap-${id}.png`, clip });
  results[id] = clip;
}

// hero + logo health check after full load
const imgs = await page.evaluate(() =>
  [...document.images].map((i) => ({ src: i.getAttribute("src"), w: i.naturalWidth, h: i.naturalHeight }))
);

// mobile hero capture
const mob = await browser.newPage();
await mob.setViewport({ width: 375, height: 812, deviceScaleFactor: 2, isMobile: true });
await mob.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle0" });
await mob.evaluate(() => document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible")));
await new Promise((r) => setTimeout(r, 500));
await mob.screenshot({ path: `${OUT}\\cap-mobile-hero.png` });
const mobTop = await mob.evaluate(() => {
  const s = document.getElementById("contacto").getBoundingClientRect();
  return Math.round(s.top + window.scrollY);
});
await mob.screenshot({ path: `${OUT}\\cap-mobile-contacto.png`, clip: { x: 0, y: mobTop, width: 375, height: 760 } });

console.log(JSON.stringify({ results, imgs }, null, 2));
await browser.close();
