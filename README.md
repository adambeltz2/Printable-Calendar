# Printable Calendar

A free, single-page web app for building printable calendars — by day, week, month, or year — with your own events, family tags, and a built-in weekly meal plan row. No sign-up, no server, no ads. Everything lives in your own browser.

**Live app:** https://adambeltz2.github.io/Printable-Calendar/

## Features

- **Day, Week, Month, and Year views**, each laid out for a clean landscape print on standard 8.5×11" paper with minimal margins.
- **Day view is a full hour-by-hour planner** — a 6 AM–9 PM lined schedule down one side, plus a sidebar with a top-priorities checklist, the day's dinner plan, and a blank notes area, all print-ready. Pick any date to print just that day.
- **One-click printing** — hit Print and the toolbar/menus disappear, leaving just the calendar page.
- **Click any date to add an event.** Events can repeat every year (birthdays, anniversaries) or every week on the same day (practice, chores, trash day).
- **Family members with initials, not colors** — add a family member and it automatically badges them with initials (one letter for a first name only, two for First Last) so you can tell at a glance who's got what, even on a black-and-white printout.
- **US holidays**, calculated automatically for any year, toggle on/off.
- **Weekly meal plan row** in Week and Day views — click to jot down dinner plans for each day.
- **Ink-saver mode** — a toggle that strips background tints for a lighter, more ink-friendly printout.
- **Sunday or Monday week start**, your choice.
- **Add several events at once** — type into a simple spreadsheet-style grid, or paste rows copied straight from Excel/Google Sheets.
- **CSV import/export** — export everything on the calendar to a CSV file (handy as a backup or to move data to another device/browser), or import a list of birthdays/events from a spreadsheet. A downloadable example file shows the format, and unrecognized names in the "who" column are added as new family members automatically.
- **QR code on every printed page** — scan it to jump straight to the live app and print your own copy. Generated entirely offline in the browser (via the bundled [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) library), no external service required.

All data is stored locally in your browser (`localStorage`). Nothing is sent to a server, and nothing syncs between devices automatically — export a CSV if you want to move your data somewhere else.

## Using it

1. Open the [live app](https://adambeltz2.github.io/Printable-Calendar/).
2. Pick Month, Week, or Year at the top.
3. Click any date to add an event, or use the **Events…** menu to add several at once, or import/export a CSV.
4. Use **👪 Family** to add family members — their initials badge is generated automatically from the name you type.
5. Hit **🖨 Print** when you're ready — the app is already sized for landscape Letter paper. Printing from a phone? Make sure Orientation is set to Landscape in the print dialog's options.

## Running it locally / deploying your own copy

This is a single static HTML file with no build step and no dependencies beyond two Google Fonts loaded from a CDN.

1. Fork or clone this repo.
2. To run locally, just open `index.html` in a browser.
3. To deploy on GitHub Pages: **Settings → Pages → Deploy from a branch**, pick `main` and the root folder, save. Your copy will be live at `https://<your-username>.github.io/<repo-name>/`.

## Feedback

Found a bug or have a feature idea? Open an issue on this repo.

If you find this useful, you can [buy me a coffee](https://www.buymeacoffee.com/adambeltz) ☕ — totally optional, always appreciated.
