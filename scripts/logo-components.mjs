import puppeteer from "puppeteer-core";

const exe = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await puppeteer.launch({ executablePath: exe, headless: true });
const pg = await browser.newPage();
await pg.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });

const res = await pg.evaluate(async () => {
  const img = new Image();
  img.src = "logo-scalix.png";
  await img.decode();
  const W = img.naturalWidth,
    H = img.naturalHeight;
  const c = new OffscreenCanvas(W, H);
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, W, H);

  // connected components on alpha, 8-connected (iterative flood fill)
  const mask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) mask[i] = data[i * 4 + 3] > 100 ? 1 : 0;
  const label = new Int32Array(W * H).fill(-1);
  const comps = [];
  const stack = [];
  for (let p = 0; p < W * H; p++) {
    if (!mask[p] || label[p] !== -1) continue;
    const id = comps.length;
    const comp = { id, area: 0, x0: W, y0: H, x1: 0, y1: 0 };
    stack.push(p);
    label[p] = id;
    while (stack.length) {
      const q = stack.pop();
      const x = q % W,
        y = (q / W) | 0;
      comp.area++;
      if (x < comp.x0) comp.x0 = x;
      if (x > comp.x1) comp.x1 = x;
      if (y < comp.y0) comp.y0 = y;
      if (y > comp.y1) comp.y1 = y;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx,
            ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const n = ny * W + nx;
          if (mask[n] && label[n] === -1) {
            label[n] = id;
            stack.push(n);
          }
        }
    }
    comp.w = comp.x1 - comp.x0 + 1;
    comp.h = comp.y1 - comp.y0 + 1;
    comp.fill = +(comp.area / (comp.w * comp.h)).toFixed(2);
    comps.push(comp);
  }

  // ASCII art per component (36 cols), normalised to its own bbox
  const arts = comps.map((comp) => {
    const cols = 44;
    const sx = comp.w / cols;
    const rows = Math.max(1, Math.round(comp.h / sx / 2));
    let art = "";
    for (let r = 0; r < rows; r++) {
      for (let q = 0; q < cols; q++) {
        let hit = 0,
          n = 0;
        const x0 = Math.floor(comp.x0 + q * sx),
          x1 = Math.floor(comp.x0 + (q + 1) * sx);
        const y0 = Math.floor(comp.y0 + (r * comp.h) / rows),
          y1 = Math.floor(comp.y0 + ((r + 1) * comp.h) / rows);
        for (let y = y0; y < y1; y++)
          for (let x = x0; x < x1; x++) {
            if (mask[y * W + x]) hit++;
            n++;
          }
        art += n && hit / n > 0.4 ? "#" : ".";
      }
      art += "\n";
    }
    return art;
  });

  return {
    W,
    H,
    count: comps.length,
    comps: comps.map(({ id, x0, y0, w, h, area, fill }) => ({ id, x0, y0, w, h, area, fill })),
    arts,
  };
});

console.log(`image ${res.W}x${res.H}, components: ${res.count}`);
for (const c of res.comps) console.log(JSON.stringify(c));
res.arts.forEach((a, i) => {
  console.log(`\n=== component ${i} (bbox ${res.comps[i].x0},${res.comps[i].y0} ${res.comps[i].w}x${res.comps[i].h})`);
  console.log(a);
});
await browser.close();
