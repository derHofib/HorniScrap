import { chromium } from 'playwright';

const url = "https://www.hornbach.de/p/hager-ads916d-16a-fehlerstrom-leitungsschutzschalter-fi-b-30ma/6072187/";

console.log("Starte Browser-Benchmark mit Tracker-Blockierung...");
const t0 = Date.now();

const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({
  locale: 'de-DE',
  timezoneId: 'Europe/Berlin',
  viewport: { width: 1440, height: 900 },
});

// Blockiere Tracking & Werbenetzwerke, die 60% der Ladezeit fressen
await ctx.route(/\/(doubleclick|clarity|bing|pinterest|dynatrace|ablyft|google-analytics|coveo)\b/i, (route) => {
  route.abort();
});

const page = await ctx.newPage();

await ctx.addCookies([
  { name: 'hbMarketCookie', value: '609', domain: 'www.hornbach.de', path: '/' },
  { name: 'hbMarketSession', value: '609', domain: 'www.hornbach.de', path: '/' },
]);

const tNav = Date.now();
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
console.log(`DOMContentLoaded erreicht in: ${Date.now() - tNav} ms`);

// Warten, bis window.__ARTICLE_DETAIL_APOLLO_STATE__ da ist (polling statt fester 12s Pause!)
let apolloFound = false;
for (let i = 0; i < 30; i++) {
  const ready = await page.evaluate(() => !!window.__ARTICLE_DETAIL_APOLLO_STATE__);
  if (ready) {
    console.log(`Apollo-State bereits nach ${i * 300} ms im DOM verfügbar!`);
    apolloFound = true;
    break;
  }
  await page.waitForTimeout(300);
}

const totalTime = Date.now() - t0;
console.log(`Gesamtzeit: ${totalTime} ms (Apollo vorhanden: ${apolloFound})`);

await browser.close();
