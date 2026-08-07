/**
 * Backend for the wedding RSVP site — uses a Google Sheet as the guest database.
 *
 * Sheet layout (tab "Guests", created automatically on first run if missing):
 *   hash | group_label | guest_name | is_minor | attending | menu | notes | lang | responded_at
 *
 * Setup:
 *   1. Add one row per guest. Guests invited together (a couple, a family)
 *      share the same `hash` value — that's what groups them under one RSVP link.
 *      Leave `hash` blank if you don't have one yet; leave attending/menu/notes/
 *      responded_at blank, the site fills those in.
 *   2. Run "RSVP > Generar hashes para grupos nuevos" from the sheet's menu to
 *      fill in any blank hashes (grouped by group_label).
 *   3. Run "RSVP > Generar enlaces de invitación" to get a "Links" tab with the
 *      shareable URL for each group — send those via WhatsApp/email/etc.
 *
 * Deploy this file as a Web App (Deploy > New deployment > Web app, execute as
 * yourself, access: Anyone) and paste the resulting URL into APPS_SCRIPT_URL in
 * assets/js/rsvp.js. See README.md for the full walkthrough.
 *
 * Guests can add extra people to their own group from the RSVP page (up to
 * MAX_GUESTS_PER_GROUP, enforced here too) and remove one — removal deletes
 * that row immediately, independent of the batched submit.
 */

const SHEET_NAME = "Guests";
const RSVP_PAGE_URL = "https://bodabetinamiguel.dpdns.org/rsvp.html";
const MAX_GUESTS_PER_GROUP = 3;

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("RSVP")
    .addItem("Generar hashes para grupos nuevos", "generateMissingHashes")
    .addItem("Generar enlaces de invitación", "generateInviteLinks")
    .addToUi();
}

function getGuestsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(["hash", "group_label", "guest_name", "is_minor", "attending", "menu", "notes", "lang", "responded_at"]);
  }
  return sheet;
}

function colIndexes(header) {
  const map = {};
  header.forEach((name, idx) => {
    map[name] = idx;
  });
  return map;
}

function generateShortCode() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789"; // skips ambiguous characters (0/o, 1/l/i)
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generateMissingHashes() {
  const sheet = getGuestsSheet();
  const rows = sheet.getDataRange().getValues();
  const col = colIndexes(rows[0]);
  const labelToHash = {};

  for (let i = 1; i < rows.length; i++) {
    const label = rows[i][col.group_label];
    const hash = rows[i][col.hash];
    if (label && hash) labelToHash[label] = hash;
  }

  for (let i = 1; i < rows.length; i++) {
    const label = rows[i][col.group_label];
    if (!label || rows[i][col.hash]) continue;
    if (!labelToHash[label]) labelToHash[label] = generateShortCode();
    sheet.getRange(i + 1, col.hash + 1).setValue(labelToHash[label]);
  }
}

function generateInviteLinks() {
  const guests = getGuestsSheet();
  const rows = guests.getDataRange().getValues();
  const col = colIndexes(rows[0]);
  const seen = {};
  const links = [];

  for (let i = 1; i < rows.length; i++) {
    const hash = rows[i][col.hash];
    const label = rows[i][col.group_label];
    if (!hash || seen[hash]) continue;
    seen[hash] = true;
    links.push([label, hash, RSVP_PAGE_URL + "?hash=" + hash]);
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let linksSheet = ss.getSheetByName("Links");
  if (!linksSheet) linksSheet = ss.insertSheet("Links");
  linksSheet.clear();
  linksSheet.appendRow(["group_label", "hash", "url"]);
  links.forEach((row) => linksSheet.appendRow(row));
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function toBool(value) {
  return value === true || value === "TRUE" || value === "true";
}

function lookupGroup(hash) {
  if (!hash) return jsonResponse({ result: "not_found" });

  const sheet = getGuestsSheet();
  const rows = sheet.getDataRange().getValues();
  const col = colIndexes(rows[0]);
  const guests = [];
  let groupLabel = "";
  let notes = "";

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][col.hash] !== hash) continue;
    groupLabel = groupLabel || rows[i][col.group_label];
    notes = notes || rows[i][col.notes];
    guests.push({
      name: rows[i][col.guest_name],
      attending: rows[i][col.attending] || "",
      menu: rows[i][col.menu] || "",
      isMinor: toBool(rows[i][col.is_minor]),
    });
  }

  if (guests.length === 0) return jsonResponse({ result: "not_found" });
  return jsonResponse({ result: "success", groupLabel, notes, guests });
}

