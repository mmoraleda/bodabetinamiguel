// rsvp.html only. This page is intentionally not linked from the homepage —
// guests reach it only through their personal ?hash=... link (see apps-script/Code.gs).

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxnmlWonPv9fUDgcrxk7tAkk0sLovCScndZNt6Y93yWTgcV9UTzi8UmO5JLPwh6g-ZZ/exec";
const RSVP_DEADLINE = new Date("2027-04-15T23:59:59");

let currentHash = null;
let groupData = null; // { groupLabel, guests: [{ name, attending, menu, notes, isMinor, needsName }] }
let rsvpPhase = "loading"; // loading | found | closed | success

// ?hash=demo previews the guest-card UI with fake data, with no network call —
// useful before the Apps Script backend is deployed. "demo" can never collide
// with a real generated hash (generateShortCode in Code.gs excludes the letter "o").
const DEMO_HASH = "demo";
const DEMO_GROUP = {
  groupLabel: "Familia García (demo)",
  guests: [
    {
      name: "Ana García",
      attending: "yes",
      menu: "",
      notes: "",
      isMinor: false,
      needsName: false,
    },
    {
      name: "Luis García",
      attending: "yes",
      menu: "",
      notes: "",
      isMinor: false,
      needsName: false,
    },
  ],
};

function getHashFromUrl() {
  return new URLSearchParams(window.location.search).get("hash");
}

// No hash, or a hash that doesn't resolve to a real invitation, sends the
// visitor back to the homepage rather than showing a dead-end error page.
function redirectHome() {
  window.location.replace("index.html");
}

function setRsvpPhase(phase) {
  rsvpPhase = phase;
  document.getElementById("rsvpLoading").hidden = phase !== "loading";
  document.getElementById("rsvpForm").hidden = phase !== "found";
  document.getElementById("rsvpClosed").hidden = phase !== "closed";
  document.getElementById("rsvpSuccess").hidden = phase !== "success";
  renderRsvpForLang(getLang());
}

function renderRsvpForLang(lang) {
  if (rsvpPhase === "found" && groupData) {
    renderGuestForm(lang);
  }
  if (rsvpPhase === "success") {
    document.getElementById("rsvpSuccessMessage").textContent =
      content[lang].form.success;
  }
}

function renderGuestForm(lang) {
  document.getElementById("rsvpGreeting").textContent = content[
    lang
  ].rsvpGreeting(groupData.groupLabel);

  const guestList = document.getElementById("guestList");
  guestList.innerHTML = "";

  groupData.guests.forEach((guest, idx) => {
    const card = document.createElement("div");
    card.className = "guest-card";

    const header = document.createElement("div");
    header.className = "guest-card-header";

    if (guest.needsName) {
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.className = "guest-name-input";
      nameInput.placeholder = content[lang].form.guestNamePlaceholder;
      nameInput.value = guest.name;
      nameInput.addEventListener("input", (e) => {
        guest.name = e.target.value;
      });
      header.appendChild(nameInput);
    } else {
      const nameEl = document.createElement("p");
      nameEl.className = "guest-name";
      nameEl.textContent = guest.name;
      header.appendChild(nameEl);
    }

    card.appendChild(header);

    const attendingWrap = document.createElement("div");
    attendingWrap.className = "form-field";
    const attendingLabel = document.createElement("span");
    attendingLabel.className = "field-label";
    attendingLabel.textContent = content[lang].form.attending;
    attendingWrap.appendChild(attendingLabel);

    const radioGroup = document.createElement("div");
    radioGroup.className = "radio-group";
    ["yes", "no"].forEach((val) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = `attending-${idx}`;
      input.value = val;
      input.required = true;
      if (guest.attending === val) input.checked = true;
      input.addEventListener("change", () => {
        guest.attending = val;
        document.getElementById(`menuField-${idx}`).hidden = val !== "yes";
      });
      const span = document.createElement("span");
      span.textContent = content[lang].form[val];
      label.append(input, span);
      radioGroup.appendChild(label);
    });
    attendingWrap.appendChild(radioGroup);
    card.appendChild(attendingWrap);

    const minorWrap = document.createElement("div");
    minorWrap.className = "checkbox-field";
    const minorLabel = document.createElement("label");
    const minorCheckbox = document.createElement("input");
    minorCheckbox.type = "checkbox";
    minorCheckbox.name = `minor-${idx}`;
    minorCheckbox.checked = !!guest.isMinor;
    minorCheckbox.addEventListener("change", (e) => {
      guest.isMinor = e.target.checked;
    });
    const minorText = document.createElement("span");
    minorText.textContent = content[lang].form.minorLabel;
    minorLabel.append(minorCheckbox, minorText);
    minorWrap.appendChild(minorLabel);
    card.appendChild(minorWrap);

    const menuField = document.createElement("div");
    menuField.className = "menu-field";
    menuField.id = `menuField-${idx}`;
    menuField.hidden = guest.attending !== "yes";

    const menuLabel = document.createElement("label");
    menuLabel.setAttribute("for", `menu-${idx}`);
    menuLabel.textContent = content[lang].form.dietLabel;

    const menuHint = document.createElement("p");
    menuHint.className = "field-hint";
    menuHint.textContent = content[lang].form.dietHelp;

    const menuInput = document.createElement("input");
    menuInput.type = "text";
    menuInput.id = `menu-${idx}`;
    menuInput.name = `menu-${idx}`;
    menuInput.placeholder = content[lang].form.dietPlaceholder;
    menuInput.value = guest.menu || "";
    menuInput.addEventListener("input", (e) => {
      guest.menu = e.target.value;
    });

    menuField.append(menuLabel, menuHint, menuInput);
    card.appendChild(menuField);

    const notesWrap = document.createElement("div");
    notesWrap.className = "form-field";
    const notesLabel = document.createElement("label");
    notesLabel.setAttribute("for", `notes-${idx}`);
    notesLabel.textContent = content[lang].form.notes;
    const notesInput = document.createElement("textarea");
    notesInput.id = `notes-${idx}`;
    notesInput.name = `notes-${idx}`;
    notesInput.rows = 3;
    notesInput.value = guest.notes || "";
    notesInput.addEventListener("input", (e) => {
      guest.notes = e.target.value;
    });
    notesWrap.append(notesLabel, notesInput);
    card.appendChild(notesWrap);

    guestList.appendChild(card);
  });
}

