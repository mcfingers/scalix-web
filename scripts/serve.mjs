/**
 * Servidor estático local (sin dependencias) — sustituye a `python -m http.server`.
 *
 *   node scripts/serve.mjs        → http://127.0.0.1:8080/
 *   PORT=8081 node scripts/serve.mjs
 *
 * Soporta HEAD, rangos (206) para poder hacer scrub del vídeo del hero,
 * MIME correcto (svg, mp4, ico…) y `Cache-Control: no-cache` para desarrollo.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = process.env.SITE_ROOT
  ? path.resolve(process.env.SITE_ROOT) // p.ej. SITE_ROOT=build para servir la carpeta compilada
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOST = "127.0.0.1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
  ".map": "application/json; charset=utf-8",
};

export function start(port = Number(process.env.PORT || 8080), host = HOST) {
  const server = http.createServer((req, res) => {
    const log = (status) => console.log(`[serve] ${req.method} ${req.url} → ${status}`);

    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" });
      log(405);
      return res.end("405 Method Not Allowed");
    }

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, `http://${host}`).pathname);
    } catch {
      res.writeHead(400);
      log(400);
      return res.end("400 Bad Request");
    }

    let file = path.normalize(path.join(ROOT, pathname));
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
      res.writeHead(403);
      log(403);
      return res.end("403 Forbidden");
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");

    const stat = fs.statSync(file, { throwIfNoEntry: false });
    if (!stat || !stat.isFile()) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      log(404);
      return res.end(`<!doctype html><meta charset="utf-8"><title>404</title><h1>404 — ${pathname} no existe`);
    }

    const type = MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
    const base = {
      "Content-Type": type,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-cache",
    };

    // Rangos (necesario para buscar dentro del vídeo del hero)
    const range = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (range && (range[1] !== "" || range[2] !== "")) {
      const size = stat.size;
      let start = range[1] === "" ? Math.max(0, size - Number(range[2])) : Number(range[1]);
      let end = range[2] === "" || range[1] === "" ? size - 1 : Math.min(Number(range[2]), size - 1);
      if (start > end || start >= size) {
        res.writeHead(416, { "Content-Range": `bytes */${size}` });
        log(416);
        return res.end();
      }
      res.writeHead(206, {
        ...base,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": end - start + 1,
      });
      log(206);
      if (req.method === "HEAD") return res.end();
      return fs.createReadStream(file, { start, end }).pipe(res);
    }

    res.writeHead(200, { ...base, "Content-Length": stat.size });
    log(200);
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file).pipe(res);
  });

  server.listen(port, host, () => {
    console.log(`[serve] Escuchando en http://${host}:${port}/  (raíz: ${ROOT})`);
  });
  return server;
}

// Arranque directo (`node scripts/serve.mjs`); no al importarlo desde dev.mjs
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  start();
}
