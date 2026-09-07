import { parseHornbachApolloState } from './parser.mjs';
import { getBrowser, createOptimizedPage, waitForWindowProperty } from './browser-pool.mjs';

/**
 * Parst die Suchergebnisse aus dem __APOLLO_STATE__ einer HORNBACH-Suchseite.
 *
 * @param {Record<string, any>} apolloState
 * @returns {Array<any>}
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
 * Führt eine blitzschnelle Volltextsuche auf HORNBACH aus (mit Browser-Pooling).
 *
 * @param {Object} params
 * @param {string} params.searchTerm - Suchbegriff
 * @param {string} [params.storeId]
 * @param {boolean} [params.headless=false]
 * @param {number} [params.timeoutMs=30000]
 * @returns {Promise<{ isSingleProduct: boolean, count: number, results: any[] }>}
 */
export async function searchHornbachArticles({
  searchTerm,
  storeId = null,
  headless = false,
  timeoutMs = 30000,
}) {
  const cleanTerm = searchTerm.trim();
  if (!cleanTerm) {
    return { isSingleProduct: false, count: 0, results: [] };
  }

  const searchUrl = cleanTerm.match(/^\d+$/)
    ? `https://www.hornbach.de/s/${cleanTerm}`
    : `https://www.hornbach.de/s/${encodeURIComponent(cleanTerm)}/`;

  const browser = await getBrowser(headless);
  const { ctx, page } = await createOptimizedPage(browser, storeId);

  try {
    try {
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    } catch (navErr) {
      if (!navErr.message.includes('ERR_ABORTED')) {
        throw navErr;
      }
    }

    // Warte auf entweder Einzelprodukt oder Suchliste (max 6s)
    let isProduct = false;
    let state = null;

    const t0 = Date.now();
    while (Date.now() - t0 < 8000) {
      const url = page.url();
      if (url.includes('/p/')) {
        state = await page.evaluate(() => window.__ARTICLE_DETAIL_APOLLO_STATE__ || null);
        if (state) {
          isProduct = true;
          break;
        }
      } else {
        state = await page.evaluate(() => window.__APOLLO_STATE__ || null);
        if (state) {
          isProduct = false;
          break;
        }
      }
      await page.waitForTimeout(150);
    }

    const currentUrl = page.url();

    if (isProduct && state) {
      const product = parseHornbachApolloState(state, currentUrl);
      return {
        isSingleProduct: true,
        count: 1,
        results: [product],
      };
    }

    if (!state) {
      throw new Error(`Weder Produkt noch Suchergebnisse geladen (URL: ${currentUrl})`);
    }

    const results = parseHornbachSearchResults(state);
    return {
      isSingleProduct: false,
      count: results.length,
      results,
    };
  } finally {
    await ctx.close();
  }
}
