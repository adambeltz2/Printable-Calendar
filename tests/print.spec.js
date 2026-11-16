// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const APP_URL = 'file://' + path.resolve(__dirname, '..', 'index.html');

// Printing is the whole point of this app, so these tests render each view
// under @media print (not the normal screen layout) and check the things a
// person would notice on paper: the page is fully used, nothing overflows
// or gets cut into an extra blank page, grid lines are dark enough to see,
// and the old promotional footer text stays gone.

/** Relative luminance (0 = black, 1 = white) from an "rgb(r, g, b)" string. */
function luminance(rgbString) {
  const m = rgbString.match(/\d+/g);
  if (!m) return 1;
  const [r, g, b] = m.map(Number);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// The printed page is sized in fixed inches inside the @page box (NOT vw/vh:
// viewport units resolved against the wrong box in Chrome's real print
// preview and pushed a month's last row onto a 2nd sheet). The test
// viewports below are the actual @page content boxes at 96 CSS px/inch:
// landscape Letter 11x8.5in with 0.25in margins => 10.5x8in, portrait Letter
// 8.5x11in with 0.3in margins => 7.9x10.4in.
const LANDSCAPE_PAGE_PX = { width: 1008, height: 768 };
const PORTRAIT_PAGE_PX = { width: 758, height: 998 };

/**
 * Headless Chromium's window.print() returns instantly and fires `afterprint`
 * right away, which makes the app tear down its #printBatchContainer before a
 * test can inspect it (a real browser blocks on the print dialog first). Stub
 * print() so the batch markup stays in the DOM for the @media print checks.
 */
async function stubWindowPrint(page) {
  await page.evaluate(() => { window.print = () => {}; });
}

async function gotoView(page, view) {
  // Reset to screen media first: emulateMedia persists across navigations,
  // and a stale 'print' emulation would hide the (no-print) view buttons
  // we're about to click on the freshly loaded page.
  await page.emulateMedia({ media: 'screen' });
  await page.goto(APP_URL);
  await page.click(`button[data-view="${view}"]`);
  await page.setViewportSize(view === 'day' ? PORTRAIT_PAGE_PX : LANDSCAPE_PAGE_PX);
  await page.emulateMedia({ media: 'print' });
}

/** Reads the /MediaBox of the first page in a PDF's raw bytes, in points. */
function firstPageMediaBox(pdfBytes) {
  const text = pdfBytes.toString('latin1');
  const m = text.match(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/);
  if (!m) return null;
  const [, x0, y0, x1, y1] = m.map(Number);
  return { width: x1 - x0, height: y1 - y0 };
}

const VIEWS = ['day', 'week', 'month', 'year'];

for (const view of VIEWS) {
  test.describe(`${view} view — print output`, () => {
    test('calendar page fills the printable area with no overflow', async ({ page }) => {
      await gotoView(page, view);

      const box = await page.locator('#calendarPage').boundingBox();
      const viewport = page.viewportSize();
      expect(box).not.toBeNull();
      // The printed page should span (essentially) the full printable
      // width/height, not sit shrunk off to one side of the sheet.
      expect(box.width).toBeGreaterThan(viewport.width * 0.95);
      expect(box.height).toBeGreaterThan(viewport.height * 0.95);

      // Content must not push the page taller/wider than its own fixed
      // physical size — this is the check that catches a view's content
      // (e.g. a month grid's last row) spilling onto a near-empty extra
      // page, which an earlier width/height:100% layout let slip through
      // undetected here even when it happened on a real printer.
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
      }));
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
      expect(overflow.scrollHeight).toBeLessThanOrEqual(overflow.clientHeight + 1);
    });

    test('does not show the old promotional footer text', async ({ page }) => {
      await gotoView(page, view);
      const bodyText = await page.locator('#calendarPage').innerText();
      expect(bodyText).not.toMatch(/made with printable calendar/i);
      // The "make your own calendar" QR code is the intended replacement.
      await expect(page.locator('.footer-qr')).toBeVisible();
    });

    test('grid lines are dark enough to read once printed', async ({ page }) => {
      await gotoView(page, view);
      const colors = await page.evaluate(() => {
        const cs = getComputedStyle(document.documentElement);
        return {
          line: cs.getPropertyValue('--paper-line').trim(),
          lineStrong: cs.getPropertyValue('--paper-line-strong').trim(),
        };
      });
      // Resolve the CSS custom properties to actual rgb() via a probe element,
      // since getPropertyValue on :root returns the raw (possibly hex) value.
      const rgb = await page.evaluate(([line, lineStrong]) => {
        const probe = document.createElement('div');
        probe.style.color = line;
        document.body.appendChild(probe);
        const lineRgb = getComputedStyle(probe).color;
        probe.style.color = lineStrong;
        const strongRgb = getComputedStyle(probe).color;
        probe.remove();
        return { lineRgb, strongRgb };
      }, [colors.line, colors.lineStrong]);

      // Faint pastel grays (luminance close to 1) print as invisible;
      // require real contrast against a white page.
      expect(luminance(rgb.lineRgb)).toBeLessThan(0.75);
      expect(luminance(rgb.strongRgb)).toBeLessThan(0.65);
    });
  });
}

