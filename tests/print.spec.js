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

async function gotoView(page, view) {
  // Reset to screen media first: emulateMedia persists across navigations,
  // and a stale 'print' emulation would hide the (no-print) view buttons
  // we're about to click on the freshly loaded page.
  await page.emulateMedia({ media: 'screen' });
  await page.goto(APP_URL);
  await page.click(`button[data-view="${view}"]`);
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

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
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
    await page.click('button[data-view="day"]');
    await page.click('#printBtn');
    await page.click('#dayPrintGoBtn');
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
