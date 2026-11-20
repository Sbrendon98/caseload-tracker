# Caseload Tracker

A small, private time log for a school psychologist. Log the time you spend on each student case, see it on a calendar, and export it to CSV. It runs in the browser, works offline, and installs to an iPhone Home Screen like an app.

**Privacy:** there is no server. Students are identified by a **first name and last initial, or initials, plus a case number** (never a full last name). Everything is stored on the device in the browser's database. Nothing is sent anywhere. The only way data leaves is when you tap *Export CSV* or *Back up* and choose where to send the file.

That promise is enforced, not just intended: the published page carries a Content-Security-Policy with `connect-src 'none'`, so the browser itself refuses any network connection from the app. Only one library (Preact) ships to the phone, and a test fails if that list grows or if any code contains a network call.

## What it does

- **Cases:** add a case with a student's **first name and last initial** (`jane d` becomes `Jane D.`) **or initials** (`a s` becomes `A.S`), a case number of up to 10 letters or numbers, an optional due date and optional notes. A full last name (`Jane Doe`) is refused. The ID (for example `Jane D.-122445543`) must be unique across active and archived cases. Names are stored on the device and appear in exports and backups, so only enter what you are comfortable having in those files.
- **Time entries:** add time with a date, hours and minutes, and an optional note. Quick buttons (15 min, 30 min, 45 min, 1 hr, 1.5 hr) and a start/stop timer make it fast. Entries can be edited or deleted.
- **Due dates:** cases that are overdue or due within a week get a badge.
- **Archiving and the 50-case limit:** up to 50 active cases. Swipe a case left to archive it (or tap the ⋯ button). When you add a 51st case, a sheet lists your oldest cases so you can archive finished ones, then your new case is created for you.
- **Calendar:** a dot on every day you logged time. Tap a day to see every case you worked on that day. Filter to one student, or tap *View in calendar* on a case.
- **Export CSV:** Week, Month, School year (July 1 to June 30) or All. **One row per case** with time in that range: the total in words ("1 hour and 13 minutes") and every date and time worked listed in one cell. Time on archived cases is included. Opens correctly in Excel and Numbers.
- **Backup and restore:** save everything to a JSON file and bring it back, on the same phone or another device.
- **Tutorials:** short pop-ups appear once, the first time each feature is used. Replay any of them from Options > Tutorials.
- **Works offline** after the first load.

### Settings and assumptions

- Weeks run **Sunday to Saturday** by default (Options > Week starts on lets you choose Monday). This affects the calendar, the "This week" total, and the Week export.
- Dates are the device's local calendar dates.
- One entry can be at most 24 hours.
- A cell in the CSV that starts with `=`, `+`, `@` (or `-` followed by a non-space) is prefixed with `'` so a spreadsheet does not run it as a formula.

## Deploy to GitHub Pages

The site is built by GitHub each time you push to `main` (see `.github/workflows/deploy.yml`). It runs the tests first, so a broken change is never published.

**One-time setup**

1. Push the code to GitHub: `git push -u origin main`.
2. In the repository on github.com, open **Settings > Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**. (Not "Deploy from a branch".) There is nothing to save; the choice applies immediately.
4. Open the **Actions** tab. Under "Test, build and deploy to GitHub Pages" a run starts when you push; if not, click *Run workflow*. Wait for it to turn green (about a minute).
5. The address is shown in the run's **deploy** step and under Settings > Pages, and looks like `https://<your-username>.github.io/<repository-name>/`. For this repository: `https://sbrendon98.github.io/caseload-tracker/`.

Notes:
- A free GitHub account can publish Pages only from a **public** repository. The repository contains no student data (data lives only on each device), so public is fine.
- If the run fails at *Unit and component tests*, nothing is deployed and the previous version stays live. Open the failed step to see why.
- All file paths are relative, so the app works from the `/<repository-name>/` sub-path.

### Publishing an update

Commit and push to `main`. The workflow tests, builds and publishes. Nothing needs to be bumped by hand: every build gets new file names, and the offline cache updates itself.

On the phone, open the app. Once the new version has downloaded, a banner says **A new version is ready**. Tap **Update**. Her data is not touched.

### Trying a change before it goes live

```bash
npm install
npm run dev        # live-reloading dev server at http://localhost:5173
npm run build      # production build into dist/
npm run preview    # serve dist/ locally, with the offline cache and the CSP active
```

