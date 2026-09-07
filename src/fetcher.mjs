import { parseHornbachApolloState } from './parser.mjs';
import { getBrowser, createOptimizedPage, waitForWindowProperty } from './browser-pool.mjs';

/**
 * Normalisiert eine SKU, EAN oder URL auf eine aufrufbare HORNBACH-URL.
 *
 * @param {string} urlOrSku
 * @returns {string}
 */
export function buildHornbachUrl(urlOrSku) {
  const trimmed = urlOrSku.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  // Reine Ziffern (SKU oder EAN-13)
  const cleanNum = trimmed.replace(/[^\d]/g, '');
  if (!cleanNum) {
    throw new Error(`Ungültige URL, SKU oder EAN: "${urlOrSku}"`);
  }
  return `https://www.hornbach.de/s/${cleanNum}`;
}

/**
 * Ruft eine HORNBACH-Produktseite über den Browser-Pool ab.
 * Dank Browser-Wiederverwendung und Tracking-Blockierung in ~1.5 bis 3 Sekunden.
 *
 * @param {Object} params
 * @param {string} params.urlOrSku - Hornbach-URL, Artikelnummer oder EAN
 * @param {string} [params.storeId] - Optionale Filial-ID
 * @param {boolean} [params.headless=false]
 * @param {number} [params.timeoutMs=30000]
 * @returns {Promise<import('./parser.mjs').HornbachArticle>}
 */
export async function fetchHornbachArticle({
  urlOrSku,
  storeId = null,
  headless = false,
  timeoutMs = 30000,
}) {
  const targetUrl = buildHornbachUrl(urlOrSku);
  const browser = await getBrowser(headless);
  const { ctx, page } = await createOptimizedPage(browser, storeId);

  try {
    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    } catch (err) {
      if (!err.message.includes('ERR_ABORTED')) {
        throw err;
      }
    }

    // Polling auf Apollo-State (da SSR, meist in < 500 ms da)
    const apolloState = await waitForWindowProperty(page, '__ARTICLE_DETAIL_APOLLO_STATE__', 8000);

    const currentUrl = page.url();

    if (!apolloState) {
      throw new Error(
        `Apollo-State konnte nicht extrahiert werden (Seite blockiert oder noch in Challenge? URL: ${currentUrl})`
      );
    }

    return parseHornbachApolloState(apolloState, currentUrl);
  } finally {
    await ctx.close();
  }
}
