// One-off: extract logo SVGs from logoipsum.com's Nuxt payload (saved HTML dump)
import fs from "node:fs";

const dump = "C:/Users/mcfin/.local/share/opencode/tool-output/tool_0da3d1c5a001KPBibFsYWs6Pz9";
const html = fs.readFileSync(dump, "utf8");
const m = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
if (!m) {
  console.log("no payload found");
  process.exit(1);
}
const data = JSON.parse(m[1]);
const svgs = data.filter((v) => typeof v === "string" && v.trim().startsWith("<svg"));
console.log("svg strings:", svgs.length);
svgs.forEach((s, i) => {
  const vb = (s.match(/viewBox="([^"]+)"/) || [])[1];
  const w = (s.match(/width="([^"]+)"/) || [])[1];
  const h = (s.match(/height="([^"]+)"/) || [])[1];
  const fills = [...new Set([...s.matchAll(/fill="(#[0-9a-fA-F]+)"/g)].map((x) => x[1]))];
  console.log(i, "vb=" + vb, "w=" + w, "h=" + h, "bytes=" + s.length, "fills=" + fills.join(","));
});

// Save the 6 chosen light (full wordmark) logos to assets/img/logos/
const outDir = "assets/img/logos";
fs.mkdirSync(outDir, { recursive: true });
const chosen = [2, 4, 6, 12, 22, 26]; // light variants of wide wordmark logos
chosen.forEach((i, n) => {
  const svg = svgs[i].replace(/ id="logo"/g, "");
  fs.writeFileSync(`${outDir}/cliente-${n + 1}.svg`, svg, "utf8");
  console.log("wrote", `${outDir}/cliente-${n + 1}.svg`, svg.length, "bytes");
});