async function lookupGroup(hash) {
  setRsvpPhase("loading");
  try {
    const url = `${APPS_SCRIPT_URL}?action=lookup&hash=${encodeURIComponent(hash)}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.result === "success") {
      groupData = json;
      groupData.guests.forEach((g) => {
        // Default to "yes" unless the sheet already has an explicit answer.
        g.attending = g.attending || "yes";
        g.menu = g.menu || "";
        g.notes = g.notes || "";
        g.isMinor = !!g.isMinor;
        // Some rows are blank placeholder seats until the guest names them.
        g.needsName = !g.name;
      });
      // Guests who already answered in their language once get the page in
      // that language again, without having to click the toggle every time.
      if (groupData.lang && content[groupData.lang]) {
        setLang(groupData.lang);
      }
      setRsvpPhase("found");
    } else {
      redirectHome();
    }
  } catch (err) {
    redirectHome();
  }
}

function refreshRsvp() {
  if (new Date() > RSVP_DEADLINE) {
    setRsvpPhase("closed");
    return;
  }
  if (!currentHash) {
    redirectHome();
    return;
  }
  if (currentHash === DEMO_HASH) {
    groupData = JSON.parse(JSON.stringify(DEMO_GROUP));
    setRsvpPhase("found");
    return;
  }
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes("PASTE_YOUR")) {
    console.warn(
      "Apps Script URL not configured yet — cannot look up invitation.",
    );
    redirectHome();
    return;
  }
  lookupGroup(currentHash);
}

function initForm() {
  const form = document.getElementById("rsvpForm");
  const message = document.getElementById("formMessage");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const lang = getLang();
    const formData = new FormData(form);

    // Bots that fill the hidden honeypot field get a fake success instead of hitting the sheet.
    if (formData.get("website")) {
      message.textContent = content[lang].form.success;
      return;
    }

    const missingName = groupData.guests.some((g) => !g.name.trim());
    if (missingName) {
      message.textContent = content[lang].form.guestNameRequired;
      return;
    }

    const allAnswered = groupData.guests.every((_, idx) =>
      formData.get(`attending-${idx}`),
    );
    if (!allAnswered) {
      message.textContent = content[lang].form.validationError;
      return;
    }

    const guests = groupData.guests.map((guest, idx) => {
      const attending = formData.get(`attending-${idx}`);
      return {
        name: guest.name.trim(),
        attending,
        menu: attending === "yes" ? formData.get(`menu-${idx}`) : "",
        notes: (formData.get(`notes-${idx}`) || "").trim(),
        isMinor: formData.get(`minor-${idx}`) === "on",
      };
    });

    const payload = {
      hash: currentHash,
      guests,
      lang,
    };

    try {
      const res = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.result === "success") {
        groupData.guests = guests.map((g) => ({ ...g, needsName: false }));
        setRsvpPhase("success");
      } else {
        message.textContent = content[lang].form.error;
      }
    } catch (err) {
      message.textContent = content[lang].form.error;
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  currentHash = getHashFromUrl();
  onLangChange(renderRsvpForLang);
  initLangToggle();
  initHeaderScroll();
  initReveal();
  initForm();
  applyLang(getLang());
  refreshRsvp();
});
