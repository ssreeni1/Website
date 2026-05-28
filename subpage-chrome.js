/* Shared subpage chrome: theme toggle (persists in localStorage),
   NYC live clock, scroll-reveal observer. */
(function () {
  const root = document.documentElement;

  // Theme — read from localStorage, default dark
  const saved = localStorage.getItem("saneel-theme") || "dark";
  root.setAttribute("data-theme", saved);

  function setTheme(t) {
    root.setAttribute("data-theme", t);
    localStorage.setItem("saneel-theme", t);
    const btn = document.querySelector(".sp-toggle");
    if (btn) btn.textContent = t === "dark" ? "☾" : "☼";
  }
  window.toggleTheme = function () {
    const cur = root.getAttribute("data-theme") || "dark";
    setTheme(cur === "dark" ? "light" : "dark");
  };

  // Clock — NYC time
  function nycTime() {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
    return fmt.format(new Date());
  }
  function tick() {
    const el = document.querySelector("[data-clock]");
    if (el) el.textContent = nycTime() + " EST";
  }

  // Scroll reveal
  function reveal() {
    const els = document.querySelectorAll(".sp-reveal");
    if (!("IntersectionObserver" in window)) {
      els.forEach(el => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.04, rootMargin: "0px 0px -8% 0px" });
    els.forEach(el => io.observe(el));
  }

  document.addEventListener("DOMContentLoaded", () => {
    // Set initial toggle glyph
    const btn = document.querySelector(".sp-toggle");
    if (btn) btn.textContent = saved === "dark" ? "☾" : "☼";
    tick();
    setInterval(tick, 1000);
    reveal();
  });
})();
