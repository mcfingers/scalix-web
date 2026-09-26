import puppeteer from "puppeteer-core";

const exe = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await puppeteer.launch({ executablePath: exe, headless: true });
const pg = await browser.newPage();
await pg.setViewport({ width: 1440, height: 900 });
const errors = [];
pg.on("console", (m) => m.type() === "error" && errors.push(m.text()));
pg.on("pageerror", (e) => errors.push(String(e)));
await pg.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle0" });
await pg.evaluate(() => document.querySelector("#proceso").scrollIntoView({ block: "center" }));
await new Promise((r) => setTimeout(r, 900));

const structure = await pg.evaluate(() => {
  const root = document.querySelector("[data-process]");
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const panels = [...root.querySelectorAll(".process-panel")];
  const selected = tabs.filter((t) => t.getAttribute("aria-selected") === "true");
  return {
    tabs: tabs.length,
    panels: panels.length,
    roles: tabs.every((t) => t.getAttribute("aria-controls")) && panels.every((p) => p.getAttribute("role") === "tabpanel"),
    oneSelected: selected.length === 1,
    selectedIsFocusable: selected[0]?.tabIndex === 0,
    othersUnfocusable: tabs.filter((t) => t.getAttribute("aria-selected") !== "true").every((t) => t.tabIndex === -1),
    activePanelMatches: panels.findIndex((p) => p.classList.contains("is-active")) === tabs.findIndex((t) => t.getAttribute("aria-selected") === "true"),
    tabsOnLeft: tabs[0].getBoundingClientRect().right < panels[0].getBoundingClientRect().left,
    progressBar: (() => {
      const bar = selected[0].querySelector(".tab-progress");
      const c = getComputedStyle(bar);
      return { name: c.animationName, duration: c.animationDuration, playState: c.playState };
    })(),
  };
});

// --- auto-advance ---
const getActive = () => pg.evaluate(() => [...document.querySelectorAll('[data-process] [role="tab"]')].findIndex((t) => t.getAttribute("aria-selected") === "true"));
const trace = [];
for (let i = 0; i < 14; i++) {
  trace.push(await getActive());
  await new Promise((r) => setTimeout(r, 500));
}

// --- smooth transition: sample outgoing panel opacity right after switching ---
await pg.hover("#proc-tab-1");
await new Promise((r) => setTimeout(r, 600));
const fadeSamples = [];
await pg.hover("#proc-tab-3");
for (let i = 0; i < 6; i++) {
  fadeSamples.push(
    await pg.evaluate(() => {
      const out = document.querySelectorAll(".process-panel")[0];
      const inn = document.querySelectorAll(".process-panel")[2];
      return [
        +(+getComputedStyle(out).opacity).toFixed(2),
        +(+getComputedStyle(inn).opacity).toFixed(2),
      ];
    })
  );
  await new Promise((r) => setTimeout(r, 90));
}

// --- hover pauses the cycle ---
await pg.hover("#proc-tab-3");
await new Promise((r) => setTimeout(r, 400));
const pausedState = await pg.evaluate(() => {
  const root = document.querySelector("[data-process]");
  const bar = document.querySelector('#proc-tab-3 .tab-progress');
  return {
    isPausedClass: root.classList.contains("is-paused"),
    playState: getComputedStyle(bar).animationPlayState,
    active: [...root.querySelectorAll('[role="tab"]')].findIndex((t) => t.getAttribute("aria-selected") === "true"),
  };
});
await new Promise((r) => setTimeout(r, 5500));
const stillActiveAfterHover = await getActive();

// --- leave resumes ---
await pg.mouse.move(5, 5);
await new Promise((r) => setTimeout(r, 500));
const resumedState = await pg.evaluate(() => ({
  isPausedClass: document.querySelector("[data-process]").classList.contains("is-paused"),
  playState: getComputedStyle(document.querySelector('#proc-tab-3 .tab-progress')).animationPlayState,
}));
await new Promise((r) => setTimeout(r, 5600));
const advancedAfterResume = await getActive();

// --- reduced motion: no auto rotation ---
const rm = await browser.newPage();
await rm.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await rm.setViewport({ width: 1440, height: 900 });
await rm.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle0" });
await rm.evaluate(() => document.querySelector("#proceso").scrollIntoView({ block: "center" }));
await new Promise((r) => setTimeout(r, 6500));
const rmActive = await rm.evaluate(() => [...document.querySelectorAll('[data-process] [role="tab"]')].findIndex((t) => t.getAttribute("aria-selected") === "true"));

console.log(
  JSON.stringify(
    {
      structure,
      autoTrace: trace,
      uniqueInTrace: [...new Set(trace)],
      fadeSamples,
      pausedState,
      stillActiveAfterHover,
      resumedState,
      advancedAfterResume,
      rmActiveAfter6_5s: rmActive,
      errors,
    },
    null,
    1
  )
);
await browser.close();
