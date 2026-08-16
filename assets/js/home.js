// Homepage-only: timeline, information accordion, and the live countdown.
// RSVP lives on its own page (rsvp.html).

const WEDDING_DATE = new Date("2027-05-08T17:30:00");

function renderSchedule(lang) {
  const list = document.getElementById("scheduleList");
  if (!list) return;
  list.innerHTML = "";
  content[lang].scheduleItems.forEach((item) => {
    const article = document.createElement("article");
    article.className = "timeline-item";

    const time = document.createElement("span");
    time.className = "timeline-time";
    time.textContent = item.detail;

    const marker = document.createElement("span");
    marker.className = "timeline-marker";

    const body = document.createElement("div");
    body.className = "timeline-body";
    const title = document.createElement("span");
    title.className = "timeline-title";
    title.textContent = item.name;
    body.appendChild(title);

    article.append(time, marker, body);
    list.appendChild(article);
  });
}

function renderInformation(lang) {
  const list = document.getElementById("informationList");
  if (!list) return;
  list.innerHTML = "";
  content[lang].information.items.forEach((item, index) => {
    const panelId = `info-panel-${index}`;
    const itemEl = document.createElement("div");
    itemEl.className = "accordion-item";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "accordion-trigger";
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", panelId);
    button.textContent = item.title;

    const panel = document.createElement("div");
    panel.className = "accordion-panel";
    panel.id = panelId;
    panel.hidden = true;
    const body = document.createElement("p");
    body.textContent = item.body;
    panel.appendChild(body);

    itemEl.append(button, panel);
    list.appendChild(itemEl);
  });
}

function renderCountdownTiles() {
  const daysEl = document.getElementById("cdDays");
  if (!daysEl) return;
  const totalSeconds = Math.max(0, Math.floor((WEDDING_DATE - new Date()) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  daysEl.textContent = String(days);
  document.getElementById("cdHours").textContent = String(hours).padStart(2, "0");
  document.getElementById("cdMinutes").textContent = String(minutes).padStart(2, "0");
  document.getElementById("cdSeconds").textContent = String(seconds).padStart(2, "0");
}

function buildWeddingICS() {
  const pad = (n) => String(n).padStart(2, "0");
  const toICSDate = (date) =>
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;

  // 17:30 in Madrid (CEST, UTC+2) on 2027-05-08 = 15:30 UTC.
  const start = new Date("2027-05-08T15:30:00Z");
  const end = new Date("2027-05-08T23:00:00Z");

  const alarm = (trigger) =>
    ["BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Recordatorio: Boda de Betina & Miguel", `TRIGGER:${trigger}`, "END:VALARM"].join("\r\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Betina & Miguel//Boda 2027//ES",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    "UID:betina-miguel-wedding-20270508@bodabetinamiguel.dpdns.org",
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(start)}`,
    `DTEND:${toICSDate(end)}`,
    "SUMMARY:Boda de Betina & Miguel",
    "DESCRIPTION:¡Nos casamos! Os esperamos en Finca Los Rosales.",
    "LOCATION:Finca Los Rosales\\, Camino de los Olivos\\, 28300 Aranjuez\\, Madrid",
    // Months aren't a valid ICS duration unit (RFC 5545), so 1 month is approximated as 30 days.
    alarm("-P30D"),
    alarm("-P7D"),
    alarm("-P1D"),
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function initCalendarButton() {
  const link = document.getElementById("downloadIcsLink");
  if (!link) return;
  const blob = new Blob([buildWeddingICS()], { type: "text/calendar;charset=utf-8" });
  link.href = URL.createObjectURL(blob);
}

function initAccordions() {
  const list = document.getElementById("informationList");
  if (!list) return;
  list.addEventListener("click", (event) => {
    const trigger = event.target.closest(".accordion-trigger");
    if (!trigger) return;
    const panel = document.getElementById(trigger.getAttribute("aria-controls"));
    const isOpen = trigger.getAttribute("aria-expanded") === "true";
    trigger.setAttribute("aria-expanded", String(!isOpen));
    panel.hidden = isOpen;
  });
}

function initHome() {
  onLangChange(renderSchedule);
  onLangChange(renderInformation);
  initLangToggle();
  initHeaderScroll();
  initReveal();
  initDotNav();
  initAccordions();
  initCalendarButton();
  applyLang(getLang());
  renderCountdownTiles();
  setInterval(renderCountdownTiles, 1000);
}

document.addEventListener("DOMContentLoaded", initHome);
