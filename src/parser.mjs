/**
 * HorniScrap — Apollo-Cache Parser
 *
 * Reiner, zustandsloser Parser für den HORNBACH Apollo-GraphQL-Cache (`__ARTICLE_DETAIL_APOLLO_STATE__`).
 * Läuft vollständig offline und ohne Browser-Abhängigkeit.
 */

/**
 * @typedef {Object} TierPrice
 * @property {number} minAmount
 * @property {number} price
 * @property {string} unit
 * @property {string} currency
 *
 * @typedef {Object} StoreAvailability
 * @property {string} storeId
 * @property {string} [name]
 * @property {string} [city]
 * @property {boolean} inStock
 * @property {number|null} stockCount
 * @property {string|null} availabilityText
 * @property {string|null} pickupTimeText
 * @property {string|null} aisle
 *
 * @typedef {Object} HornbachArticle
 * @property {string} sku
 * @property {string} title
 * @property {string|null} url
 * @property {string|null} brand
 * @property {string|null} ean
 * @property {number} price
 * @property {string} currency
 * @property {string} unit
 * @property {string|null} imageUrl
 * @property {TierPrice[]} tierPrices
 * @property {{ canOrder: boolean, deliveryTimeText: string|null }} online
 * @property {StoreAvailability|null} store
 * @property {string} fetchedAt
 */

/**
 * Parst den Apollo-State einer HORNBACH-Produktseite in ein standardisiertes Datenmodell.
 *
 * @param {Record<string, any>} apolloState
 * @param {string} [sourceUrl]
 * @returns {HornbachArticle}
 */
export function parseHornbachApolloState(apolloState, sourceUrl = null) {
  if (!apolloState || typeof apolloState !== 'object') {
    throw new Error('Ungültiger Apollo-State: Objekt erwartet');
  }

  // 1. Produkt-Knoten finden (z. B. "Product:product:6072187:6072187_ST")
  const productKey = Object.keys(apolloState).find((k) => k.startsWith('Product:'));
  if (!productKey) {
    throw new Error('Kein Product-Knoten im Apollo-State gefunden');
  }
  const prod = apolloState[productKey];

  // SKU / Artikelnummer
  const sku = prod.abstractProductId || prod.concreteProductId?.split('_')[0] || '';

  // Titel & Marke
  const title = prod.title || '';
  const brand = prod.brand?.name || null;

  // EAN
  let ean = null;
  if (Array.isArray(prod.eanList) && prod.eanList.length > 0) {
    ean = prod.eanList[0].code || null;
  }
  if (!ean && Array.isArray(prod.attributeList)) {
    const eanAttr = prod.attributeList.find((a) => a.key === 'EAN');
    if (eanAttr) ean = eanAttr.value;
  }

  // URL
  const url = sourceUrl || prod.url || (prod.relativeUrl ? `https://www.hornbach.de${prod.relativeUrl}` : null);

  // Bild
  const imageUrl = prod.mediaList?.[0]?.url || prod.metaTags?.image?.url || null;

  // Maßeinheit (Default "ST")
  const unit = prod.defaultSalesUnit?.productMeasurementUnitCode || 'ST';

  // Regulärer Einzelpreis
  const price = typeof prod.minimumDefaultPrice === 'number' ? prod.minimumDefaultPrice : 0;
  const currency = 'EUR';

  // Staffelpreise
  /** @type {TierPrice[]} */
  const tierPrices = [];
  if (Array.isArray(prod.volumePriceList)) {
    for (const vp of prod.volumePriceList) {
      if (vp?.defaultPrice?.price) {
        tierPrices.push({
          minAmount: vp.minimumAmount || 1,
          price: vp.defaultPrice.price,
          unit: vp.minimumUnit || vp.defaultPrice.unit || unit,
          currency: vp.defaultPrice.currency === '€' ? 'EUR' : vp.defaultPrice.currency || 'EUR',
        });
      }
    }
  }

  // Online-Bestellbarkeit (offerDV)
  const offerDV = prod.offerDV || {};
  const online = {
    canOrder: Boolean(offerDV.canBeAddedToCart),
    deliveryTimeText: offerDV.deliveryTimeText || null,
  };

  // Filial-Verfügbarkeit (offerRA & Store:<storeId>)
  let store = null;
  const offerRA = prod.offerRA || {};
  const storeKey = Object.keys(apolloState).find((k) => k.startsWith('Store:'));
  const storeData = storeKey ? apolloState[storeKey] : null;

  if (storeData || offerRA.availabilityText || offerRA.locationText) {
    // Stückzahl aus Verfügbarkeitstext ("12 ST im Markt vorrätig") extrahieren
    let stockCount = null;
    if (offerRA.availabilityText) {
      const match = offerRA.availabilityText.match(/^(\d+)\s*(?:ST|Stk|Stück)?/i);
      if (match) {
        stockCount = parseInt(match[1], 10);
      }
    }

    // Regal / Gang
    const aisle = offerRA.locationText || offerRA.articleLocation?.areaAisle || null;

    store = {
      storeId: storeData?.storeId || offerRA.merchant?.merchantId?.replace(/^DE/, '') || null,
      name: storeData?.name || null,
      city: storeData?.mainAddress?.city || null,
      inStock: stockCount === null ? Boolean(offerRA.canBeAddedToCart) : stockCount > 0,
      stockCount,
      availabilityText: offerRA.availabilityText || null,
      pickupTimeText: offerRA.deliveryTimeText || null,
      aisle,
    };
  }

  return {
    sku,
    title,
    url,
    brand,
    ean,
    price,
    currency,
    unit,
    imageUrl,
    tierPrices,
    online,
    store,
    fetchedAt: new Date().toISOString(),
  };
}
