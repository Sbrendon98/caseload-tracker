# Caseload Tracker: Design Spec

Date: 2026-11-20. Status: draft, awaiting review.

## 1. Purpose
A local-first PWA for a school psychologist to log time per student case, used mostly on an iPhone installed via Safari "Add to Home Screen". Hosted on GitHub Pages. Student data is limited to initials plus case number. No data leaves the device except through her own manual export or backup.

## 2. Constraints
- Plain HTML, CSS and vanilla JS (ES modules). No framework, build step, backend, CDN, analytics or network requests.
- Data in IndexedDB (not localStorage). `navigator.storage.persist()` requested on first launch. All storage access wrapped in try/catch with a clear on-screen error.
- Mobile-first, safe-area insets respected, light/dark via `prefers-color-scheme`.
- Hosted as a project site (`https://<user>.github.io/<repo>/`), so all paths are relative and the service worker scope is `./`.
- Process: Uncle Bob style. TDD (red, green, refactor), small single-purpose functions, clean boundaries. Pure logic gets tests before the UI that uses it. Tests are a dependency-free Node script, `node tests/run.mjs`, importing the same modules the app uses.

## 3. Data model
Case: `id` (UUID), `initials`, `caseNumber`, `displayId`, `createdAt`, `dueDate?`, `archived`, `archivedAt?`, `entries[]`.
Entry: `id` (UUID), `date` (YYYY-MM-DD local), `minutes` (total, > 0), `note?`, `createdAt`.
- Initials are normalized by stripping non-letters, uppercasing and joining with ".". "as" and "A S" both become "A.S". Input with no letters is rejected.
- `caseNumber` is trimmed and alphanumeric. `displayId = ${initials}-${caseNumber}`.
- Uniqueness is on the uppercased `displayId` across active and archived cases. It is enforced in `model.isDuplicate` and again by a unique IndexedDB index (`displayIdKey`).
- Input is hours plus minutes (minutes 0 to 59). Stored as total minutes, which must be > 0.

## 4. Modules (`js/`)
Pure, no DOM, tested first:
- `dates.js`: `todayLocal`, `weekRange` (Sun to Sat), `monthRange`, `schoolYearRange` (Jul 1 to Jun 30), `monthGrid(year, month)` (Sunday-first).
- `model.js`: `normalizeInitials`, `makeDisplayId`, `validateCase`, `validateEntry`, `isDuplicate`, `totalMinutes`, `formatDuration` ("Xh Ym"), `activeCount`, `canAddActive`.
- `csv.js`: `escapeField`, `buildCsv` (UTF-8 BOM, columns Case ID, Initials, Case Number, Entry Date, Hours, Minutes, Total Minutes, Decimal Hours, Note, Case Due Date, Archived), `exportFilename` (`caseload-week-2026-11-16.csv`).
- `calendar.js`: `entriesByDay(cases, {caseId?})`, `dayDots`, `casesForDay(cases, date, {caseId?})` giving per-case minutes plus the day total.
- `backup.js`: `buildBackup(cases)`, `validateBackup(json)` returning `{ok, summary:{cases, entries, activeCases}, errors, warnings}`.

Impure:
- `db.js`: IndexedDB wrapper. Throws a typed `StorageError` on any failure.
- `store.js`: the app's data API. It keeps an in-memory snapshot of all cases (loaded at startup and updated on every successful write) and emits a change event. Reads are synchronous from the snapshot. Writes go to `db.js` first, then update the snapshot. It enforces the rules in sections 3 and 5.
- `swipe.js`: pointer-events gesture.
- `tutorials.js`: topics plus seen flags.
- `ui/`: `router.js`, `modal.js`, `views/*`.
- `app.js`: bootstrap. `sw.js` at the project root.

## 5. The 50-active-case limit
`canAddActive(cases)` is the single gate. Every path that creates an active case goes through it:
1. **New case** at 50 active opens the archive modal ("Archive completed cases", with the limit explanation).
2. **Unarchive** at 50 active opens the same modal. When she is under 50, the unarchive completes automatically.
3. **Restore** accepts a backup with more than 50 active cases. The restore summary shows a warning. After restore, New case and Unarchive are blocked, using the same modal, until she is under 50. Rejecting the backup was considered and refused, because it risks losing legitimate data.