test.describe('day view — print via the "Print" button/modal', () => {
  // The modal builds a separate #printBatchContainer markup tree (not the
  // normal #calendarPage), which had its own bug: the container never got
  // an explicit height, so height:100% on the printed page had nothing to
  // resolve against and the page collapsed to its content's height instead
  // of the full sheet — leaving the footer/QR code stranded mid-page with
  // blank space below it.
  test('single-day batch page fills the sheet and pins the footer to the bottom', async ({ page }) => {
    await page.emulateMedia({ media: 'screen' });
    await page.goto(APP_URL);
    await stubWindowPrint(page);
    await page.click('button[data-view="day"]');
    await page.click('#printBtn');
    await page.click('#dayPrintGoBtn');
    await page.setViewportSize(PORTRAIT_PAGE_PX);
    await page.emulateMedia({ media: 'print' });

    const viewport = page.viewportSize();
    const batchPage = page.locator('.print-batch-page');
    const pageBox = await batchPage.boundingBox();
    expect(pageBox).not.toBeNull();
    expect(pageBox.height).toBeGreaterThan(viewport.height * 0.95);

    const footerBox = await batchPage.locator('.page-footer').boundingBox();
    expect(footerBox).not.toBeNull();
    // Bottom edge of the footer should sit at (essentially) the bottom of the page.
    expect(footerBox.y + footerBox.height).toBeGreaterThan(pageBox.y + pageBox.height - 5);

    const overflow = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    }));
    expect(overflow.scrollHeight).toBeLessThanOrEqual(overflow.clientHeight + 1);
  });
});

test.describe('day view — print via the "Print" button/modal, 2-per-page pairs', () => {
  test('a 4-day range at 2-per-page prints 2 pages that both fill the sheet', async ({ page }) => {
    await page.emulateMedia({ media: 'screen' });
    await page.goto(APP_URL);
    await stubWindowPrint(page);
    await page.click('button[data-view="day"]');
    await page.click('#printBtn');
    await page.click('input[name=dayPrintRange][value="range"]');
    await page.fill('#dayPrintStart', '2026-09-14');
    await page.fill('#dayPrintEnd', '2026-09-17'); // 4 days
    await page.click('input[name=dayPrintPerPage][value="2"]');
    await page.click('#dayPrintGoBtn');
    await page.setViewportSize(LANDSCAPE_PAGE_PX);
    await page.emulateMedia({ media: 'print' });

    const pairs = page.locator('.print-batch-pair');
    await expect(pairs).toHaveCount(2);

    const viewport = page.viewportSize();
    const count = await pairs.count();
    for (let i = 0; i < count; i++) {
      const pairBox = await pairs.nth(i).boundingBox();
      expect(pairBox.height).toBeGreaterThan(viewport.height * 0.95);
      const cols = pairs.nth(i).locator('.pair-col');
      await expect(cols).toHaveCount(2);
    }

    const overflow = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    }));
    // Both pages combined shouldn't push a single page's own box taller than
    // itself; page-break-after keeps them stacked, so total scrollHeight is
    // allowed to be ~2 pages tall, but each individual pair already got its
    // own height check above.
    expect(overflow.scrollHeight).toBeLessThanOrEqual(overflow.clientHeight * 2 + 2);
  });
});

