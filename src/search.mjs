import { chromium } from 'playwright';
import { parseHornbachApolloState } from './parser.mjs';

/**
 * @typedef {Object} SearchResultItem
 * @property {string} sku
 * @property {string} title
 * @property {string} url
 * @property {string|null} brand
 * @property {number} price
 * @property {string} currency
 * @property {string} unit
 * @property {string|null} imageUrl
 * @property {{ averageRating: number, reviewCount: number }|null} rating
 * @property {boolean} canReserveInStore
 * @property {string|null} storeStatusText
 * @property {boolean} canOrderOnline
 * @property {string|null} onlineStatusText
 * @property {Array<{ minAmount: number, price: number, unit: string }>} tierPrices
 */

/**
 * Parst die Suchergebnisse aus dem __APOLLO_STATE__ einer HORNBACH-Suchseite.
 *
 * @param {Record<string, any>} apolloState
 * @returns {SearchResultItem[]}
 */
export function parseHornbachSearchResults(apolloState) {
  if (!apolloState || typeof apolloState !== 'object') {
    return [];
  }

  const root = apolloState['ROOT_QUERY'];
  if (!root) return [];

  const searchKey = Object.keys(root).find((k) => k.startsWith('searchListing'));
  if (!searchKey) return [];

  const listing = root[searchKey];
  if (!listing || !Array.isArray(listing.itemList)) return [];

  return listing.itemList.map((item) => {
    const sku = item.abstractProductId || item.concreteProductId?.split('_')[0] || '';
    const title = item.title || '';
    const brand = item.brand?.name || null;
    const url = item.url ? (item.url.startsWith('http') ? item.url : `https://www.hornbach.de${item.url}`) : '';
    const imageUrl = item.mainImage?.thumbnailUrl || item.mainImage?.url || null;

    const price = item.defaultPrice?.price || 0;
    const currency = item.defaultPrice?.currencyCode || 'EUR';
    const unit = item.defaultPrice?.unit || 'ST';

    const rating = item.rating?.isRatingActive
      ? { averageRating: item.rating.averageRating, reviewCount: item.rating.reviewCount }
      : null;

    const canReserveInStore = Boolean(item.offerRA?.canBeAddedToCart);
    const storeStatusText = item.offerRA?.availabilityStatusText || null;

    const canOrderOnline = Boolean(item.offerDV?.canBeAddedToCart);
    const onlineStatusText = item.offerDV?.availabilityStatusText || null;

    const tierPrices = [];
    if (Array.isArray(item.volumePriceList)) {
      for (const vp of item.volumePriceList) {
        if (vp?.defaultPrice?.price) {
          tierPrices.push({
            minAmount: vp.minimumAmount || 1,
            price: vp.defaultPrice.price,
            unit: vp.minimumUnit || vp.defaultPrice.unit || unit,
          });
        }
      }
    }

    return {
      sku,
      title,
      url,
      brand,
      price,
      currency,
      unit,
      imageUrl,
      rating,
      canReserveInStore,
      storeStatusText,
      canOrderOnline,
      onlineStatusText,
      tierPrices,
    };
  });
}

/**
 * Führt eine Volltextsuche auf HORNBACH aus und liefert eine Trefferliste zurück.
 *
 * @param {Object} params
 * @param {string} params.searchTerm - Suchbegriff (z. B. "fi schalter", "nym-j", "wago")
 * @param {string} [params.storeId] - Optionale Filial-ID (z. B. "609")
 * @param {boolean} [params.headless=false]
 * @param {number} [params.timeoutMs=60000]
 * @param {number} [params.waitAfterLoadMs=8000]
 * @returns {Promise<{ isSingleProduct: boolean, count: number, results: any[] }>}
 */
export async function searchHornbachArticles({
  searchTerm,
  storeId = null,
  headless = false,
  timeoutMs = 60000,
  waitAfterLoadMs = 8000,
}) {
  const cleanTerm = searchTerm.trim();
  if (!cleanTerm) {
    return { isSingleProduct: false, count: 0, results: [] };
  }

  const searchUrl = cleanTerm.match(/^\d+$/)
    ? `https://www.hornbach.de/s/${cleanTerm}`
    : `https://www.hornbach.de/s/${encodeURIComponent(cleanTerm)}/`;
  const browser = await chromium.launch({ headless });

  try {
    const ctx = await browser.newContext({
      locale: 'de-DE',
      timezoneId: 'Europe/Berlin',
      viewport: { width: 1440, height: 900 },
    });

    if (storeId) {
      const cleanStoreId = String(storeId).trim();
      await ctx.addCookies([
        { name: 'hbMarketCookie', value: cleanStoreId, domain: 'www.hornbach.de', path: '/' },
        { name: 'hbMarketSession', value: cleanStoreId, domain: 'www.hornbach.de', path: '/' },
        { name: 'hbMarketConfirmed', value: 'true', domain: 'www.hornbach.de', path: '/' },
      ]);
    }

    const page = await ctx.newPage();
    try {
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    } catch (navErr) {
      if (!navErr.message.includes('ERR_ABORTED')) {
        throw navErr;
      }
    }
    await page.waitForTimeout(waitAfterLoadMs);

    // Prüfen, ob direkt auf ein Einzelprodukt weitergeleitet wurde
    const currentUrl = page.url();
    const isProductPage = currentUrl.includes('/p/');

    if (isProductPage) {
      const detailApollo = await page.evaluate(() => window.__ARTICLE_DETAIL_APOLLO_STATE__ || null);
      await ctx.close();
      if (detailApollo) {
        const product = parseHornbachApolloState(detailApollo, currentUrl);
        return {
          isSingleProduct: true,
          count: 1,
          results: [product],
        };
      }
    }

    // Suchergebnisseite auslesen
    const searchApollo = await page.evaluate(() => window.__APOLLO_STATE__ || null);
    await ctx.close();

    if (!searchApollo) {
      throw new Error(`Suchergebnisse konnten nicht geladen werden (URL: ${currentUrl})`);
    }

    const results = parseHornbachSearchResults(searchApollo);
    return {
      isSingleProduct: false,
      count: results.length,
      results,
    };
  } finally {
    await browser.close();
  }
}
