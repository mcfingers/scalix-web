import puppeteer from "puppeteer-core";

const exe = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await puppeteer.launch({ executablePath: exe, headless: true });
const out = {};

for (const w of [375, 1440]) {
  const pg = await browser.newPage();
  await pg.setViewport({ width: w, height: 900 });
  const errors = [];
  const failed = [];
  pg.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  pg.on("pageerror", (e) => errors.push(String(e)));
  pg.on("response", (r) => r.status() >= 400 && failed.push(r.status() + " " + r.url()));
  await pg.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle0" });

  out[w] = await pg.evaluate(() => {
    const links = [...document.querySelectorAll("a[href]")];
    const wa = links.filter((a) => a.href.startsWith("https://wa.me/"));
    const tel = links.filter((a) => a.href.startsWith("tel:"));
    const booking = document.querySelector('#contacto a[href*="calendar.google.com"]');
    const bookingStyle = booking ? getComputedStyle(booking) : null;

    // sprite instances render?
    const uses = [...document.querySelectorAll("svg use")];
    const useRendered = uses.map((u) => {
      const svg = u.closest("svg");
      const r = svg.getBoundingClientRect();
      return { id: u.getAttribute("href"), w: Math.round(r.width), h: Math.round(r.height) };
    });

    const jsonld = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent);

    return {
      waLinks: wa.length,
      waHrefs: [...new Set(wa.map((a) => a.getAttribute("href")))],
      waBad: wa.filter((a) => !/^https:\/\/wa\.me\/3464\d{7}$/.test(a.getAttribute("href"))).map((a) => a.getAttribute("href")),
      telLinks: tel.length,
      booking: booking
        ? {
            href: booking.getAttribute("href"),
            target: booking.target,
            rel: booking.rel,
            visible: booking.getBoundingClientRect().height > 0,
            bg: bookingStyle.backgroundColor,
            color: bookingStyle.color,
            text: booking.textContent.trim().replace(/\s+/g, " "),
          }
        : null,
      uses: useRendered,
      jsonldTelephone: jsonld.telephone,
      contactCardsWhats: [...document.querySelectorAll("#contacto a")].filter((a) => a.href.startsWith("https://wa.me/")).length,
      pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      errors: [],
    };
  });
  out[w].errors = errors;
  out[w].failed = failed;
  await pg.close();
}

console.log(JSON.stringify(out, null, 1));
await browser.close();
