/** ¿Se cargan las 6 imágenes lazy con scroll normal? (diagnóstico rápido) */
import puppeteer from "puppeteer-core";

const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});
const pg = await browser.newPage();
await pg.setViewport({ width: 1440, height: 900 });
await pg.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle0" });

// scroll "humano": pasos pequeños con pausa
await pg.evaluate(async () => {
  const step = 450;
  for (let y = 0; y <= document.body.scrollHeight; y += step) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 180));
  }
  await new Promise((r) => setTimeout(r, 2500));
});

const out = await pg.evaluate(() =>
  [...document.images].map((i) => ({
    src: (i.currentSrc || i.src).split("/").pop(),
    complete: i.complete,
    nw: i.naturalWidth,
    lazy: i.getAttribute("loading"),
    rect: (({ top, height }) => ({ top: Math.round(top), height: Math.round(height) }))(i.getBoundingClientRect()),
    visible: getComputedStyle(i).display !== "none",
  }))
);
const pending = out.filter((i) => !i.complete);
console.log(`total: ${out.length} · pendientes: ${pending.length}`);
for (const p of pending) console.log(JSON.stringify(p));
if (!pending.length) console.log("→ todas cargadas con scroll normal ✓");
await browser.close();
