import { chromium } from 'playwright';

const url = "https://www.hornbach.de/p/hager-ads916d-16a-fehlerstrom-leitungsschutzschalter-fi-b-30ma/6072187/";

// Wir testen gezielt Markt 609 (oder einen beliebigen anderen Markt)
const targetStoreId = "609";

console.log(`\n======================================================`);
console.log(`TEST: Starte isolierten Browser mit Cookies für Markt ${targetStoreId}`);
console.log(`======================================================\n`);

const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({
  locale: 'de-DE',
  timezoneId: 'Europe/Berlin',
  viewport: { width: 1440, height: 900 },
});

// Vor dem Laden die beiden Store-Cookies setzen:
await ctx.addCookies([
  {
    name: 'hbMarketCookie',
    value: targetStoreId,
    domain: 'www.hornbach.de',
    path: '/',
  },
  {
    name: 'hbMarketSession',
    value: targetStoreId,
    domain: 'www.hornbach.de',
    path: '/',
  },
  {
    name: 'hbMarketConfirmed',
    value: 'true',
    domain: 'www.hornbach.de',
    path: '/',
  }
]);

const page = await ctx.newPage();

console.log(`Lade ${url} mit gesetztem Markt ${targetStoreId}...`);
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
console.log("Warte 12 Sekunden auf Challenge / Rendering...");
await page.waitForTimeout(12000);

const result = await page.evaluate(() => {
  const apollo = window.__ARTICLE_DETAIL_APOLLO_STATE__ || {};
  const storeKeys = Object.keys(apollo).filter(k => k.startsWith('Store:'));
  const storeData = storeKeys.map(k => apollo[k]);
  
  // Suche Verfügbarkeit & Lokation
  const allJson = JSON.stringify(apollo);
  const availMatch = allJson.match(/"availabilityText"\s*:\s*"([^"]+)"/);
  const deliveryMatch = allJson.match(/"deliveryTimeText"\s*:\s*"([^"]+)"/);
  const locationMatch = allJson.match(/"locationText"\s*:\s*"([^"]+)"/);

  return {
    title: document.title,
    storeKeys,
    storeData,
    availability: availMatch ? availMatch[1] : null,
    delivery: deliveryMatch ? deliveryMatch[1] : null,
    location: locationMatch ? locationMatch[1] : null,
  };
});

console.log("\nERGEBNIS:");
console.log("Seitentitel:", result.title);
console.log("Gefundene Store-Keys im Apollo-Cache:", result.storeKeys);
console.log("Store-Daten:", JSON.stringify(result.storeData, null, 2));
console.log("Verfügbarkeit:", result.availability);
console.log("Abholbereit:", result.delivery);
console.log("Regal / Standort:", result.location);

const erfolg = result.storeKeys.includes(`Store:${targetStoreId}`);
console.log(`\n======================================================`);
if (erfolg) {
  console.log(`🎉 VOLLER ERFOLG: Markt ${targetStoreId} wurde DIREKT per Cookie geladen!`);
} else {
  console.log(`❌ FEHLSCHLAG: Erwartet Store:${targetStoreId}, aber gefunden:`, result.storeKeys);
}
console.log(`======================================================\n`);

await browser.close();
