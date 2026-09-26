/** Prueba del servidor estático: arranca en 8081, verifica respuestas y termina. */
import { spawn } from "node:child_process";

const PORT = 8081;
const BASE = `http://127.0.0.1:${PORT}`;
const server = spawn(process.execPath, ["scripts/serve.mjs"], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ["ignore", "pipe", "inherit"],
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, extra = "") => results.push({ name, ok, ...(extra ? { extra } : "") });

try {
  // esperar a que escuche
  let up = false;
  for (let i = 0; i < 50 && !up; i++) {
    await wait(100);
    up = await fetch(BASE + "/", { method: "HEAD" }).then(() => true).catch(() => false);
  }
  if (!up) throw new Error("el servidor no arrancó");

  const cases = [
    ["/", "text/html", 200],
    ["/index.html", "text/html", 200],
    ["/assets/css/styles.css", "text/css", 200],
    ["/assets/js/main.js", "text/javascript", 200],
    ["/favicon.svg", "image/svg+xml", 200],
    ["/favicon.ico", "image/x-icon", 200],
    ["/assets/img/hero-equipo.jpg", "image/jpeg", 200],
    ["/logo-scalix.png", "image/png", 200],
    ["/no-existe.png", "", 404],
  ];
  for (const [path, type, status] of cases) {
    const r = await fetch(BASE + path);
    check(`${path} → ${status}`, r.status === status, `got ${r.status}`);
    if (type) check(`${path} content-type`, (r.headers.get("content-type") || "").startsWith(type), r.headers.get("content-type"));
  }

  // HEAD
  const head = await fetch(BASE + "/", { method: "HEAD" });
  check("HEAD /", head.status === 200 && head.headers.get("content-length") > 0);

  // Rangos del vídeo (scrub del hero)
  const mp4 = BASE + "/assets/video/hero-loop-360.mp4";
  const full = await fetch(mp4, { method: "HEAD" });
  const size = Number(full.headers.get("content-length"));
  check("mp4 Accept-Ranges", full.headers.get("accept-ranges") === "bytes");
  const r1 = await fetch(mp4, { headers: { Range: "bytes=0-1023" } });
  check("mp4 range 0-1023 → 206", r1.status === 206, `got ${r1.status}`);
  check("mp4 206 Content-Range", /^bytes 0-1023\/\d+$/.test(r1.headers.get("content-range") || ""), r1.headers.get("content-range"));
  check("mp4 206 long = 1024", Number(r1.headers.get("content-length")) === 1024, r1.headers.get("content-length"));
  const r2 = await fetch(mp4, { headers: { Range: `bytes=${size - 100}-` } });
  check("mp4 suffix range → 206", r2.status === 206, `got ${r2.status}`);
  check("mp4 suffix long = 100", Number(r2.headers.get("content-length")) === 100, r2.headers.get("content-length"));

  // traversal
  const esc = await fetch(BASE + "/..%2f..%2fpackage.json");
  check("path traversal bloqueado", esc.status === 404 || esc.status === 403, `got ${esc.status}`);
} finally {
  server.kill();
}

const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? "ok  " : "FAIL"} ${r.name}${r.extra ? `  [${r.extra}]` : ""}`);
console.log(`\n${results.length - failed.length}/${results.length} correctos`);
process.exit(failed.length ? 1 : 0);
