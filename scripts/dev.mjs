/**
 * Entorno de desarrollo en un solo comando:
 *   npm run dev   → servidor local (:8080) + Tailwind en modo watch
 *
 * (Sustituye a tener que lanzar `python -m http.server` y el watch por separado)
 */
import { spawn } from "node:child_process";
import { start } from "./serve.mjs";

const server = start();

const css = spawn("npm run dev:css", { shell: true, stdio: "inherit" });

css.on("exit", (code) => {
  if (code !== 0 && code !== null) {
    console.error(`[dev] El watch de Tailwind terminó con código ${code}. El servidor sigue activo.`);
  }
});

const shutdown = () => {
  if (!css.killed) css.kill();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 300).unref();
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
