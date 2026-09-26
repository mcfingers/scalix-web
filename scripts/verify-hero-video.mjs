import puppeteer from "puppeteer-core";
import fs from "fs";

const exe = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await puppeteer.launch({ executablePath: exe, headless: true });
const out = {};

/* ---------- 1. Playback + styling @1440 ---------- */
const pg = await browser.newPage();
await pg.setViewport({ width: 1440, height: 900 });
const errors = [];
const failed = [];
const remote = [];
pg.on("console", (m) => m.type() === "error" && errors.push(m.text()));
pg.on("pageerror", (e) => errors.push(String(e)));
pg.on("requestfailed", (r) => failed.push(r.url()));
pg.on("response", (r) => {
  const u = r.url();
  if (!u.startsWith("http://127.0.0.1:8080") && !u.startsWith("data:")) remote.push(u);
});
await pg.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle0" });

const state = async () =>
  pg.evaluate(() => {
    const v = document.getElementById("hero-video");
    const c = getComputedStyle(v);
    return {
      readyState: v.readyState,
      paused: v.paused,
      currentTime: +v.currentTime.toFixed(2),
      loop: v.loop,
      muted: v.muted,
      playsInline: v.playsInline,
      src: v.currentSrc.split("/").pop(),
      videoWidth: v.videoWidth,
      blend: c.mixBlendMode,
      animation: c.animationName,
      opacity: +(+c.opacity).toFixed(2),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });

const s1 = await state();
await new Promise((r) => setTimeout(r, 900));
const s2 = await state();
out.playback = {
  ...s2,
  timeAdvances: s2.currentTime > s1.currentTime,
  playedMs: Math.round((s2.currentTime - s1.currentTime) * 1000),
};

/* ---------- 2. Pixel audit: contrast behind hero copy ---------- */
// hide copy to measure pure background where the text sits
const rects = await pg.evaluate(() => {
  const h1 = document.querySelector("#inicio h1");
  const p = document.querySelector("#inicio p");
  h1.style.visibility = "hidden";
  p.style.visibility = "hidden";
  const f = (el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
  };
  return { h1: f(h1), p: f(p) };
});
// let the video land on a different frame than the base shot
await new Promise((r) => setTimeout(r, 400));
await pg.screenshot({ path: "shots/hero-bare-1440.png", clip: rects.h1 });
await pg.screenshot({ path: "shots/hero-bare-p-1440.png", clip: rects.p });
await pg.evaluate(() => {
  document.querySelector("#inicio h1").style.visibility = "";
  document.querySelector("#inicio p").style.visibility = "";
});
await new Promise((r) => setTimeout(r, 500));
await pg.screenshot({ path: "shots/hero-video-1440.png", clip: { x: 0, y: 0, width: 1440, height: 900 } });
await new Promise((r) => setTimeout(r, 900));
await pg.screenshot({ path: "shots/hero-video-1440b.png", clip: { x: 0, y: 0, width: 1440, height: 900 } });

out.pixels = await pg.evaluate(async () => {
  const load = async (file) => {
    const res = await fetch("shots/" + file + "?t=" + Date.now());
    const bmp = await createImageBitmap(await res.blob());
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = c.getContext("2d");
    ctx.drawImage(bmp, 0, 0);
    return { w: bmp.width, h: bmp.height, d: ctx.getImageData(0, 0, bmp.width, bmp.height).data };
  };
  const lum = (r, g, b) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const stats = async (file) => {
    const { d, w, h } = await load(file);
    const lums = [];
    for (let i = 0; i < d.length; i += 4) lums.push(lum(d[i], d[i + 1], d[i + 2]));
    lums.sort((a, b) => a - b);
    const p95 = lums[Math.floor(0.95 * lums.length)];
    const p50 = lums[Math.floor(0.5 * lums.length)];
    return {
      medianL: +p50.toFixed(3),
      p95L: +p95.toFixed(3),
      maxL: +lums[lums.length - 1].toFixed(3),
      contrastWhite: +(1.05 / (p95 + 0.05)).toFixed(2),
    };
  };
  const a = await stats("hero-bare-1440.png");
  const b = await stats("hero-bare-p-1440.png");

  // texture visibility: luminance std-dev in the right half (least scrimmed area)
  const full = await load("hero-video-1440.png");
  const mean = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const right = [];
  for (let y = 0; y < full.h; y += 3)
    for (let x = Math.floor(full.w * 0.6); x < full.w; x += 3) {
      const i = (y * full.w + x) * 4;
      right.push(lum(full.d[i], full.d[i + 1], full.d[i + 2]));
    }
  const m = mean(right);
  const sd = Math.sqrt(mean(right.map((v) => (v - m) ** 2)));

  // motion: two shots 900ms apart should differ where the video shows
  const full2 = await load("hero-video-1440b.png");
  let diff = 0,
    n = 0;
  for (let i = 0; i < full.d.length; i += 40) {
    diff += Math.abs(full.d[i] - full2.d[i]);
    n++;
  }

  return {
    h1Region: a,
    pRegion: b,
    rightHalfMeanL: +m.toFixed(3),
    rightHalfSd: +sd.toFixed(4),
    frameDiff: +(diff / n).toFixed(2),
  };
});

/* ---------- 3. Small viewport: 360p source + no overflow ---------- */
const sm = await browser.newPage();
await sm.setViewport({ width: 375, height: 760 });
await sm.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 600));
out.mobile = await sm.evaluate(() => {
  const v = document.getElementById("hero-video");
  return {
    src: v.currentSrc.split("/").pop(),
    videoWidth: v.videoWidth,
    paused: v.paused,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
});

/* ---------- 4. Reduced motion: paused, fully visible ---------- */
const rm = await browser.newPage();
await rm.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await rm.setViewport({ width: 1440, height: 900 });
await rm.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 500));
out.reducedMotion = await rm.evaluate(() => {
  const v = document.getElementById("hero-video");
  const c = getComputedStyle(v);
  return { paused: v.paused, opacity: +(+c.opacity).toFixed(2), animationDuration: c.animationDuration };
});

out.errors = errors;
out.failedRequests = failed;
out.remoteRequests = remote;

console.log(JSON.stringify(out, null, 1));
await browser.close();