function doGet(e) {
  const action = e.parameter.action;
  if (action === "lookup") return lookupGroup(e.parameter.hash);
  return jsonResponse({ result: "error", message: "Unknown action" });
}

// Requests arrive as POST with a text/plain body (see rsvp.js) to avoid
// triggering a CORS preflight that Apps Script Web Apps can't answer.
function doPost(e) {
  const payload = JSON.parse(e.postData.contents);
  if (payload.action === "remove") {
    return removeGuest(payload.hash, payload.guestName);
  }
  return submitRsvp(payload);
}

// Deletes a single guest's row immediately — used by the "remove guest"
// button on the RSVP page, separate from the batched submit below.
function removeGuest(hash, guestName) {
  if (!hash || !guestName) return jsonResponse({ result: "error", message: "Missing hash or guestName" });

  const sheet = getGuestsSheet();
  const rows = sheet.getDataRange().getValues();
  const col = colIndexes(rows[0]);

  for (let i = rows.length - 1; i >= 1; i--) {
    if (rows[i][col.hash] === hash && rows[i][col.guest_name] === guestName) {
      sheet.deleteRow(i + 1);
      return jsonResponse({ result: "success" });
    }
  }

  return jsonResponse({ result: "not_found" });
}

function submitRsvp(payload) {
  const hash = payload.hash;
  if (!hash) return jsonResponse({ result: "error", message: "Missing hash" });

  const sheet = getGuestsSheet();
  const rows = sheet.getDataRange().getValues();
  const col = colIndexes(rows[0]);
  const now = new Date();

  let groupLabel = "";
  let firstMatchRow = -1;
  const existingRowByName = {};

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][col.hash] !== hash) continue;
    if (firstMatchRow === -1) firstMatchRow = i + 1;
    groupLabel = groupLabel || rows[i][col.group_label];
    existingRowByName[rows[i][col.guest_name]] = i + 1;
  }

  if (firstMatchRow === -1) return jsonResponse({ result: "not_found" });

  const guests = payload.guests || [];
  const newGuestCount = guests.filter((g) => g.name && !existingRowByName[g.name]).length;
  if (Object.keys(existingRowByName).length + newGuestCount > MAX_GUESTS_PER_GROUP) {
    return jsonResponse({ result: "error", message: "Too many guests" });
  }

  guests.forEach((guest) => {
    const rowNum = existingRowByName[guest.name];
    if (rowNum) {
      sheet.getRange(rowNum, col.attending + 1).setValue(guest.attending || "");
      sheet.getRange(rowNum, col.menu + 1).setValue(guest.menu || "");
      sheet.getRange(rowNum, col.is_minor + 1).setValue(!!guest.isMinor);
      sheet.getRange(rowNum, col.lang + 1).setValue(payload.lang || "");
      sheet.getRange(rowNum, col.responded_at + 1).setValue(now);
    } else if (guest.name) {
      const newRow = new Array(rows[0].length).fill("");
      newRow[col.hash] = hash;
      newRow[col.group_label] = groupLabel;
      newRow[col.guest_name] = guest.name;
      newRow[col.is_minor] = !!guest.isMinor;
      newRow[col.attending] = guest.attending || "";
      newRow[col.menu] = guest.menu || "";
      newRow[col.lang] = payload.lang || "";
      newRow[col.responded_at] = now;
      sheet.appendRow(newRow);
    }
  });

  sheet.getRange(firstMatchRow, col.notes + 1).setValue(payload.notes || "");

  return jsonResponse({ result: "success" });
}