## Install on iPhone

1. On the iPhone, open the site address in **Safari**.
2. Tap the **Share** button, then **Add to Home Screen**, then **Add**.
3. **Open the app from the Home Screen icon from now on.**

> **Install first, then use only the installed icon.** On iPhone, an app on the Home Screen has its **own separate storage**, different from the Safari tab it was added from. If you enter cases in Safari and then install, the installed app starts empty. (The same is true for Safari's *File > Add to Dock* on a Mac.) If that happened, open the Safari version, tap **Back up** in Options, then open the installed app and use **Restore**.

The first visit needs internet. After that the app works with no connection.

## Backup and restore

Your data exists only on the device. If you clear Safari's website data, delete the app, or change phones, it is gone. Back up regularly. The app reminds you after 14 days.

- **Back up** (Options): creates a dated file, for example `caseload-backup-2026-11-20.json`, and opens the share sheet. Save it to *Files* or iCloud Drive, or AirDrop it to a computer.
- **Restore…** (Options): choose a backup file. The app checks it, shows how many cases and entries it holds and how many are on this device now, then asks you to choose:
  - **Merge:** combines the file with what is here. Cases are matched by their internal ID (then by case ID as a fallback). For anything changed on both sides, the most recent change wins. Time you added on either device is kept. Cases or entries deleted on one device stay deleted unless they were changed after the delete. This is the right choice for moving work between a phone and a computer. It relies on both devices' clocks being roughly correct.
  - **Replace:** deletes what is on this device and uses the file exactly. Asks you to confirm first.
- A file that is not a valid backup is rejected without changing anything.
- If a backup or merge ends with more than 50 active cases, it is accepted. New cases cannot be added until you archive enough to get under 50, and the app shows the archive sheet when you try.

To use it on a computer too: open the site in a browser, back up on the phone, move the file across, and **Restore** with **Merge**. Each browser or installed app has its own separate data, so repeat the backup and restore whenever you want them to match.

## CSV columns

`Initials, Case Number, Total Time, Decimal Hours, Dates and Times, Case Due Date, Case Notes`

Each case appears once, ordered by its case ID (the case ID itself is not a column; `Initials` and `Case Number` are). `Total Time` is in words and `Decimal Hours` is the same total as a number (1.22 for 1 hour and 13 minutes) so it can be added up. `Dates and Times` lists each day in date order, for example `Nov 16, 2026: 45 min; Nov 18, 2026: 28 min`; a note on an entry follows its time in brackets. Cases with no time in the chosen range are left out. `Initials` holds the name as entered (`A.S` or `Jane D.`).

The file name looks like `caseload-week-2026-11-15.csv` (range plus the start date of that range).

## How it is built

- **Preact** for the screens, **Vite** to build, **vite-plugin-pwa** (Workbox) for the offline cache and updates, **Vitest** with Testing Library for tests. Only Preact runs on the phone; the rest is build-time.
- The rules that matter live in plain, framework-free JavaScript with their own tests, so they can be trusted and reused whatever the screens are built with.

```
index.html, vite.config.js, public/       manifest, icons (copied as is)
js/                  rules and data, no framework
  dates.js           week (Sun/Mon start), month, school year, month grid
  model.js           names, validation, totals, the 50-case rule
  csv.js, backup.js, merge.js, calendar.js, tutorials.js, router.js, format.js, env.js
  db.js              IndexedDB wrapper (the only place that touches it)
  store.js           data API with an in-memory snapshot
  swipe.js           swipe-to-reveal gesture
src/                 the screens
  main.jsx, App.jsx
  pages/             list, case, calendar, options, archived
  components/        forms, sheets, banners, swipe row
  context/, hooks/   shared state, dialogs, toasts, sharing, tutorials
  lib/deliverFile.js hands a file to the iOS share sheet
tests/               unit and component tests
scripts/make-icons.mjs
```

```bash
npm test             # all tests
node scripts/make-icons.mjs   # regenerate the icons
```

The tests cover the date ranges, name normalization, CSV escaping, validation, the 50-case rule, merge, backup validation, the data store (against an in-memory database), the share-sheet hand-off, routing and swipe maths, and whole-app flows (creating cases, the archive sheet, entries, export), plus guards that no code can make a network request and that the page carries its Content-Security-Policy.
