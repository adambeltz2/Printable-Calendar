# Printable Calendar

A free, single-page web app for building printable calendars — by month, week, or year — with your own events, family tags, and a built-in weekly meal plan row. No sign-up, no server, no ads. Everything lives in your own browser.

**Live app:** https://adambeltz2.github.io/Printable-Calendar/

## Features

- **Month, Week, and Year views**, each laid out for a clean landscape print on standard 8.5×11" paper with minimal margins.
- **One-click printing** — hit Print and the toolbar/menus disappear, leaving just the calendar page.
- **Click any date to add an event.** Events can repeat every year (birthdays, anniversaries) or every week on the same day (practice, chores, trash day).
- **Family members with symbols, not colors** — assign each family member a simple black-and-white symbol so you can tell at a glance who's got what, even on a black-and-white printout.
- **US holidays**, calculated automatically for any year, toggle on/off.
- **Weekly meal plan row** in Week view — click to jot down dinner plans for each day.
- **Ink-saver mode** — a toggle that strips background tints for a lighter, more ink-friendly printout.
- **Sunday or Monday week start**, your choice.
- **Add several events at once** — type into a simple spreadsheet-style grid, or paste rows copied straight from Excel/Google Sheets.
- **Import from CSV** — bring in a list of birthdays or events from a spreadsheet, with a downloadable example file showing the format.
- **Full backup/restore** — download everything (events, family members, meal plans) as a single file, and restore it later or on another device.

All data is stored locally in your browser (`localStorage`). Nothing is sent to a server, and nothing syncs between devices automatically — use the backup file if you want to move your data somewhere else.

## Using it

1. Open the [live app](https://adambeltz2.github.io/Printable-Calendar/).
2. Pick Month, Week, or Year at the top.
3. Click any date to add an event, or use the **Events…** menu to add several at once, import a CSV, or manage a backup.
4. Use **👪 Family** to add family members and give each one a symbol.
5. Hit **🖨 Print** when you're ready — the app is already sized for landscape Letter paper.

## Running it locally / deploying your own copy

This is a single static HTML file with no build step and no dependencies beyond two Google Fonts loaded from a CDN.

1. Fork or clone this repo.
2. To run locally, just open `index.html` in a browser.
3. To deploy on GitHub Pages: **Settings → Pages → Deploy from a branch**, pick `main` and the root folder, save. Your copy will be live at `https://<your-username>.github.io/<repo-name>/`.

## Feedback

Found a bug or have a feature idea? Open an issue on this repo.

If you find this useful, you can [buy me a coffee](https://www.buymeacoffee.com/adambeltz) ☕ — totally optional, always appreciated.
