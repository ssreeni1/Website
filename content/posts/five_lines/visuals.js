const root = document.documentElement;
const toggle = document.querySelector("#theme-toggle");
const stored = localStorage.getItem("harness-article-theme");

if (stored === "light" || stored === "dark") {
  root.dataset.theme = stored;
}

function theme() {
  if (root.dataset.theme) return root.dataset.theme;
  return matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function updateLabel() {
  if (!toggle) return;
  toggle.textContent = theme() === "dark" ? "light" : "dark";
}

if (toggle) {
  toggle.addEventListener("click", () => {
    const next = theme() === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    localStorage.setItem("harness-article-theme", next);
    updateLabel();
  });
}

updateLabel();

const tocLinks = [...document.querySelectorAll(".article-toc a[data-section]")];
const observedSections = tocLinks
  .map((link) => document.getElementById(link.dataset.section))
  .filter(Boolean);

function setCurrentSection(id) {
  for (const link of tocLinks) {
    if (link.dataset.section === id) {
      link.setAttribute("aria-current", "location");
    } else {
      link.removeAttribute("aria-current");
    }
  }
}

if ("IntersectionObserver" in window && observedSections.length) {
  const visible = new Map();
  const sectionObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        visible.set(entry.target.id, entry.boundingClientRect.top);
      } else {
        visible.delete(entry.target.id);
      }
    }

    const current = [...visible.entries()].sort((a, b) => {
      return Math.abs(a[1] - 96) - Math.abs(b[1] - 96);
    })[0];

    if (current) setCurrentSection(current[0]);
  }, {
    rootMargin: "-72px 0px -58% 0px",
    threshold: [0, 0.05, 0.2],
  });

  for (const section of observedSections) sectionObserver.observe(section);
}

for (const link of tocLinks) {
  link.addEventListener("click", () => setCurrentSection(link.dataset.section));
}
