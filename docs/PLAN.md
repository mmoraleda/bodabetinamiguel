# Plan — bodabetinamiguel

Kept in-repo instead of Notion/Linear (personal project, not a Fence Finance work project — see conversation history if resumed with the `/shape-project` tooling in mind).

## Outcome

A trilingual (ES/BG/EN) static landing page for Betina & Miguel's wedding (2027-05-08, Finca Los Rosales, Aranjuez), served on GitHub Pages, where each invited group RSVPs — attendance + menu, per guest, with the ability to add or remove people from their own group (up to 3) — through a personal link, with responses stored directly in a Google Sheet the couple already owns.

## Why hash-based invitations instead of an open form

An open "type your name" RSVP form doesn't support per-guest menu selection for a group, doesn't prevent randoms from submitting, and gives no easy way to see who *hasn't* responded yet. Pre-loading the guest list into the Sheet and handing each group a personal link solves all three: the site already knows who's in the group when they open their link, submissions can only update rows that already exist, and any row with a blank `attending` is an outstanding invite.

## Data model

Single Google Sheet ([this one](https://docs.google.com/spreadsheets/d/1oQi-HnSpschGE4f6rNZHRu0-VsOa7DlVsZUe3l2Tgbw/edit?usp=sharing)), tab **Guests**, one row per guest:

| column | meaning |
|---|---|
| `hash` | shared by everyone invited together — this is the URL param that identifies the group |
| `group_label` | display name for the group (e.g. "Familia García") — shown as the RSVP greeting |
| `guest_name` | this specific guest's name |
| `is_minor` | boolean, a checkbox on the RSVP page — marks this guest as under 18 |
| `attending` | `""` \| `"yes"` \| `"no"` — blank defaults to `"yes"` on the RSVP page until they actively change it |
| `menu` | free-text diet/allergy note for this guest (not a fixed menu choice) — only shown/relevant if attending |
| `notes` | free text (allergies/comments), stored once per group on the first matching row |
| `lang` | language they used when responding |
| `responded_at` | timestamp of their (last) submission |

A second tab, **Links**, is generated on demand (`RSVP > Generar enlaces de invitación`) — `group_label | hash | url` — as the couple's sending list.

## Request flow

- **Lookup**: `GET {APPS_SCRIPT_URL}?action=lookup&hash=X` → all rows matching `hash`, returned as `{ result, groupLabel, notes, guests: [{name, attending, menu}] }`.
- **Submit**: `POST {APPS_SCRIPT_URL}` with a JSON body `{ hash, guests, notes, lang }`, sent as `Content-Type: text/plain` specifically to avoid the CORS preflight that Apps Script Web Apps can't answer — the request itself still carries JSON, Apps Script just parses `e.postData.contents`. Any guest in `guests` whose name doesn't already have a row for that `hash` is inserted as a new row (that's how "add guest" persists); the server re-checks the group doesn't exceed `MAX_GUESTS_PER_GROUP` (3) even though the client already enforces it.
- **Remove guest**: `POST {APPS_SCRIPT_URL}` with `{ action: "remove", hash, guestName }` — deletes that row immediately, independent of the batched submit above. A guest added client-side but never submitted (no row yet) is just dropped from the form instead of calling this.
- No hash in the URL, or a hash that doesn't resolve to a real invitation → redirected straight back to `index.html` (no dead-end error page). Past the RSVP deadline → closed message, regardless of hash.

## Why RSVP is a separate, unlinked page

`rsvp.html` has no entry point from `index.html` — no nav link, no button, nothing. The only way to reach it is the personal `?hash=` link sent directly to a guest. This keeps the homepage a clean, shareable public page (safe to post anywhere) while the RSVP form stays effectively private — reachable only by whoever holds a link, same trust model as the hash lookup itself. `common.js` holds what both pages share (i18n rendering, language toggle, header scroll, reveal animations); `home.js` and `rsvp.js` hold what's specific to each.

## Visual direction

Superseded the earlier editorial/terracotta look with a direct adaptation of the couple's own watercolor invitation card (image supplied in conversation): cream/blush background, sage (`--color-accent`) + blush + lavender accents, and Cormorant Garamond (uppercase, letter-spaced) for section titles and body copy. A thin inset border frames the whole page like a printed card, and a "line — ♥ — line" flourish (`.flourish`) replaced the earlier numbered eyebrow/divider as the section divider throughout. The couple's names, the venue name, and the RSVP greeting first used a script font (Beau Rivage) to echo the invitation's handwriting — dropped after feedback that cursive wasn't wanted at all; they're now italic **Playfair Display** (the same family as the section headings, just italic/heavier), keeping a romantic feel without literal handwriting.

The reference image's watercolor floral corners couldn't be reproduced exactly — they're hand-painted illustration, not something to approximate well in CSS/SVG, and the image was pasted into the conversation rather than available as a file to crop/extract. `assets/img/floral-corner-placeholder.svg` is a simple line-art sprig standing in for now, wired into the hero's top-left/bottom-right corners — swap it for an exported PNG/SVG of the real artwork (e.g. from the invitation's source file, if there's a Canva/Illustrator original) to close the gap.

**Second pass, inspired by [weddingly-free.vercel.app](https://weddingly-free.vercel.app/)** (its actual source, `petershaan12/Weddingly-Free` on GitHub, was reviewed directly since the deployed site is a JS-rendered SPA with no screenshot tooling available in this session): borrowed its two strongest structural ideas — a full-bleed background photo behind every section (`.section-bg`, not just the hero) and staggered scroll-triggered reveals (children of each `.reveal` block cascade in with incremental delays; schedule timeline entries specifically slide in from the left, one after another) — while deliberately dropping its background-music player (explicitly not wanted) and its extra sections (opening "tap to open" gate, Bible verse, groom/bride profile slides, embedded prewedding video, public wishes wall) since the brief was to keep this site's existing sections as-is. `event-bg-placeholder.svg`, `schedule-bg-placeholder.svg`, `contact-bg-placeholder.svg`, and `rsvp-bg-placeholder.svg` are soft, on-palette placeholders for each section's photo — same swap-in-your-own-file pattern as the other placeholders.

**Real venue photos**: `hero-placeholder.svg` and `venue-placeholder.svg` were replaced with actual photos of Finca Los Rosales — `venue-hero-photo.jpg` (reception under string lights, used as the hero background, and reused as the "La Boda" section's background too — that section still had a placeholder wash initially, which read as inconsistent right next to a real photo, so it now shares the hero's photo) and `venue-aerial-photo.jpg` (drone view of the gardens, downsized from 2560×1440 to 1000px wide, used as the inline "show" photo). `event-bg-placeholder.svg` was deleted once nothing referenced it. Sourcing was deliberate: an initial search turned up real photos via a wedding photographer's portfolio site, but those depicted an actual different couple's real wedding — copyrighted third-party work with strangers' faces in it — so those were not used. The two photos actually used both carry the venue's own "LOS ROSALES ARANJUEZ" watermark/branding and were explicitly selected and supplied by the user, consistent with referencing a venue's own marketing material for a wedding taking place there.

**Editorial structure redesign (2026-08)**: the homepage was restructured from four scroll-snap sections (`inicio`/`evento`/`programa`/`contacto`) into ten narrower ones (`hero`/`intro`/`wedding`/`date`/`venue`/`location`/`schedule`/`gallery`/`information`/`closing`) to read as a photography-led narrative rather than an info-card stack. This was evaluated against reverting to an earlier terracotta/olive "editorial" palette proposal — rejected, since that direction is exactly what was superseded above in favor of the current cream/sage/blush/lavender identity; the new structure keeps that palette and typography unchanged and only changes composition/pacing. The homepage-to-`rsvp.html` relationship is unchanged: no public CTA was added, consistent with "Why RSVP is a separate, unlinked page" above. `gallery-01..04-placeholder.svg` and `closing-bg-placeholder.svg` are new placeholders (same swap-in-your-own-file pattern); `schedule-bg-placeholder.svg` and `contact-bg-placeholder.svg` were deleted since the sections they backed no longer exist. `assets/img/og-image.jpg` (1200×630) was added, currently a resized crop of `venue-hero-photo.jpg`. Visual QA during this pass also turned up that the two real photos' actual content doesn't match their filenames/descriptions above: `venue-hero-photo.jpg` is actually the drone/aerial shot, and `venue-aerial-photo.jpg` is actually the ground-level reception-under-string-lights shot. Left as-is rather than renaming binaries mid-redesign — `index.html`'s alt text for the "La Boda" photo was corrected to describe what's actually shown; the hero and "Lugar" sections still just use whichever file is wired up today (aerial-content file as the hero/venue background), which reads fine visually. Worth an actual filename swap in a future pass so the names are trustworthy again.

**Feedback pass on the editorial redesign (2026-08)**: the couple felt the ten-section version above read as worse than the previous four-section site — more scrolling for less content per screen, several new sections were sparse/placeholder-heavy, and the hero's full-bleed photo lost the earlier frosted-card intimacy. Four concrete changes came out of that: (1) the hero photo was removed entirely — no substitute photo was chosen yet, so it now runs on the plain radial-gradient palette background it used before this redesign, and the header's photo-contrast text override was removed along with it; (2) the countdown tiles moved out of the hero and into the `#date` section, next to the big day numeral, so that section has real content instead of three sparse lines of text; (3) `#gallery` was removed outright (no real photos existed for it yet, and it was pure placeholder) along with its four placeholder SVGs; (4) `#location`'s map + CTA moved inside `#venue` so "Lugar" is one section instead of two consecutive near-empty transitions. Current section order: `hero`/`intro`/`wedding`/`date`/`venue`(incl. map)/`schedule`/`information`/`closing` — eight, not ten.

## Build slices (status)

1. ~~Static skeleton~~ — done
2. ~~Bilingual toggle~~ — done
3. ~~Hash-lookup RSVP (guest cards, per-guest attending + menu)~~ — done
4. ~~Apps Script backend (Guests sheet, lookup/submit, hash + link generator menu)~~ — done
5. ~~Split RSVP onto its own unlinked page~~ — done
6. ~~Editorial visual redesign~~ — done
7. ~~Guest self-service: add/remove guests within a group (max 3), Bulgarian added as a third language~~ — done
8. ~~Menu choice replaced with a free-text per-guest diet/allergy field; default attendance is "yes"~~ — done
9. ~~Optional CI: GitHub Action to auto-push/redeploy `Code.gs` via clasp~~ — done, needs one-time credential setup (see README)
10. ~~Romantic/botanical redesign adapted from the couple's invitation card~~ — done, floral corners are a placeholder pending the real artwork
11. ~~Per-section background photos + staggered scroll transitions, inspired by weddingly-free~~ — done, four of five backgrounds are still placeholders
12. ~~Typography swap: script font dropped for italic Playfair Display, per feedback~~ — done
13. ~~Real venue photos for the hero background and the inline "show" photo~~ — done
14. ~~Schedule: added a Recepción entry at the real 18:00 start time; the other four items switched from a time placeholder to a descriptive-text placeholder~~ — done
15. ~~Per-guest "is a minor" checkbox (`is_minor` column, checkbox on the RSVP page)~~ — done
16. **Not yet done, needs the couple's input:** real descriptions for Ceremonia/Cóctel/Cena/Fiesta in the schedule, guest list itself, Apps Script deployment + `APPS_SCRIPT_URL` wiring, DNS check for `bodabetinamiguel.dpdns.org`, real RSVP section photo, real floral corner artwork
17. ~~Editorial structure redesign: hero/intro/wedding/date/venue/location/schedule/gallery/information/closing, semantic typography scale, accessible information accordion, hero parallax, timeline line-reveal, `og:image`~~ — done, still needs: gallery photos, a dedicated closing photo (currently a placeholder, must differ from the hero), a dedicated `og-image` composition, and real copy for the "Llegada y aparcamiento" / "Alojamiento" / "Niños" information items (currently "por confirmar" placeholders)
