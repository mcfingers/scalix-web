// Scalix — visual + layout verification via CDP
import puppeteer from "puppeteer-core";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = "http://127.0.0.1:8080/";
const OUT = "C:\\Users\\mcfin\\Documents\\Scalix\\shots";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--hide-scrollbars", "--disable-gpu"],
});

const errors = [];
const failed = [];

const page = await browser.newPage();
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));
page.on("requestfailed", (r) => failed.push(r.url() + " :: " + r.failure()?.errorText));
page.on("response", (r) => { if (r.status() >= 400) failed.push(r.url() + " :: HTTP " + r.status()); });

await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.goto(BASE, { waitUntil: "networkidle0", timeout: 60000 });
await new Promise((r) => setTimeout(r, 800));

const layout = await page.evaluate(() => {
  const doc = document.documentElement;
  const sections = [...document.querySelectorAll("main > section, header, footer")].map((s) => {
    const r = s.getBoundingClientRect();
    return { id: s.id || s.tagName.toLowerCase(), top: Math.round(r.top + scrollY), h: Math.round(r.height) };
  });
  return {
    scrollW: doc.scrollWidth,
    clientW: doc.clientWidth,
    pageH: doc.scrollHeight,
    h1: document.querySelectorAll("h1").length,
    imgsNoAlt: [...document.images].filter((i) => !i.hasAttribute("alt")).length,
    imgsBroken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute("src")),
    sections,
  };
});

await page.screenshot({ path: `${OUT}\\puppeteer-full.png`, fullPage: true });

// Section shots (scroll instantly so IO reveals fire)
const ids = ["servicios", "planes", "comparativa", "clientes", "proceso", "faq", "contacto"];
for (const id of ids) {
  await page.evaluate((sel) => {
    document.documentElement.style.scrollBehavior = "auto";
    document.getElementById(sel).scrollIntoView({ block: "start" });
  }, id);
  await new Promise((r) => setTimeout(r, 900));
  await page.screenshot({ path: `${OUT}\\p-${id}.png` });
}

// Accordion interaction test
await page.evaluate(() => document.getElementById("faq").scrollIntoView());
await new Promise((r) => setTimeout(r, 500));
const faqState = await page.evaluate(() => {
  const btn = document.querySelectorAll(".faq-trigger")[1];
  btn.click();
  const panel = document.getElementById(btn.getAttribute("aria-controls"));
  return {
    expanded: btn.getAttribute("aria-expanded"),
    rows: getComputedStyle(panel).gridTemplateRows,
    firstOpen: document.querySelectorAll(".faq-trigger")[0].getAttribute("aria-expanded"),
  };
});

// Mobile
const mob = await browser.newPage();
mob.on("pageerror", (e) => errors.push("mobile: " + String(e)));
await mob.setViewport({ width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await mob.goto(BASE, { waitUntil: "networkidle0", timeout: 60000 });
await new Promise((r) => setTimeout(r, 800));
const mobLayout = await mob.evaluate(() => ({
  scrollW: document.documentElement.scrollWidth,
  clientW: document.documentElement.clientWidth,
}));
await mob.screenshot({ path: `${OUT}\\p-mobile-full.png`, fullPage: true });

// Mobile menu test
const menuTest = await mob.evaluate(() => {
  const btn = document.getElementById("menu-btn");
  btn.click();
  const open = !document.getElementById("mobile-menu").classList.contains("hidden");
  const expanded = btn.getAttribute("aria-expanded");
  document.querySelector("#mobile-menu a").click();
  const closedAfterNav = document.getElementById("mobile-menu").classList.contains("hidden");
  return { open, expanded, closedAfterNav };
});

console.log(JSON.stringify({ layout, mobLayout, faqState, menuTest, errors, failed }, null, 2));
await browser.close();