test.describe('day view — print pagination', () => {
  test('a single day prints as exactly one page', async ({ page }) => {
    await gotoView(page, 'day');
    const pdfPath = test.info().outputPath('day.pdf');
    await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true });
    const bytes = fs.readFileSync(pdfPath);
    // Cheap page count: each page object looks like "/Type /Page" (and is
    // NOT immediately followed by another letter, which would make it
    // "/Type /Pages", the page-tree root).
    const text = bytes.toString('latin1');
    const pageCount = (text.match(/\/Type\s*\/Page(?![A-Za-z])/g) || []).length;
    expect(pageCount).toBe(1);
  });

  test('a single day prints portrait, other views print landscape', async ({ page }) => {
    await gotoView(page, 'day');
    const dayBytes = await page.pdf({ preferCSSPageSize: true });
    const dayBox = firstPageMediaBox(dayBytes);
    expect(dayBox).not.toBeNull();
    expect(dayBox.height).toBeGreaterThan(dayBox.width); // portrait

    await gotoView(page, 'week');
    const weekBytes = await page.pdf({ preferCSSPageSize: true });
    const weekBox = firstPageMediaBox(weekBytes);
    expect(weekBox).not.toBeNull();
    expect(weekBox.width).toBeGreaterThan(weekBox.height); // landscape
  });

  test('hour grid and sidebar sit side by side, not stacked', async ({ page }) => {
    await gotoView(page, 'day');
    const flexDirection = await page.locator('.day-layout').evaluate(
      (el) => getComputedStyle(el).flexDirection
    );
    expect(flexDirection).toBe('row');

    const hoursBox = await page.locator('.day-hours').boundingBox();
    const sidebarBox = await page.locator('.day-sidebar').boundingBox();
    expect(hoursBox).not.toBeNull();
    expect(sidebarBox).not.toBeNull();
    // Side by side means the sidebar starts at/after where the hours column ends.
    expect(sidebarBox.x).toBeGreaterThanOrEqual(hoursBox.x + hoursBox.width - 1);

    const hourRows = await page.locator('.hour-row').count();
    expect(hourRows).toBe(16); // 6 AM through 9 PM inclusive
  });
});

test.describe('month view — always exactly one sheet, whatever the window size', () => {
  // The bug this guards: a month printed fine in some environments but, in
  // Chrome's real print preview, a 5-row month's last row + footer landed on
  // a 2nd sheet, forcing users to fiddle with print settings. Every month
  // (4-, 5- and 6-row, Sunday and Monday start) must be one landscape sheet
  // regardless of the browser window the user happens to have open.
  const WINDOWS = [
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
    { width: 800, height: 1100 }, // tall/portrait-ish window
    { width: 390, height: 844 },  // phone
  ];

  for (const win of WINDOWS) {
    test(`all 24 months of 2026-2027 print on 1 landscape sheet at ${win.width}x${win.height}`, async ({ page }) => {
      await page.setViewportSize(win);
      await page.emulateMedia({ media: 'screen' });
      await page.goto(APP_URL);
      await page.click('button[data-view="month"]');
      for (const monday of [false, true]) {
        await page.evaluate((m) => {
          const t = document.getElementById('mondayStartToggle');
          if (t.checked !== m) t.click();
        }, monday);
        for (const year of [2026, 2027]) {
          for (let month = 0; month < 12; month++) {
            await page.emulateMedia({ media: 'screen' });
            await page.selectOption('#yearSelect', String(year));
            await page.selectOption('#monthSelect', String(month));
            await page.emulateMedia({ media: 'print' });
            const bytes = await page.pdf({ preferCSSPageSize: true, printBackground: true });
            const text = bytes.toString('latin1');
            const pages = (text.match(/\/Type\s*\/Page(?![A-Za-z])/g) || []).length;
            const box = firstPageMediaBox(bytes);
            expect(pages, `${year}-${month + 1} monday=${monday}`).toBe(1);
            expect(box.width).toBeGreaterThan(box.height);
          }
        }
      }
    });
  }

  test('footer/QR stays on the same sheet as a 5-row month (Nov 2026)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.emulateMedia({ media: 'screen' });
    await page.goto(APP_URL);
    await page.click('button[data-view="month"]');
    await page.selectOption('#yearSelect', '2026');
    await page.selectOption('#monthSelect', '10');
    await page.emulateMedia({ media: 'print' });
    const pageBox = await page.locator('#calendarPage').boundingBox();
    const footer = await page.locator('#calendarPage .footer-qr').boundingBox();
    const lastRow = await page.locator('#calendarPage .day-cell').last().boundingBox();
    expect(pageBox.height).toBeLessThanOrEqual(7.8 * 96 + 1); // never taller than one sheet
    expect(footer.y + footer.height).toBeLessThanOrEqual(pageBox.y + pageBox.height + 1);
    expect(lastRow.y + lastRow.height).toBeLessThanOrEqual(pageBox.y + pageBox.height + 1);
  });
});

test.describe('Rocketbook format toggle', () => {
  test('off by default, adds corner markers and a destination row when enabled', async ({ page }) => {
    await gotoView(page, 'month');
    await expect(page.locator('.rb-corner')).toHaveCount(0);
    await expect(page.locator('.rb-dest')).toHaveCount(0);

    await page.emulateMedia({ media: 'screen' });
    await page.click('#rocketbookToggle');
    await page.emulateMedia({ media: 'print' });

    await expect(page.locator('.rb-corner')).toHaveCount(4);
    await expect(page.locator('.rb-dest')).toHaveCount(7);

    // Enabling it shouldn't push the page past its own bounds.
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
    expect(overflow.scrollHeight).toBeLessThanOrEqual(overflow.clientHeight + 1);
  });
});
