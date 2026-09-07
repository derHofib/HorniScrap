import { fetchHornbachArticle } from './fetcher.mjs';

/**
 * Bekannte HORNBACH-Filialen und Ballungsraum-Cluster für Handwerksbetriebe.
 */
export const HORNBACH_STORE_CLUSTERS = {
  berlin: [
    { id: '609', name: 'Berlin-Mariendorf', postal: '12107' },
    { id: '616', name: 'Berlin-Neukölln', postal: '12057' },
    { id: '617', name: 'Berlin-Bohnsdorf', postal: '12526' },
    { id: '608', name: 'Velten', postal: '16727' },
    { id: '611', name: 'Potsdam-Marquardt', postal: '14476' },
  ],
  muenchen: [
    { id: '710', name: 'München-Fröttmaning', postal: '80939' },
    { id: '711', name: 'München-Freiham', postal: '81249' },
  ],
  frankfurt: [
    { id: '510', name: 'Frankfurt-Niedereschbach', postal: '60437' },
    { id: '511', name: 'Hanau', postal: '63452' },
  ],
  ruhrgebiet: [
    { id: '410', name: 'Essen', postal: '45356' },
    { id: '411', name: 'Dortmund', postal: '44147' },
    { id: '412', name: 'Gelsenkirchen', postal: '45891' },
  ],
};

/**
 * Generiert den direkten 1-Klick-Reservierungslink für HORNBACH.
 *
 * @param {string} productUrl
 * @param {string} storeId
 * @returns {string}
 */
export function buildReservationUrl(productUrl, storeId) {
  if (!productUrl) return '';
  const urlObj = new URL(productUrl);
  urlObj.searchParams.set('storeId', storeId);
  urlObj.searchParams.set('reservation', 'true');
  return urlObj.toString();
}

/**
 * Vergleicht die Verfügbarkeit eines Artikels über mehrere Filialen hinweg (Umkreissuche).
 *
 * @param {Object} params
 * @param {string} params.urlOrSku - Artikelnummer oder URL
 * @param {string[]|string} params.stores - Array von Store-IDs oder Cluster-Name ('berlin', 'muenchen', etc.)
 * @param {number} [params.concurrency=2] - Parallele Abfragen
 * @returns {Promise<{ article: any, stores: Array<any> }>}
 */
export async function compareStoreAvailability({
  urlOrSku,
  stores = 'berlin',
  concurrency = 2,
}) {
  let targetStores = [];

  if (typeof stores === 'string' && HORNBACH_STORE_CLUSTERS[stores.toLowerCase()]) {
    targetStores = HORNBACH_STORE_CLUSTERS[stores.toLowerCase()];
  } else if (Array.isArray(stores)) {
    targetStores = stores.map((s) => (typeof s === 'string' ? { id: s, name: `Markt ${s}` } : s));
  } else if (typeof stores === 'string') {
    targetStores = stores.split(',').map((s) => ({ id: s.trim(), name: `Markt ${s.trim()}` }));
  }

  if (targetStores.length === 0) {
    throw new Error('Keine gültigen Filialen für den Umkreisvergleich übergeben');
  }

  console.log(`[Umkreissuche] Prüfe ${targetStores.length} Filialen für "${urlOrSku}"...`);

  // Erst einen Store abfragen, um Stammdaten (Titel, Preis, EAN, Bild) zu haben
  const baseArticle = await fetchHornbachArticle({
    urlOrSku,
    storeId: targetStores[0].id,
  });

  const storeResults = [];
  // Erste Filiale ist bereits abgefragt
  if (baseArticle.store) {
    storeResults.push({
      ...baseArticle.store,
      reservationUrl: buildReservationUrl(baseArticle.url, baseArticle.store.storeId),
    });
  }

  // Die restlichen Filialen abfragen (im Concurrency-Batch)
  const remaining = targetStores.slice(1);
  for (let i = 0; i < remaining.length; i += concurrency) {
    const chunk = remaining.slice(i, i + concurrency);
    const chunkPromises = chunk.map(async (st) => {
      try {
        const res = await fetchHornbachArticle({
          urlOrSku: baseArticle.url || urlOrSku,
          storeId: st.id,
        });
        if (res.store) {
          return {
            ...res.store,
            name: res.store.name || st.name,
            reservationUrl: buildReservationUrl(res.url || baseArticle.url, res.store.storeId),
          };
        }
        return {
          storeId: st.id,
          name: st.name,
          inStock: false,
          stockCount: 0,
          availabilityText: 'Nicht ermittelbar',
          aisle: null,
          pickupTimeText: null,
          reservationUrl: buildReservationUrl(baseArticle.url, st.id),
        };
      } catch (err) {
        return {
          storeId: st.id,
          name: st.name,
          inStock: false,
          stockCount: 0,
          availabilityText: 'Fehler beim Abruf',
          aisle: null,
          pickupTimeText: null,
          reservationUrl: buildReservationUrl(baseArticle.url, st.id),
        };
      }
    });

    const chunkResults = await Promise.all(chunkPromises);
    storeResults.push(...chunkResults);
  }

  // Sortierung: Vorrätige Filialen mit höchstem Bestand zuerst
  storeResults.sort((a, b) => (b.stockCount || 0) - (a.stockCount || 0));

  return {
    sku: baseArticle.sku,
    title: baseArticle.title,
    brand: baseArticle.brand,
    ean: baseArticle.ean,
    price: baseArticle.price,
    currency: baseArticle.currency,
    unit: baseArticle.unit,
    imageUrl: baseArticle.imageUrl,
    url: baseArticle.url,
    tierPrices: baseArticle.tierPrices,
    online: baseArticle.online,
    stores: storeResults,
  };
}