The modal lists active cases oldest added first, with the swipe row and the "⋯" menu fallback. A pending action (new case or unarchive) is held in memory and resumes once the count is under 50, so she never re-enters the form. Model tests cover all three paths.

## 6. Storage
- `cases` object store (keyPath `id`, entries embedded, unique index `displayIdKey`).
- `meta` store for tutorial-seen flags and the persist-requested flag.
- Restore replaces everything in one transaction, so a failed restore leaves the current data untouched.

## 7. Screens and routes
Hash router: `#/` list, `#/archived`, `#/case/:id`, `#/calendar?case=:id`, `#/options`.
- **List:** active cases, newest first. Each row shows displayId, due date and total. Includes search by displayId and "+ New case". Swipe left reveals Archive, with a "⋯" menu fallback. Archived cases have their own view with Unarchive.
- **Case detail:** displayId, editable due date, total, and an "Add time" form (date defaulting to today, hours, minutes, note). Entries are listed newest first, with edit and delete (confirm). Case edit (same uniqueness check) and delete (confirm, warns that entries are deleted too). "View in calendar" deep-links the calendar filtered to this case.
- **Calendar:** Sunday-first month grid with prev and next. A dot marks any day with work. Tapping a day opens a sheet listing the cases worked that day, with minutes per case and a day total. Tapping a case opens its detail. A case-filter picker narrows the grid. Archived cases are included and marked.
- **Options:** Export CSV (range selector: Week default, Month, School year, All), Backup, Restore, the backup reminder, and Tutorials.

## 8. Export, backup and restore on iOS
- CSV: filtered by entry date, including archived cases, one row per entry, properly escaped, with a UTF-8 BOM.
- Backup: dated JSON of all data. Restore validates structure, shows the summary (cases, entries, warnings) and requires confirmation before replacing data.
- **Share rule (iOS user activation):** `navigator.share()` needs transient user activation, and an `await` before it can lose it in WebKit. All data is read synchronously from the `store` snapshot. The Blob and `File` are built synchronously inside the click handler, `canShare({files})` is checked, and `share()` is called in that same synchronous turn, with nothing awaited before it.
- `AbortError` (she dismissed the share sheet) is a cancel, never an error.
- **Fallback when `canShare` is false:** in a normal browser tab, use a Blob plus `<a download>`. `<a download>` is unreliable in a standalone iOS PWA, so in standalone mode show a full-screen preview with "Copy" and an "Open file" link (Blob URL). This fallback is untested on a real device from the build machine and needs a real-iPhone check.

## 9. Tutorials
One-time popups, each shown the first time its context is reached: Welcome, Add a case, Log time, Archive and swipe, Calendar, Export and backup. "Seen" flags live in the `meta` store. Options > Tutorials replays any topic and has "Reset all".

## 10. PWA and offline
- `manifest.webmanifest`, an SVG icon source plus PNG 180/192/512 and `apple-touch-icon`, generated by a built-in-modules-only Node script.
- `sw.js` precaches the app shell in `caseload-v<N>`, serves cache-first, and deletes old caches on `activate`. A new worker waits. The app shows "Update available, tap to reload", which posts `skipWaiting`.
- Bumping `VERSION` is manual (documented in the README). A test verifies that every precached path exists.

## 11. Increments (each red, green, refactor, then shippable)
1. `dates`, `model` and `csv`, with tests.
2. `calendar` and `backup`, with tests, including the 50-limit paths.
3. `db` and `store`.
4. List, new case, detail and entries.
5. Limit modal and swipe.
6. Calendar view.
7. Export, backup and restore.
8. PWA shell, icons and service worker.
9. Tutorials, options screen and README (what it does, GitHub Pages steps, iPhone install, backup and restore).

## 12. Assumptions
- Project-site hosting under a repo subpath.
- Case-number uniqueness is case-insensitive. Initials with no letters are rejected.
- Calendar dates are local `YYYY-MM-DD` strings, with no timezone math.
- iOS behaviour is verified on a real device by the user, since it can't be tested from the build machine.
