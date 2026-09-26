import puppeteer from "puppeteer-core";

const exe = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await puppeteer.launch({ executablePath: exe, headless: true });
const pg = await browser.newPage();
await pg.setViewport({ width: 1440, height: 900 });
const errors = [];
pg.on("console", (m) => m.type() === "error" && errors.push(m.text()));
pg.on("pageerror", (e) => errors.push(String(e)));
await pg.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle0" });

const sample = () =>
  pg.evaluate(() => {
    const g = (s) => {
      const el = document.querySelector(s);
      if (!el) return null;
      const c = getComputedStyle(el);
      return { a: c.animationName, d: c.animationDelay, o: +(+c.opacity).toFixed(2) };
    };
    return {
      visible: document.querySelector("#contacto .reveal").classList.contains("is-visible"),
      eyebrow: g("#contacto .reveal span.anim-up"),
      h2: g("#contacto h2.anim-up"),
      cards: g("#contacto div.grid.anim-up"),
      bookingRow: g("#contacto div.flex.anim-up"),
      image: g("#contacto .reveal.relative > div:first-child"),
      badge: g("#contacto div.absolute.anim-up"),
      badgeTranslateX: getComputedStyle(document.querySelector("#contacto div.absolute.anim-up")).translate,
    };
  });

const before = await sample();
await pg.evaluate(() => document.querySelector("#contacto").scrollIntoView({ block: "center" }));

const trace = [];
for (let i = 0; i < 14; i++) {
  trace.push(await sample());
  await new Promise((r) => setTimeout(r, 200));
}

// reduced motion: instant
const rm = await browser.newPage();
await rm.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await rm.setViewport({ width: 1440, height: 900 });
await rm.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle0" });
await rm.evaluate(() => document.querySelector("#contacto").scrollIntoView({ block: "center" }));
await new Promise((r) => setTimeout(r, 600));
const rmOps = await rm.evaluate(() =>
  [...document.querySelectorAll("#contacto .anim-up, #contacto .anim-pop")].map((el) => +(+getComputedStyle(el).opacity).toFixed(2))
);

// summary
const revealed = trace.filter((t) => t.visible);
const delays = revealed[0]
  ? {
      eyebrow: revealed[0].eyebrow.d,
      h2: revealed[0].h2.d,
      cards: revealed[0].cards.d,
      bookingRow: revealed[0].bookingRow.d,
      image: revealed[0].image.d,
      badge: revealed[0].badge.d,
    }
  : null;
const anims = revealed[0]
  ? {
      eyebrow: revealed[0].eyebrow.a,
      image: revealed[0].image.a,
      badge: revealed[0].badge.a,
    }
  : null;
const intermediate = trace.some(
  (t) => t.visible && [t.eyebrow, t.image, t.badge].some((x) => x && x.o > 0.05 && x.o < 0.95)
);
const finalOps = trace[trace.length - 1];
const staggerSeen = (() => {
  // eyebrow should reach ~1 before badge does
  const idx = (pred) => trace.findIndex(pred);
  const eyebrowDone = idx((t) => t.visible && t.eyebrow && t.eyebrow.o >= 0.99);
  const badgeDone = idx((t) => t.visible && t.badge && t.badge.o >= 0.99);
  return eyebrowDone !== -1 && badgeDone !== -1 && badgeDone > eyebrowDone;
})();

console.log(
  JSON.stringify(
    {
      before,
      delays,
      anims,
      midTraceSample: trace.slice(1, 5),
      intermediateOpacitySeen: intermediate,
      staggerSeen,
      final: finalOps,
      badgeTranslateXKept: finalOps.badgeTranslateX,
      rmAllVisible: rmOps.every((o) => o === 1),
      errors,
    },
    null,
    1
  )
);
await browser.close();
