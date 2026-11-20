# Caseload Tracker

A small, private time log for a school psychologist. Log the time you spend on each student case, see it on a calendar, and export it to CSV. It runs in the browser, works offline, and installs to an iPhone Home Screen like an app.

**Privacy:** there is no server. Cases are identified by **initials plus a case number only** (never a full name). Everything is stored on the device in the browser's database. Nothing is sent anywhere. The only way data leaves is when you tap *Export CSV* or *Back up* and choose where to send the file. The code makes no network requests, and a test enforces that.

## What it does

- **Cases:** add a case with initials (`a s` becomes `A.S`; up to 4 letters, anything longer is rejected so a name can't be entered by accident), a case number, an optional due date and optional notes. The ID (for example `A.S-122445543`) must be unique across active and archived cases. The app cannot tell a short name (a 4-letter first name, say) from initials, so that part is up to you.
- **Time entries:** add time with a date, hours and minutes, and an optional note. Quick buttons (15 min, 30 min, 45 min, 1 hr, 1.5 hr) and a start/stop timer make it fast. Entries can be edited or deleted.
- **Due dates:** cases that are overdue or due within a week get a badge.
- **Archiving and the 50-case limit:** up to 50 active cases. Swipe a case left to archive it (or tap the ⋯ button). When you add a 51st case, a sheet lists your oldest cases so you can archive finished ones, then your new case is created for you.
- **Calendar:** a dot on every day you logged time. Tap a day to see every case you worked on that day. Filter to one student, or tap *View in calendar* on a case.
- **Export CSV:** Week, Month, School year (July 1 to June 30) or All. One row per time entry, archived cases included, with case notes. Opens correctly in Excel and Numbers.
- **Backup and restore:** save everything to a JSON file and bring it back, on the same phone or another device.
- **Tutorials:** short pop-ups appear once, the first time each feature is used. Replay any of them from Options > Tutorials.
- **Works offline** after the first load.

### Settings and assumptions

- Weeks run **Sunday to Saturday** by default (Options > Week starts on lets you choose Monday). This affects the calendar, the "This week" total, and the Week export.
- Dates are the device's local calendar dates.
- One entry can be at most 24 hours.
- A cell in the CSV that starts with `=`, `+`, `@` (or `-` followed by a non-space) is prefixed with `'` so a spreadsheet does not run it as a formula.

## Deploy to GitHub Pages

The site is plain static files, so there is nothing to build.

1. **Push the code** to GitHub:
   ```bash
   git push -u origin main
   ```
2. In the repository on github.com, open **Settings > Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**. Choose branch **main** and folder **/ (root)**, then **Save**.
4. Wait a minute or two. The page shows the address, which looks like:
   `https://<your-username>.github.io/<repository-name>/`
   For this repository: `https://sbrendon98.github.io/caseload-tracker/`
5. Open that address in a browser to check it loads. HTTPS is automatic, and the service worker needs it.

Notes:
- A free GitHub account can publish Pages only from a **public** repository. The repository contains no student data (data lives only on each device), so public is fine.
- The empty `.nojekyll` file in the repository root tells GitHub Pages to serve every file as it is. Keep it.
- All file paths in the app are relative, so it works from the `/<repository-name>/` sub-path.

### Publishing an update

The service worker caches the app so it works offline. To make phones pick up a new version:

1. Edit `VERSION` at the top of `sw.js` (for example `'v1'` to `'v2'`). **Do this on every deploy**, otherwise installed copies keep the old files.
2. Commit and push. Pages republishes within a minute or two.
3. On the phone, open the app. When the new version has downloaded, a banner says **A new version is ready**. Tap **Update**. Her data is not touched.

While developing locally, the old service worker can serve stale files. In the browser's developer tools, use Application > Service Workers > *Update on reload*, or unregister it.

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

`Case ID, Initials, Case Number, Entry Date, Hours, Minutes, Total Minutes, Decimal Hours, Note, Case Due Date, Archived, Case Notes`

The file name looks like `caseload-week-2026-11-15.csv` (range plus the start date of that range).

## Project layout

```
index.html, styles.css, manifest.webmanifest, sw.js
js/dates.js        pure: week (Sun/Mon start), month, school year, month grid
js/model.js        pure: initials, validation, totals, the 50-case rule
js/csv.js          pure: CSV building and escaping
js/calendar.js     pure: grouping entries by day
js/backup.js       pure: backup format, validation, nudge rules
js/merge.js        pure: two-way merge
js/tutorials.js    pure: tutorial content and "seen once" rule
js/db.js           IndexedDB wrapper (the only place that touches it)
js/store.js        data API with an in-memory snapshot
js/swipe.js        swipe-to-reveal gesture
js/ui/             views, forms, sheets, sharing, tutorials
icons/             generated by scripts/make-icons.mjs
tests/             unit tests (no dependencies)
```

## Development

```bash
node tests/run.mjs                 # run the unit tests (Node 18+, no installs)
python3 -m http.server 8000        # then open http://localhost:8000
node scripts/make-icons.mjs        # regenerate the icons
```

The tests cover the date ranges, initials normalization, CSV escaping, validation, the 50-case rule, merge, backup validation, the data store (against an in-memory database), routing and swipe maths, and a guard that every app file is in the service worker's cache list and that no code can make network requests.
