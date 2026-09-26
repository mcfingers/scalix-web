import fs from "fs";

const files = process.argv.slice(2);
for (const f of files) {
  const s = fs.readFileSync(f, "utf8");
  const urls = [...new Set([...s.matchAll(/https:\/\/videos\.pexels\.com\/[^"'\\ <]+/g)].map((x) => x[0]))];
  console.log(`== ${f}`);
  for (const u of urls) console.log(u);
}
