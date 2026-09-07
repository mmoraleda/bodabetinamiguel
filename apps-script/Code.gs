/**
 * Backend for the wedding RSVP site — uses a Google Sheet as the guest database.
 *
 * Sheet layout (tab "Guests", created automatically on first run if missing):
 *   hash | group_label | guest_name | is_minor | attending | menu | notes | responded_at
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
 * A group's guest count is fixed by however many rows share its `hash` —
 * the RSVP page can't add or remove guests, only fill in each row's answer
 * (and the guest_name itself, for rows added blank as placeholder seats).
 */

const SHEET_NAME = "Guests";
const RSVP_PAGE_URL = "https://bodabetinamiguel.dpdns.org/rsvp.html";

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
    sheet.appendRow(["hash", "group_label", "guest_name", "is_minor", "attending", "menu", "notes", "responded_at"]);
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

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][col.hash] !== hash) continue;
    groupLabel = groupLabel || rows[i][col.group_label];
    guests.push({
      name: rows[i][col.guest_name],
      attending: rows[i][col.attending] || "",
      menu: rows[i][col.menu] || "",
      notes: rows[i][col.notes] || "",
      isMinor: toBool(rows[i][col.is_minor]),
    });
  }

  if (guests.length === 0) return jsonResponse({ result: "not_found" });
  return jsonResponse({ result: "success", groupLabel, guests });
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
  return submitRsvp(payload);
}

// Guests are matched to their row by position, not by name — some rows are
// blank placeholder seats until the guest fills in a name, so name can't be
// used as a key. This relies on lookupGroup and submitRsvp both walking the
// sheet in the same top-to-bottom order, and guest count never changing
// in between (the RSVP page can no longer add or remove guests).
function submitRsvp(payload) {
  const hash = payload.hash;
  if (!hash) return jsonResponse({ result: "error", message: "Missing hash" });

  const sheet = getGuestsSheet();
  const rows = sheet.getDataRange().getValues();
  const col = colIndexes(rows[0]);
  const now = new Date();

  const matchingRows = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][col.hash] === hash) matchingRows.push(i + 1);
  }

  if (matchingRows.length === 0) return jsonResponse({ result: "not_found" });

  const guests = payload.guests || [];

  guests.forEach((guest, idx) => {
    const rowNum = matchingRows[idx];
    if (!rowNum || !guest.name) return;

    sheet.getRange(rowNum, col.guest_name + 1).setValue(guest.name);
    sheet.getRange(rowNum, col.attending + 1).setValue(guest.attending || "");
    sheet.getRange(rowNum, col.menu + 1).setValue(guest.menu || "");
    sheet.getRange(rowNum, col.notes + 1).setValue(guest.notes || "");
    sheet.getRange(rowNum, col.is_minor + 1).setValue(!!guest.isMinor);
    sheet.getRange(rowNum, col.responded_at + 1).setValue(now);
  });

  return jsonResponse({ result: "success" });
}
