import { chromium } from 'playwright';
import { parseHornbachApolloState } from './parser.mjs';

/**
 * Normalisiert eine SKU oder URL auf eine aufrufbare HORNBACH-URL.
 *
 * @param {string} urlOrSku
 * @returns {string}
 */
export function buildHornbachUrl(urlOrSku) {
  const trimmed = urlOrSku.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  // Nur Ziffern / SKU
  const cleanSku = trimmed.replace(/[^\d]/g, '');
  if (!cleanSku) {
    throw new Error(`Ungültige URL oder SKU: "${urlOrSku}"`);
  }
  return `https://www.hornbach.de/s/${cleanSku}`;
}

/**
 * Ruft eine HORNBACH-Produktseite über Playwright ab und extrahiert die Artikel- und Bestandsdaten.
 *
 * @param {Object} params
 * @param {string} params.urlOrSku - Hornbach-URL oder reine Artikelnummer (z. B. "6072187")
 * @param {string} [params.storeId] - Optionale Filial-ID (z. B. "609" für Berlin-Mariendorf, "616" für Berlin-Neukölln)
 * @param {boolean} [params.headless=false] - Headless-Modus (true wird oft von Bot-Defense geblockt)
 * @param {number} [params.timeoutMs=60000] - Timeout für den Seitenabruf
 * @param {number} [params.waitAfterLoadMs=12000] - Wartezeit nach DOMContentLoaded für Challenge-Lösung & Apollo-Hydration
 * @param {import('playwright').Browser} [params.existingBrowser] - Optionaler bereits geöffneter Browser zur Wiederverwendung
 * @returns {Promise<import('./parser.mjs').HornbachArticle>}
 */
export function fetchHornbachArticle(params) {
  return _fetchHornbachArticleInternal(params);
}

async function _fetchHornbachArticleInternal({
  urlOrSku,
  storeId = null,
  headless = false,
  timeoutMs = 60000,
  waitAfterLoadMs = 12000,
  existingBrowser = null,
}) {
  const targetUrl = buildHornbachUrl(urlOrSku);
  const ownBrowser = !existingBrowser;
  const browser = existingBrowser || (await chromium.launch({ headless }));

  try {
    const ctx = await browser.newContext({
      locale: 'de-DE',
      timezoneId: 'Europe/Berlin',
      viewport: { width: 1440, height: 900 },
    });

    // Filial-Cookies setzen, falls storeId vorgegeben
    if (storeId) {
      const cleanStoreId = String(storeId).trim();
      await ctx.addCookies([
        {
          name: 'hbMarketCookie',
          value: cleanStoreId,
          domain: 'www.hornbach.de',
          path: '/',
        },
        {
          name: 'hbMarketSession',
          value: cleanStoreId,
          domain: 'www.hornbach.de',
          path: '/',
        },
        {
          name: 'hbMarketConfirmed',
          value: 'true',
          domain: 'www.hornbach.de',
          path: '/',
        },
      ]);
    }

    const page = await ctx.newPage();
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForTimeout(waitAfterLoadMs);

    // Apollo-State aus dem DOM extrahieren
    const apolloState = await page.evaluate(() => {
      try {
        return window.__ARTICLE_DETAIL_APOLLO_STATE__ || null;
      } catch {
        return null;
      }
    });

    const currentUrl = page.url();
    await ctx.close();

    if (!apolloState) {
      throw new Error(
        `Apollo-State konnte nicht extrahiert werden (Seite blockiert oder noch in Challenge? URL: ${currentUrl})`
      );
    }

    return parseHornbachApolloState(apolloState, currentUrl);
  } finally {
    if (ownBrowser) {
      await browser.close();
    }
  }
}
