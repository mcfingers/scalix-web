/** Auditoría móvil (375px): barras fixed, viewport-expansion, swipe de la tabla y triggers reales.
 *  BASE por defecto → servidor dev; con BASE=http://127.0.0.1:8083/ audita la carpeta build/. */
import puppeteer from "puppeteer-core";

const exe = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.BASE || "http://127.0.0.1:8080/";
const browser = await puppeteer.launch({ executablePath: exe, headless: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0;
let fail = 0;
const check = (ok, label, extra = "") => {
  if (ok) pass++;
  else fail++;
  console.log(`  ${ok ? "PASS" : "FAIL"} · ${label}${extra ? " · " + extra : ""}`);
};

const newMobile = async () => {
  const pg = await browser.newPage();
  await pg.setViewport({ width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await pg.goto(BASE, { waitUntil: "networkidle0" });
  return pg;
};

const bars = (pg) =>
  pg.evaluate(() => {
    const header = document.querySelector("#header");
    const nav = document.querySelector("#header nav");
    const bar = document.querySelector("body > div.fixed.bottom-0");
    const r = (el) => {
      const b = el.getBoundingClientRect();
      return { l: Math.round(b.left), w: Math.round(b.width) };
    };
    return { iw: innerWidth, vv: Math.round(visualViewport.width), header: r(header), nav: r(nav), bar: r(bar) };
  });

console.log("=== 1) salto a cada sección (móvil 375) ===");
for (const id of ["servicios", "planes", "comparativa", "clientes", "proceso", "faq", "contacto"]) {
  const pg = await newMobile();
  await pg.evaluate((id) => scrollTo(0, document.getElementById(id).offsetTop), id);
  await sleep(650);
  const s = await bars(pg);
  const ok = s.iw === 375 && s.header.w === 375 && s.bar.w === 375 && s.nav.w < 344;
  check(ok, `jump → #${id}`, `iw=${s.iw} header=${s.header.w} nav=${s.nav.w} bar=${s.bar.w}`);
  await pg.close();
}

console.log("\n=== 2) la tabla sigue deslizándose (swipe horizontal) ===");
{
  const pg = await newMobile();
  await pg.evaluate(() => scrollTo(0, document.getElementById("comparativa").offsetTop));
  await sleep(650);
  const swipe = await pg.evaluate(() => {
    const s = document.querySelector("#comparativa .overflow-x-auto");
    const before = { sw: s.scrollWidth, cw: s.clientWidth, sl: s.scrollLeft };
    s.scrollLeft = 200;
    const after = s.scrollLeft;
    s.scrollLeft = 0;
    return { ...before, moved: after };
  });
  check(swipe.sw > swipe.cw + 100, "contenedor con overflow (swipeable)", `sw=${swipe.sw} cw=${swipe.cw}`);
  check(swipe.moved >= 199, "scrollLeft responde (swipe funciona)", `scrollLeft=${swipe.moved}`);
  const s = await bars(pg);
  check(s.iw === 375 && s.header.w === 375, "barras intactas tras interacción", `iw=${s.iw}`);
  await pg.screenshot({ path: "shots/mobile-comparativa-fix.png" });
  await pg.close();
}

console.log("\n=== 3) trigger real: menú móvil → clic en enlace #comparativa ===");
{
  const pg = await newMobile();
  await pg.click("#menu-btn");
  await sleep(300);
  await pg.click('#mobile-menu a[href="#comparativa"]');
  await sleep(900);
  const s = await bars(pg);
  const y = await pg.evaluate(() => Math.round(scrollY));
  check(s.iw === 375 && s.header.w === 375 && s.bar.w === 375, "clic enlace del menú → sin expansión", `iw=${s.iw} header=${s.header.w} bar=${s.bar.w} scrollY=${y}`);
  await pg.close();
}

console.log("\n=== 4) trigger real: clic Agendar llamada (barra inferior) → #contacto ===");
{
  const pg = await newMobile();
  await pg.evaluate(() => scrollTo(0, 1500));
  await sleep(300);
  await pg.click("body > div.fixed.bottom-0 a[href='#contacto']");
  await sleep(900);
  const s = await bars(pg);
  check(s.iw === 375 && s.bar.w === 375, "clic barra inferior → #contacto sin expansión", `iw=${s.iw} bar=${s.bar.w}`);
  await pg.close();
}

console.log("\n=== 5) escritorio 1440 no afectado ===");
{
  const pg = await browser.newPage();
  await pg.setViewport({ width: 1440, height: 900 });
  await pg.goto(BASE, { waitUntil: "networkidle0" });
  await pg.evaluate(() => scrollTo(0, document.getElementById("comparativa").offsetTop));
  await sleep(650);
  const s = await bars(pg);
  const swipe = await pg.evaluate(() => {
    const el = document.querySelector("#comparativa .overflow-x-auto");
    return { sw: el.scrollWidth, cw: el.clientWidth };
  });
  check(s.iw === 1440 && s.header.w === 1440, "escritorio: barras a 1440", `iw=${s.iw}`);
  await pg.close();
}

console.log(`\n${pass} pass / ${fail} fail`);
await browser.close();
process.exit(fail ? 1 : 0);
