# bodabetinamiguel

Landing page for Betina & Miguel's wedding — 8 de mayo de 2027, Finca Los Rosales, Aranjuez (Madrid).

Live at [bodabetinamiguel.dpdns.org](https://bodabetinamiguel.dpdns.org).

## What this is

A static, trilingual (ES/BG/EN) wedding site — event details, schedule, dress code — plus a separate RSVP page. There's no build step; plain HTML/CSS/JS served directly by GitHub Pages.

The homepage (`index.html`) never links to the RSVP page. RSVP is invite-only:

- Guests are pre-loaded into a Google Sheet, grouped by a `hash` (one hash per invited group — couple, family, etc.).
- Each group gets a personal link: `https://bodabetinamiguel.dpdns.org/rsvp.html?hash=THEIR_HASH`, sent directly (WhatsApp/email/etc.) — it's not discoverable from the homepage. An unknown or missing hash just bounces back to the homepage.
- Opening that link looks up the group in the Sheet and shows a form pre-filled with their names (defaulted to attending), where each guest can mark attendance and note any diet/allergy.
- Guests can also add extra people to their own group (up to 3 total) or remove one — removing deletes that row from the Sheet immediately, not just from the form.
- Submitting writes responses back into the same Sheet — that's where you manage responses, no separate admin UI.

See [docs/PLAN.md](docs/PLAN.md) for the full data model and design decisions.

## Project structure

```
index.html               homepage: hero, intro, wedding, date, venue, location, schedule, gallery, information, closing
rsvp.html                 RSVP page (not linked from the homepage — invite-only)
assets/css/styles.css    styling for both pages
assets/js/content.js     ES/BG/EN copy — edit this to change any text
assets/js/common.js      shared: language toggle, header scroll, reveal animations
assets/js/home.js        homepage-only: schedule timeline, live countdown
assets/js/rsvp.js        RSVP-only: hash lookup/submit logic
apps-script/Code.gs      Google Apps Script backend (paste into your Sheet's Apps Script editor)
apps-script/appsscript.json  Apps Script manifest (Web App access/executeAs config)
apps-script/.clasp.json.example  clasp config template — copy to .clasp.json locally (git-ignored) with your real scriptId
.github/workflows/deploy-apps-script.yml   auto-deploys Code.gs on push (optional, needs one-time setup)
docs/PLAN.md             architecture & data model reference
CNAME                    GitHub Pages custom domain
```

## Local development

No build tools needed — just serve the folder statically, e.g.:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000`. To test the personalized RSVP flow locally you'll need the Apps Script backend deployed first (below) and a real hash in the Sheet, e.g. `http://localhost:8000/rsvp.html?hash=abc123`.

## Setting up the Google Sheet + Apps Script backend

The guest list and responses live in [this Google Sheet](https://docs.google.com/spreadsheets/d/1oQi-HnSpschGE4f6rNZHRu0-VsOa7DlVsZUe3l2Tgbw/edit?usp=sharing).

1. Open the spreadsheet above.
2. In it, go to **Extensions > Apps Script**, delete the default code, and paste in the contents of [apps-script/Code.gs](apps-script/Code.gs).
3. Back in the Sheet, reload it — a new **RSVP** menu should appear (you may need to re-open the sheet).
4. Create/open the **Guests** tab (the script creates it automatically the first time it runs) and add one row per guest, with these columns:

   | hash | group_label | guest_name | is_minor | attending | menu | notes | lang | responded_at |
   |------|-------------|------------|----------|-----------|------|-------|------|---------------|

   - Leave `hash` blank for now.
   - `group_label` should be the same for everyone invited together (e.g. `Familia García`) — that's what groups them under one link.
   - `is_minor` can be left blank/`FALSE` — it's a checkbox on the RSVP page (marks a guest as under 18).
   - Leave `attending`, `menu`, `notes`, `lang`, `responded_at` blank — the site fills those in.
5. Run **RSVP > Generar hashes para grupos nuevos** to fill in the blank `hash` values (grouped by `group_label`).
6. Run **RSVP > Generar enlaces de invitación** — this creates a **Links** tab with each group's shareable `rsvp.html?hash=...` URL. Send those out via WhatsApp/email/etc.
7. In the Apps Script editor, click **Deploy > New deployment**, choose type **Web app**, set "Execute as" to yourself and "Who has access" to **Anyone**, then deploy. Copy the resulting URL.
8. Paste that URL into `APPS_SCRIPT_URL` in [assets/js/rsvp.js](assets/js/rsvp.js), commit, and push.

Whenever you add new guests later, re-run steps 5–6 to generate their hash and link.

Groups are capped at 3 guests, enforced both in the RSVP page and in `Code.gs` (`MAX_GUESTS_PER_GROUP`) — raise that constant in both places if a group ever needs more.

### Managing responses

Just open the **Guests** tab — `attending`, `menu`, `notes`, and `responded_at` update in place as people RSVP. Guests added by the group itself (via "add guest" on the RSVP page) show up here as new rows once submitted; removing a guest from the RSVP page deletes their row immediately. Sort/filter as needed.

### Automated deploys via GitHub Actions (optional)

[.github/workflows/deploy-apps-script.yml](.github/workflows/deploy-apps-script.yml) pushes `apps-script/Code.gs` to your Apps Script project and redeploys it automatically whenever something under `apps-script/` changes on `main` — no more manually pasting code into the Apps Script editor after every edit. It uses [`clasp`](https://github.com/google/clasp), Google's official CLI, and redeploys the *existing* Web App deployment in place, so `APPS_SCRIPT_URL` never has to change.

This needs a one-time manual setup (clasp can't get its own credentials, and GitHub can't create the first deployment for you). `apps-script/.clasp.json` (with your real `scriptId`) is git-ignored — it's never committed; the workflow writes its own copy from a secret, and `apps-script/.clasp.json.example` is the committed template for local use.

1. Locally: `npm install -g @google/clasp`, then `clasp login` — this opens a browser to authorize the same Google account that owns the Apps Script project, and writes `~/.clasprc.json`.
2. Get the **Script ID**: in the Sheet's Apps Script editor, click the gear icon (Project Settings) and copy it.
3. Get the **Deployment ID** of the Web App you already deployed manually: Apps Script editor > **Deploy > Manage deployments**, select it, and copy the ID shown there. (Or, once you've done step 4 locally, `cp apps-script/.clasp.json.example apps-script/.clasp.json`, fill in the real `scriptId`, and run `clasp deployments` from inside `apps-script/` — that file stays local, `.gitignore` keeps it out of the repo.)
4. In the GitHub repo, under **Settings > Secrets and variables > Actions**:
   - New **secret** `CLASP_CREDENTIALS` — paste the entire contents of `~/.clasprc.json` from step 1.
   - New **secret** `CLASP_SCRIPT_ID` — the Script ID from step 2.
   - New **variable** `CLASP_DEPLOYMENT_ID` — the Deployment ID from step 3.
5. Push a change under `apps-script/**` — the workflow writes `.clasp.json` from `CLASP_SCRIPT_ID` at run time and deploys automatically from there on.

`CLASP_CREDENTIALS` grants whoever holds it the ability to edit and deploy that Apps Script project as your Google account — treat it like any other credential (only add it to this repo's secrets, and re-run `clasp login` to rotate it if you ever suspect it leaked).

## Deployment (GitHub Pages)

This repo is already wired for GitHub Pages with the custom domain in `CNAME` (`bodabetinamiguel.dpdns.org`). In the GitHub repo settings, under **Pages**, make sure the source is set to deploy from the `main` branch (root). Pushing to `main` redeploys automatically.

## Adding real photos / artwork

Two real photos of Finca Los Rosales (official venue-branded shots, chosen from the venue's own marketing material — not third-party wedding photography of someone else's event) are already in use, across three places:

- `assets/img/venue-hero-photo.jpg` — a warm reception shot under string lights, used as the hero background, the "Lugar" section background, and (resized to 1200×630) as `assets/img/og-image.jpg`, the interim social-share image
- `assets/img/venue-aerial-photo.jpg` — a drone view of the gardens, used as the inline photo next to "La Boda" copy

The rest are still placeholders, all following the same soft on-palette wash pattern:

- `assets/img/gallery-01..04-placeholder.svg` — the editorial gallery grid (`index.html`, `#gallery`)
- `assets/img/closing-bg-placeholder.svg` — the full-screen closing photo (`index.html`, `#closing`) — should end up being a *different* photo than the hero
- `assets/img/rsvp-bg-placeholder.svg` — behind the RSVP page (`rsvp.html`, its `.section-bg`)
- `assets/img/floral-corner-placeholder.svg` — the top-left/bottom-right corner decoration on the hero (a simple line-art stand-in for the watercolor florals on the invitation card — export the real artwork as a PNG/SVG if you have the source file and swap it in for an exact match)
- `assets/img/og-image.jpg` — currently just a resized crop of the hero photo; replace with a dedicated composition once one exists

Drop your real files into `assets/img/` and point to them instead — either overwrite the filenames directly, or add new files and update the matching `background-image` inline style (on `.section-bg`) or `<img src>` in `index.html` / `rsvp.html`.

## Editing content

- Text (ES/BG/EN): [assets/js/content.js](assets/js/content.js)
- Event details (date, venue, dress code, schedule): same file, plus the map link/embed URLs in `index.html`
- Wedding date used for the homepage countdown: `WEDDING_DATE` at the top of [assets/js/home.js](assets/js/home.js)
- RSVP deadline that closes the form: `RSVP_DEADLINE` at the top of [assets/js/rsvp.js](assets/js/rsvp.js)
- Diet/allergy field label, hint, and placeholder: `form.dietLabel` / `form.dietHelp` / `form.dietPlaceholder` in `content.js` (per language)
