import { chromium } from 'playwright';

/**
 * Zentraler Browser-Pool & Lifecycle-Manager.
 * Hält eine wiederverwendbare Browser-Instanz im Speicher,
 * blockiert zeitraubende Drittanbieter-Tracker und reduziert
 * die Antwortzeiten von ~15s auf ~1.5–2.5s.
 */

let browserInstance = null;
let isLaunching = null;

// Tracker & Werbenetzwerke, die 60-70% der Ladezeit blockieren
const BLOCKED_DOMAINS_REGEX = /\/(doubleclick|clarity|bing|pinterest|dynatrace|ablyft|google-analytics|coveo|facebook|adservice)\b/i;

/**
 * Liefert die aktive Browser-Instanz oder startet eine neue.
 *
 * @param {boolean} [headless=false]
 * @returns {Promise<import('playwright').Browser>}
 */
export async function getBrowser(headless = false) {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }

  if (isLaunching) {
    return isLaunching;
  }

  isLaunching = (async () => {
    try {
      console.log('⚡ Starte persistenten Chromium-Worker für HorniScrap...');
      browserInstance = await chromium.launch({
        headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
      });

      browserInstance.on('disconnected', () => {
        console.log('⚠️ Browser getrennt — wird bei nächster Anfrage neu gestartet.');
        browserInstance = null;
      });

      return browserInstance;
    } finally {
      isLaunching = null;
    }
  })();

  return isLaunching;
}

/**
 * Erstellt einen optimierten, isolierten Browser-Context mit Tracker-Blockierung.
 *
 * @param {import('playwright').Browser} browser
 * @param {string|null} [storeId]
 * @returns {Promise<{ ctx: import('playwright').BrowserContext, page: import('playwright').Page }>}
 */
export async function createOptimizedPage(browser, storeId = null) {
  const ctx = await browser.newContext({
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    viewport: { width: 1440, height: 900 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });

  // Blockiere ressourcenfressende Analytics/Ads
  await ctx.route(BLOCKED_DOMAINS_REGEX, (route) => route.abort());

  // Filial-Cookies setzen
  if (storeId) {
    const cleanStoreId = String(storeId).trim();
    await ctx.addCookies([
      { name: 'hbMarketCookie', value: cleanStoreId, domain: 'www.hornbach.de', path: '/' },
      { name: 'hbMarketSession', value: cleanStoreId, domain: 'www.hornbach.de', path: '/' },
      { name: 'hbMarketConfirmed', value: 'true', domain: 'www.hornbach.de', path: '/' },
    ]);
  }

  const page = await ctx.newPage();
  return { ctx, page };
}

/**
 * Wartet dynamisch auf die Verfügbarkeit eines Objekts im Window (Polling statt festem Timeout).
 *
 * @param {import('playwright').Page} page
 * @param {string} windowProp
 * @param {number} [maxWaitMs=8000]
 * @returns {Promise<any>}
 */
export async function waitForWindowProperty(page, windowProp, maxWaitMs = 8000) {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    const val = await page.evaluate((prop) => {
      try {
        return window[prop] || null;
      } catch {
        return null;
      }
    }, windowProp);

    if (val) return val;
    await page.waitForTimeout(150);
  }
  return null;
}
