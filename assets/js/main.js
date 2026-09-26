/* Scalix — interactions */
(function () {
  "use strict";

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Hero background video ---------- */
  var heroVideo = document.getElementById("hero-video");

  if (heroVideo) {
    if (reducedMotion) {
      heroVideo.removeAttribute("autoplay");
      heroVideo.pause();
    } else {
      var tryPlay = heroVideo.play();
      if (tryPlay && typeof tryPlay.catch === "function") tryPlay.catch(function () {});

      document.addEventListener("visibilitychange", function () {
        if (document.hidden) heroVideo.pause();
        else heroVideo.play().catch(function () {});
      });
    }
  }

  /* ---------- Mobile menu ---------- */
  var menuBtn = document.getElementById("menu-btn");
  var mobileMenu = document.getElementById("mobile-menu");

  if (menuBtn && mobileMenu) {
    var setMenu = function (open) {
      mobileMenu.classList.toggle("hidden", !open);
      menuBtn.setAttribute("aria-expanded", String(open));
      menuBtn.setAttribute("aria-label", open ? "Cerrar menú de navegación" : "Abrir menú de navegación");
    };

    menuBtn.addEventListener("click", function () {
      setMenu(mobileMenu.classList.contains("hidden"));
    });

    mobileMenu.addEventListener("click", function (e) {
      if (e.target.closest("a")) setMenu(false);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !mobileMenu.classList.contains("hidden")) {
        setMenu(false);
        menuBtn.focus();
      }
    });
  }

  /* ---------- FAQ accordion ---------- */
  var triggers = document.querySelectorAll(".faq-trigger");

  triggers.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var expanded = btn.getAttribute("aria-expanded") === "true";
      var panel = document.getElementById(btn.getAttribute("aria-controls"));
      var icon = btn.querySelector(".faq-icon");

      btn.setAttribute("aria-expanded", String(!expanded));
      if (panel) panel.classList.toggle("grid-rows-[1fr]", !expanded);
      if (panel) panel.classList.toggle("grid-rows-[0fr]", expanded);
      if (icon) icon.classList.toggle("rotate-45", !expanded);
    });
  });

  /* Open the first FAQ by default */
  if (triggers.length) triggers[0].click();

  /* ---------- Scroll reveal ---------- */
  var revealEls = document.querySelectorAll(".reveal");

  if (reducedMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach(function (el) {
      el.classList.add("is-visible");
    });
  } else {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    revealEls.forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ---------- Animated counters ---------- */
  var counters = document.querySelectorAll("[data-count-to]");

  var formatCounter = function (value, decimals) {
    return value.toLocaleString("es-ES", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  var runCounter = function (el) {
    var target = parseFloat(el.getAttribute("data-count-to"));
    if (isNaN(target)) return;

    var decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
    var prefix = el.getAttribute("data-prefix") || "";
    var suffix = el.getAttribute("data-suffix") || "";
    var duration = 1500;
    var start = null;

    var tick = function (now) {
      if (start === null) start = now;
      var p = Math.min((now - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3); /* easeOutCubic */
      el.textContent = prefix + formatCounter(target * eased, decimals) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  /* With reduced motion the HTML already shows the final value — leave it static */
  if (counters.length && !reducedMotion && "IntersectionObserver" in window) {
    var counterObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            runCounter(entry.target);
            counterObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.6 }
    );
    counters.forEach(function (el) {
      counterObserver.observe(el);
    });
  }

  /* ---------- Process tabs (vertical, auto-rotating) ---------- */
  var processRoot = document.querySelector("[data-process]");

  if (processRoot) {
    var tabs = Array.prototype.slice.call(processRoot.querySelectorAll('[role="tab"]'));
    var panels = Array.prototype.slice.call(processRoot.querySelectorAll(".process-panel"));
    var CYCLE = 5000; /* ms per tab */
    var active = 0;
    var timer = null;
    var startedAt = 0;
    var elapsed = 0;
    var autoOn = !reducedMotion;
    var pauseReasons = { hover: false, focus: false, offscreen: true };

    var procActivate = function (i) {
      active = i;
      elapsed = 0;
      startedAt = Date.now();
      tabs.forEach(function (tab, n) {
        var selected = n === i;
        tab.setAttribute("aria-selected", String(selected));
        tab.tabIndex = selected ? 0 : -1;
      });
      panels.forEach(function (panel, n) {
        panel.classList.toggle("is-active", n === i);
      });
    };

    var procPaused = function () {
      return pauseReasons.hover || pauseReasons.focus || pauseReasons.offscreen;
    };

    var procClear = function () {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    var procStart = function (delay) {
      procClear();
      startedAt = Date.now();
      timer = setTimeout(procNext, delay);
    };

    var procNext = function () {
      procActivate((active + 1) % tabs.length);
      procStart(CYCLE);
    };

    /* Keep timer and progress bar in sync with the pause state */
    var procSync = function () {
      processRoot.classList.toggle("is-paused", procPaused() || !autoOn);
      if (!autoOn) {
        procClear();
        return;
      }
      if (procPaused()) {
        if (timer) elapsed = Math.min(CYCLE, elapsed + (Date.now() - startedAt));
        procClear();
      } else if (!timer) {
        procStart(Math.max(400, CYCLE - elapsed));
      }
    };

    var procPause = function (reason, value) {
      pauseReasons[reason] = value;
      procSync();
    };

    tabs.forEach(function (tab, i) {
      tab.addEventListener("mouseenter", function () {
        procActivate(i);
        procPause("hover", true);
      });
      tab.addEventListener("mouseleave", function () {
        procPause("hover", false);
      });
      tab.addEventListener("focus", function () {
        procActivate(i);
        procPause("focus", true);
      });
      tab.addEventListener("blur", function () {
        procPause("focus", false);
      });
      tab.addEventListener("click", function () {
        procActivate(i);
        if (procPaused() || !autoOn) procSync();
        else procStart(CYCLE);
      });
      tab.addEventListener("keydown", function (e) {
        var dir = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
        if (!dir) return;
        e.preventDefault();
        tabs[(i + dir + tabs.length) % tabs.length].focus();
      });
    });

    /* Only rotate while the section is on screen */
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            procPause("offscreen", !entry.isIntersecting);
          });
        },
        { threshold: 0.15 }
      ).observe(processRoot);
    } else {
      pauseReasons.offscreen = false;
    }

    procSync();
  }

  /* ---------- Current year ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
