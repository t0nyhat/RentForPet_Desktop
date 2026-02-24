const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app, BrowserWindow } = require('electron');

const BASE_URL = process.env.CAPTURE_BASE_URL || 'http://localhost:5173/admin';
const LOCALE = process.env.CAPTURE_LOCALE === 'en' ? 'en' : 'ru';
const OUTPUT_DIR = path.resolve(process.cwd(), `docs/assets/${LOCALE}`);

const LABELS = {
  ru: {
    schedule: 'Расписание',
    allBookings: 'Все бронирования',
    manual: 'Создать вручную',
    history: 'История платежей',
    clients: 'Клиенты',
    roomTypes: 'Типы номеров',
    rooms: 'Номера',
    availableRooms: 'Свободные номера',
    bookingSettings: 'Настройки бронирования',
    detailsButtons: ['Подробнее', 'Детали'],
  },
  en: {
    schedule: ['Schedule', 'Расписание'],
    allBookings: ['All Bookings', 'Все бронирования'],
    manual: ['Create Manual Booking', 'Создать вручную'],
    history: ['Payment History', 'История платежей'],
    clients: ['Clients', 'Клиенты'],
    roomTypes: ['Room Types', 'Типы номеров'],
    rooms: ['Rooms', 'Номера'],
    availableRooms: ['Available Rooms', 'Свободные номера'],
    bookingSettings: ['Booking Settings', 'Настройки бронирования'],
    detailsButtons: ['View Details', 'Details', 'Подробнее', 'Детали'],
  },
};

const SIZE = {
  width: 2940,
  height: 1654,
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getFrameHash(win) {
  const image = await win.webContents.capturePage();
  return crypto.createHash('sha256').update(image.toPNG()).digest('hex');
}

async function clickByText(win, text) {
  const escaped = text.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return win.webContents.executeJavaScript(`(() => {
    const normalize = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const target = normalize('${escaped}');
    const candidates = Array.from(document.querySelectorAll('button,a,[role="button"],div,span'));

    const isVisible = (el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    };

    for (const el of candidates) {
      if (!isVisible(el)) continue;
      const text = normalize(el.textContent);
      if (text === target || text.includes(target)) {
        el.scrollIntoView({ behavior: 'instant', block: 'center' });
        el.click();
        return true;
      }
    }

    return false;
  })();`, true);
}

async function clickSidebarItem(win, label) {
  const escaped = label.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return win.webContents.executeJavaScript(`(() => {
    const normalize = (s) => (s || '').replace(/\\s+/g, ' ').trim();
    const target = normalize('${escaped}');
    const nav = document.querySelector('aside nav');
    if (!nav) return false;

    const isVisible = (el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    };

    const candidates = Array.from(nav.querySelectorAll('a,button'));
    for (const el of candidates) {
      if (!isVisible(el)) continue;
      const txt = normalize(el.textContent);
      if (txt === target || txt.includes(target)) {
        el.scrollIntoView({ behavior: 'instant', block: 'center' });
        el.click();
        return true;
      }
    }
    return false;
  })();`, true);
}

async function clickFirstMatching(win, texts) {
  for (const text of texts) {
    const ok = await clickByText(win, text);
    if (ok) return true;
  }
  return false;
}

async function clickAnyLabel(win, labelOrLabels) {
  const labels = Array.isArray(labelOrLabels) ? labelOrLabels : [labelOrLabels];
  for (const label of labels) {
    let clicked = await clickSidebarItem(win, label);
    if (!clicked) clicked = await clickByText(win, label);
    if (clicked) return true;
  }
  return false;
}

async function saveCapture(win, fileName) {
  const image = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUTPUT_DIR, fileName), image.toPNG());
  console.log(`[capture] ${fileName}`);
}

async function ensureLocale(win, locale) {
  await win.webContents.executeJavaScript(`localStorage.setItem('i18nextLng', '${locale}');`, true);
}

async function captureTab(win, tabText, fileName, waitMs = 1400, requireChange = true) {
  const before = await getFrameHash(win);
  if (tabText) {
    let clicked = await clickAnyLabel(win, tabText);
    if (!clicked) {
      throw new Error(`[capture] Cannot click tab '${tabText}'`);
    }
    await delay(waitMs);

    const after = await getFrameHash(win);
    if (requireChange && after === before) {
      // Retry once if state did not change.
      await delay(500);
      let retry = await clickAnyLabel(win, tabText);
      if (!retry) {
        throw new Error(`[capture] Retry cannot click tab '${tabText}'`);
      }
      await delay(waitMs);
      const afterRetry = await getFrameHash(win);
      if (afterRetry === before) {
        throw new Error(`[capture] Tab did not change after retry: '${tabText}'`);
      }
    }
  }
  await saveCapture(win, fileName);
}

async function run() {
  const labels = LABELS[LOCALE];
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const win = new BrowserWindow({
    width: SIZE.width,
    height: SIZE.height,
    show: false,
    backgroundColor: '#ffffff',
    webPreferences: {
      devTools: false,
      spellcheck: false,
    },
  });

  try {
    await win.loadURL(BASE_URL);
    await delay(2500);

    await ensureLocale(win, LOCALE);
    await win.loadURL(BASE_URL);
    await delay(2500);

    // Main screens
    await captureTab(win, null, '01-admin-navigation.png');
    await captureTab(win, labels.schedule, '02-schedule.png');
    await captureTab(win, labels.allBookings, '03-bookings-table.png');
    await captureTab(win, labels.manual, '04-manual-booking.png', 1800);
    await captureTab(win, labels.history, '05-payments-history.png', 1800);

    // Try to open booking details for payment operations screenshot
    await clickAnyLabel(win, labels.allBookings);
    await delay(1200);
    await clickFirstMatching(win, labels.detailsButtons);
    await delay(1000);
    await saveCapture(win, '06-booking-payments.png');

    await captureTab(win, labels.clients, '07-clients.png', 1600);
    await captureTab(win, labels.roomTypes, '08-room-types.png', 1600);
    await captureTab(win, labels.rooms, '09-rooms.png', 1600);
    await captureTab(win, labels.availableRooms, '10-available-rooms.png', 1600);
    await captureTab(win, labels.bookingSettings, '11-booking-settings.png', 1600);

    // Export + backup screen (buttons are in Schedule)
    await captureTab(win, labels.schedule, '12-export-backup.png', 1600);

    // Workflow images (real captures; some are contextual duplicates of key screens)
    await captureTab(win, labels.manual, 'wf-01-new-booking.png', 1600);

    await captureTab(win, labels.allBookings, 'wf-02-check-in.png', 1200);
    await captureTab(win, labels.allBookings, 'wf-03-check-out.png', 1200, false);

    await captureTab(win, labels.roomTypes, 'wf-04-rooms-setup.png', 1200);
    await captureTab(win, labels.schedule, 'wf-05-backup.png', 1200);
    await captureTab(win, labels.schedule, 'wf-06-drag-booking-bar.png', 1200, false);

    await captureTab(win, labels.manual, 'wf-07-composite-booking.png', 1200);

    await captureTab(win, labels.allBookings, 'wf-08-transfer-payment.png', 1200);
    await clickFirstMatching(win, labels.detailsButtons);
    await delay(1000);
    await saveCapture(win, 'wf-09-refund-payment.png');

    console.log('[capture] Done');
  } finally {
    win.destroy();
    app.quit();
  }
}

app.whenReady().then(run).catch((error) => {
  console.error('[capture] Failed:', error);
  app.quit();
  process.exit(1);
});
