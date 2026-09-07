import { chromium } from 'playwright';
import fs from 'node:fs';

const searchTerm = 'fi schalter 16a';
const url = `https://www.hornbach.de/s/${encodeURIComponent(searchTerm)}`;

console.log(`Lade Suchseite für: "${searchTerm}" -> ${url}`);

const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({
  locale: 'de-DE',
  timezoneId: 'Europe/Berlin',
  viewport: { width: 1440, height: 900 },
});
const page = await ctx.newPage();

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
console.log('Warte 10s auf Auflösung & Hydration...');
await page.waitForTimeout(10000);

const info = await page.evaluate(() => {
  const windowKeys = Object.keys(window).filter(k => /apollo|state|search|article|initial/i.test(k));
  
  // Prüfe spezifische typische Apollo-State Namen
  const apollo = window.__ARTICLE_SEARCH_APOLLO_STATE__ 
    || window.__APOLLO_STATE__ 
    || window.__INITIAL_STATE__
    || window.__ARTICLE_DETAIL_APOLLO_STATE__
    || null;

  // Suche nach Produktkacheln im DOM
  const articles = [];
  // Versuche verschiedene Selektoren
  const cards = document.querySelectorAll('article, [data-testid*="article"], [data-testid*="product"], .article-card, [class*="product-card"]');
  
  return {
    url: window.location.href,
    title: document.title,
    windowKeys,
    hasApollo: !!apollo,
    apolloKeys: apollo ? Object.keys(apollo).slice(0, 30) : [],
    domCardCount: cards.length,
    apolloSnippet: apollo ? JSON.stringify(apollo).slice(0, 1500) : null
  };
});

console.log('Ergebnis-Info:');
console.log(JSON.stringify(info, null, 2));

// Vollständiges HTML und Apollo-State speichern
const html = await page.content();
fs.writeFileSync('tools/machbarkeitstest/befunde/search-sample.html', html);

if (info.hasApollo) {
  const fullApollo = await page.evaluate(() => {
    return window.__ARTICLE_SEARCH_APOLLO_STATE__ 
      || window.__APOLLO_STATE__ 
      || window.__INITIAL_STATE__
      || null;
  });
  fs.writeFileSync('tools/machbarkeitstest/befunde/search-apollo.json', JSON.stringify(fullApollo, null, 2));
  console.log('search-apollo.json gespeichert!');
}

await browser.close();
