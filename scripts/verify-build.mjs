/** Prueba la carpeta build/: la sirve en :8083 y la audita en Chrome. */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8083;
const BASE = `http://127.0.0.1:${PORT}`;

const server = spawn(process.execPath, ["scripts/serve.mjs"], {
  cwd: ROOT,
  env: { ...process.env, SITE_ROOT: "build", PORT: String(PORT) },
  stdio: ["ignore", "pipe", "inherit"],
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, extra = "") => results.push({ name, ok, ...(extra ? { extra } : "") });

try {
  let up = false;
  for (let i = 0; i < 50 && !up; i++) {
    await wait(100);
    up = await fetch(BASE + "/", { method: "HEAD" }).then(() => true).catch(() => false);
  }
  if (!up) throw new Error("el servidor de build no arrancó");

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const pg = await browser.newPage();
  await pg.setViewport({ width: 1440, height: 900 });

  const consoleErrors = [];
  const pageErrors = [];
  const badResponses = []; // >= 400
  const failedLocal = [];
  const failedExternal = [];
  pg.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
  pg.on("pageerror", (e) => pageErrors.push(String(e)));
  pg.on("response", (r) => r.status() >= 400 && badResponses.push(`${r.status()} ${r.url()}`));
  pg.on("requestfailed", (r) =>
    (r.url().startsWith(BASE) ? failedLocal : failedExternal).push(`${r.failure()?.errorText} ${r.url()}`)
  );

  await pg.goto(BASE + "/", { waitUntil: "networkidle0", timeout: 45000 });

  // recorre la página con ritmo "humano" para disparar las imágenes con loading="lazy"
  await pg.evaluate(async () => {
    const step = 450;
    for (let y = 0; y <= document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 180));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 2000)); // que terminen de descargarse
    const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
    await Promise.all(
      [...document.images].map((i) =>
        withTimeout(i.complete ? Promise.resolve() : i.decode().catch(() => {}), 2500)
      )
    );
  });
  await wait(1200); // deja que arranque el vídeo y las animaciones

  const audit = await pg.evaluate(async (base) => {
    const imgs = [...document.images];
    const stylesOk = await fetch("assets/css/styles.css").then((r) => r.ok && r.headers.get("content-length") > 10000);
    const icons = {};
    for (const f of ["favicon.svg", "favicon.ico", "favicon-32x32.png", "apple-touch-icon.png", "logo-scalix.png"]) {
      icons[f] = await fetch(f).then((r) => r.status);
    }
    const vid = document.querySelector("video");
    return {
      h1: document.querySelectorAll("h1").length,
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      brokenImgs: imgs.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc || i.src),
      notLoaded: imgs.filter((i) => !i.complete).length, // p.ej. lazy fuera de pantalla: no cuenta como rota
      totalImgs: imgs.length,
      imgsNoAlt: imgs.filter((i) => !i.hasAttribute("alt")).length,
      bodyFont: getComputedStyle(document.body).fontFamily,
      h1Spacing: getComputedStyle(document.querySelector("h1")).letterSpacing,
      cssOk: stylesOk,
      icons,
      video: vid
        ? { readyState: vid.readyState, sources: [...vid.querySelectorAll("source")].map((s) => s.src || s.getAttribute("src")) }
        : null,
      sections: ["inicio", "servicios", "planes", "comparativa", "clientes", "proceso", "faq", "contacto"].filter(
        (id) => document.getElementById(id)
      ).length,
    };
  }, BASE);

  const videoHeads = await Promise.all(
    (audit.video?.sources || []).map(async (s) => {
      const url = s.startsWith("http") ? s : BASE + "/" + s.replace(/^\//, "");
      return fetch(url, { method: "HEAD" }).then((r) => `${r.status} ${s.split("/").pop()}`);
    })
  );

  check("1 h1", audit.h1 === 1, String(audit.h1));
  check("sin overflow horizontal", audit.scrollW === audit.clientW, `${audit.scrollW}/${audit.clientW}`);
  check(
    "sin imágenes rotas",
    audit.brokenImgs.length === 0,
    audit.brokenImgs.join(", ") ||
      (audit.notLoaded ? `${audit.notLoaded} lazy sin disparar` : `las ${audit.totalImgs} descargadas`)
  );
  check("todas las img con alt", audit.imgsNoAlt === 0);
  check("CSS minificado >10KB y sirve 200", audit.cssOk);
  check("tipografía DM Sans aplicada", /DM Sans/.test(audit.bodyFont), audit.bodyFont);
  check("h1 letter-spacing -2px", audit.h1Spacing === "-2px", audit.h1Spacing);
  check("8 secciones presentes", audit.sections === 8, String(audit.sections));
  check("favicons+logo → 200", Object.values(audit.icons).every((s) => s === 200), JSON.stringify(audit.icons));
  check("vídeo: 2 sources", audit.video?.sources.length === 2, JSON.stringify(audit.video?.sources));
  check("vídeo con metadatos", (audit.video?.readyState ?? 0) >= 1, String(audit.video?.readyState));
  check("sources del vídeo → 200", videoHeads.length === 2 && videoHeads.every((h) => h.startsWith("200")), videoHeads.join(" | "));
  check("0 errores de consola", consoleErrors.length === 0, consoleErrors.join(" | "));
  check("0 errores JS", pageErrors.length === 0, pageErrors.join(" | "));
  check("0 respuestas >=400", badResponses.length === 0, badResponses.join(" | "));
  check("0 peticiones locales fallidas", failedLocal.length === 0, failedLocal.join(" | "));
  check(
    "externas (fuentes Google) — solo informativo",
    true,
    failedExternal.length ? failedExternal.join(" | ") : "cargaron bien"
  );

  await browser.close();
} finally {
  server.kill();
}

const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? "ok  " : "FAIL"} ${r.name}${r.extra ? `  [${r.extra}]` : ""}`);
console.log(`\n${results.length - failed.length}/${results.length} correctos`);
process.exit(failed.length ? 1 : 0);
