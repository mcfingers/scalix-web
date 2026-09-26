/**
 * `npm run build` — genera el sitio compilado listo para subir a producción.
 *
 *   1. Compila Tailwind → assets/css/styles.css (minificado, como antes)
 *   2. Limpia y crea build/
 *   3. Copia todo lo necesario: HTML, CSS, JS, imágenes, vídeos, favicons, logo
 *   4. Valida que TODAS las referencias locales (src/href/url()) existan en build/
 *
 * Resultado: build/ es autocontenido — se puede subir tal cual a cualquier hosting.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUILD = path.join(ROOT, "build");
const require = createRequire(import.meta.url);

const run = (cmd, args) =>
  new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: ROOT, stdio: "inherit" });
    p.on("error", reject);
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} salió con código ${code}`))));
  });

const t0 = Date.now();

// 1) limpiar build/ ANTES de compilar: así Tailwind nunca escanea una copia obsoleta
fs.rmSync(BUILD, { recursive: true, force: true });

// 2) CSS minificado en la ubicación de siempre (misma semántica que el build previo)
const cliPkgPath = require.resolve("@tailwindcss/cli/package.json");
const cliPkg = JSON.parse(fs.readFileSync(cliPkgPath, "utf8"));
const tailwindBin = path.join(
  path.dirname(cliPkgPath),
  typeof cliPkg.bin === "string" ? cliPkg.bin : cliPkg.bin.tailwindcss
);
await run(process.execPath, [
  tailwindBin,
  "-i", "./src/styles.css",
  "-o", "./assets/css/styles.css",
  "--minify",
]);
console.log("[build] CSS compilado y minificado → assets/css/styles.css");

// 3) carpeta limpia y copia de todo lo necesario
fs.mkdirSync(path.join(BUILD, "assets/css"), { recursive: true });

// 4) copia de todo lo necesario
const FILES = [
  "index.html",
  "assets/css/styles.css",
  "assets/js/main.js",
  "favicon.svg",
  "favicon.ico",
  "favicon-16x16.png",
  "favicon-32x32.png",
  "favicon-48x48.png",
  "apple-touch-icon.png",
  "logo-scalix.png",
];
const DIRS = ["assets/img", "assets/video"];

for (const f of FILES) {
  const src = path.join(ROOT, f);
  if (!fs.existsSync(src)) throw new Error(`falta el archivo de origen: ${f}`);
  fs.mkdirSync(path.dirname(path.join(BUILD, f)), { recursive: true });
  fs.copyFileSync(src, path.join(BUILD, f));
}
for (const d of DIRS) fs.cpSync(path.join(ROOT, d), path.join(BUILD, d), { recursive: true });

// 5) validación — toda referencia local debe existir dentro de build/
const problems = [];
const isExternal = (u) => /^(https?:)?\/\/|^#|^mailto:|^tel:|^data:|^javascript:/i.test(u);
const clean = (u) => u.split("#")[0].split("?")[0];

const html = fs.readFileSync(path.join(BUILD, "index.html"), "utf8");
for (const m of html.matchAll(/(?:src|href|poster|srcset|data-src)="([^"]+)"/g)) {
  const ref = m[1];
  if (isExternal(ref)) continue;
  const target = clean(ref.startsWith("/") ? ref : "/" + ref);
  if (!fs.existsSync(path.join(BUILD, target))) problems.push(`index.html → ${ref}`);
}

const cssPath = path.join(BUILD, "assets/css/styles.css");
for (const m of fs.readFileSync(cssPath, "utf8").matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
  const ref = m[1];
  if (isExternal(ref)) continue;
  if (!fs.existsSync(path.resolve(path.dirname(cssPath), clean(ref)))) problems.push(`styles.css → ${ref}`);
}

const js = fs.readFileSync(path.join(BUILD, "assets/js/main.js"), "utf8");
for (const m of js.matchAll(/['"](assets\/[^'"]+|[\w-]+\.(?:png|svg|ico|mp4|jpg))['"]/g)) {
  const ref = m[1];
  if (isExternal(ref)) continue;
  if (!fs.existsSync(path.join(BUILD, ref))) problems.push(`main.js → ${ref}`);
}

if (problems.length) {
  console.error("[build] REFERENCIAS ROTAS:");
  for (const p of [...new Set(problems)]) console.error(`  ✗ ${p}`);
  process.exit(1);
}

// resumen
let files = 0, bytes = 0;
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else { files++; bytes += fs.statSync(p).size; }
  }
};
walk(BUILD);

console.log(
  `[build] OK → build/  ·  ${files} archivos  ·  ${(bytes / 1024 / 1024).toFixed(2)} MB  ·  ${(
    (Date.now() - t0) / 1000
  ).toFixed(1)}s`
);
console.log("[build] Referencias locales verificadas: HTML ✓  CSS ✓  JS ✓");
