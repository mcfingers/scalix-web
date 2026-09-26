import fs from "fs";

const f = process.argv[2];
const needle = process.argv[3];
const s = fs.readFileSync(f, "utf8");
let idx = 0;
let n = 0;
while ((idx = s.indexOf(needle, idx)) !== -1 && n < 8) {
  console.log(`--- @${idx}`);
  console.log(s.slice(Math.max(0, idx - 200), idx + 400).replace(/\n/g, " "));
  idx += needle.length;
  n++;
}
