// Homepage-only: schedule timeline and the live countdown. RSVP lives on its own page (rsvp.html).

const WEDDING_DATE = new Date("2027-05-08T18:00:00");

function renderSchedule(lang) {
  const list = document.getElementById("scheduleList");
  if (!list) return;
  list.innerHTML = "";
  content[lang].scheduleItems.forEach((item) => {
    const li = document.createElement("li");
    const body = document.createElement("div");
    body.className = "schedule-item-body";
    const name = document.createElement("span");
    name.className = "schedule-name";
    name.textContent = item.name;
    const detail = document.createElement("span");
    detail.className = "schedule-time";
    detail.textContent = item.detail;
    body.append(name, detail);
    li.appendChild(body);
    list.appendChild(li);
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

document.addEventListener("DOMContentLoaded", () => {
  onLangChange(renderSchedule);
  initLangToggle();
  initHeaderScroll();
  initReveal();
  initDotNav();
  applyLang(getLang());
  renderCountdownTiles();
  setInterval(renderCountdownTiles, 1000);
});
