// Shared across index.html and rsvp.html: language handling, header/scroll behavior, reveal animations.

const langChangeHandlers = [];

function getLang() {
  return localStorage.getItem("lang") || "es";
}

function onLangChange(fn) {
  langChangeHandlers.push(fn);
}

function getByPath(obj, path) {
  return path.split(".").reduce((value, key) => (value ? value[key] : undefined), obj);
}

function applyLang(lang) {
  document.documentElement.lang = lang;
  document.documentElement.dataset.lang = lang;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const value = getByPath(content[lang], el.getAttribute("data-i18n"));
    if (typeof value === "string") el.textContent = value;
  });

  document.querySelectorAll("[data-lang-btn]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.langBtn === lang);
  });

  langChangeHandlers.forEach((fn) => fn(lang));
}

function setLang(lang) {
  localStorage.setItem("lang", lang);
  applyLang(lang);
}

function initLangToggle() {
  document.querySelectorAll("[data-lang-btn]").forEach((btn) => {
    btn.addEventListener("click", () => setLang(btn.dataset.langBtn));
  });
}

function initHeaderScroll() {
  const header = document.getElementById("siteHeader");
  if (!header) return;
  const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 40);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

function initReveal() {
  const items = document.querySelectorAll(".reveal");
  if (!items.length) return;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("is-visible");
      });
    },
    { threshold: 0.2 }
  );
  items.forEach((item) => observer.observe(item));
}

function initDotNav() {
  const dots = document.querySelectorAll(".dot-nav a");
  const sections = document.querySelectorAll(".snap-section");
  if (!dots.length || !sections.length) return;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          dots.forEach((dot) => dot.classList.toggle("active", dot.dataset.dot === id));
        }
      });
    },
    { threshold: 0.5 }
  );
  sections.forEach((section) => observer.observe(section));
}
