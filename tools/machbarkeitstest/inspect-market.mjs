import { chromium } from 'playwright';

const url = "https://www.hornbach.de/p/hager-ads916d-16a-fehlerstrom-leitungsschutzschalter-fi-b-30ma/6072187/";

const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({
  locale: 'de-DE',
  timezoneId: 'Europe/Berlin',
  viewport: { width: 1440, height: 900 },
});
const page = await ctx.newPage();

console.log("Lade Produktseite...");
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(15000);

const storageAndCookies = await page.evaluate(() => {
  const local = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    local[k] = localStorage.getItem(k);
  }
  const session = {};
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    session[k] = sessionStorage.getItem(k);
  }
  const apollo = window.__ARTICLE_DETAIL_APOLLO_STATE__ || {};
  return {
    local,
    session,
    apolloKeys: Object.keys(apollo),
    apolloSnippet: JSON.stringify(apollo).slice(0, 2000)
  };
});

const cookies = await ctx.cookies();

console.log("=== COOKIES (Relevante Namen) ===");
for (const c of cookies) {
  if (/market|store|hb|session|shop/i.test(c.name)) {
    console.log(`${c.name} = ${c.value} (domain: ${c.domain})`);
  }
}

console.log("\n=== LOCAL STORAGE ===");
for (const [k, v] of Object.entries(storageAndCookies.local)) {
  console.log(`${k} = ${v?.slice(0, 150)}`);
}

console.log("\n=== SESSION STORAGE ===");
for (const [k, v] of Object.entries(storageAndCookies.session)) {
  console.log(`${k} = ${v?.slice(0, 150)}`);
}

console.log("\n=== APOLLO KEYS ===");
console.log("Anzahl Keys:", storageAndCookies.apolloKeys.length);
const storeKeys = storageAndCookies.apolloKeys.filter(k => /store|market|merchant/i.test(k));
console.log("Gefundene Store/Market Keys:", storeKeys);

await browser.close();
