#!/usr/bin/env node
/**
 * HorniScrap — Markt-Wahl-Test
 *
 * Beantwortet die letzte offene Frage aus dem Machbarkeitstest (check.mjs):
 *
 *   Lässt sich der Markt, für den Preis und Bestand geliefert werden,
 *   PROGRAMMATISCH setzen — oder bekommt man immer nur "den nächstgelegenen
 *   laut IP"?
 *
 * Das entscheidet, ob sich der Marktradius aus Abschnitt 6 der Ausarbeitung
 * abbilden lässt (Bestand in mehreren definierten Märkten vergleichen) oder
 * ob dafür mehrere physische Standorte nötig wären.
 *
 * Ablauf:
 *   1. Produktseite frisch laden, Markt + relevante Cookies protokollieren ("vorher")
 *   2. DU wechselst im Browserfenster von Hand auf einen ANDEREN Markt
 *   3. Seite neu laden, Markt + Cookies erneut protokollieren ("nachher")
 *   4. Cookie-Unterschied ermitteln
 *   5. Wiederholungstest: neuer, cookie-loser Browser-Kontext, NUR der/die
 *      geänderte(n) Cookie(s) gesetzt, Seite direkt aufgerufen — kommt ohne
 *      jede UI-Interaktion derselbe Markt wie in Schritt 3?
 *
 * Schritt 5 ist der eigentliche Test: Wenn er den Zielmarkt liefert, ist die
 * Marktwahl ein reiner Cookie-Mechanismus und programmatisch steuerbar.
 * Wenn nicht, spricht das für IP-/Standort-Bindung oder Server-Session.
 *
 * Aufruf:  node market-check.mjs "<produkt-url>"
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const URL_ARG = process.argv.find((a) => a.startsWith('http'));
if (!URL_ARG) {
  console.error('Aufruf: node market-check.mjs "https://www.hornbach.de/p/…"');
  process.exit(2);
}

const OUT = path.join(process.cwd(), 'befunde');
fs.mkdirSync(OUT, { recursive: true });

const log = (...a) => console.log(...a);
const rule = (t) => log('\n' + '─'.repeat(70) + '\n' + t + '\n' + '─'.repeat(70));
const istChallenge = (title) => /client challenge/i.test(title || '');

// Findet rekursiv den ersten Knoten mit einem bestimmten Schlüssel — robust
// gegenüber wechselnden Apollo-Cache-Keys zwischen Artikeln.
function findFirst(obj, key, path = '') {
  if (obj && typeof obj === 'object') {
    if (!Array.isArray(obj) && key in obj) return { path, node: obj };
    for (const [k, v] of Object.entries(obj)) {
      const r = findFirst(v, key, `${path}/${k}`);
      if (r) return r;
    }
  }
  return null;
}

async function extractMarktInfo(page) {
  const raw = await page.evaluate(() => {
    try {
      return JSON.stringify(window.__ARTICLE_DETAIL_APOLLO_STATE__ || null);
    } catch {
      return null;
    }
  });
  if (!raw) return null;
  const apollo = JSON.parse(raw);
  const avail = findFirst(apollo, 'availabilityText');
  const merchant = findFirst(apollo, 'merchantId');
  return {
    apollo_pfad: avail?.path ?? null,
    availabilityText: avail?.node?.availabilityText ?? null,
    deliveryTimeText: avail?.node?.deliveryTimeText ?? null,
    marktName: merchant?.node?.name ?? null,
    merchantId: merchant?.node?.merchantId ?? null,
    storeId: merchant?.node?.storeId ?? null,
  };
}

function cookieMap(cookies) {
  const m = {};
  for (const c of cookies) m[c.name] = c;
  return m;
}

function diffCookies(vorher, nachher) {
  const a = cookieMap(vorher);
  const b = cookieMap(nachher);
  const geaendert = [];
  for (const name of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const av = a[name]?.value;
    const bv = b[name]?.value;
    if (av !== bv) {
      geaendert.push({ name, vorher: av ?? '(nicht gesetzt)', nachher: bv ?? '(nicht gesetzt)', domain: (b[name] ?? a[name])?.domain, path: (b[name] ?? a[name])?.path });
    }
  }
  return geaendert;
}

async function ladenUndWarten(page, url, warteSek = 15) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(warteSek * 1000);
  return await page.title();
}

const report = { gestartet: new Date().toISOString(), url: URL_ARG };

const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({
  locale: 'de-DE',
  timezoneId: 'Europe/Berlin',
  viewport: { width: 1440, height: 900 },
});
const page = await ctx.newPage();

try {
  rule('Schritt 1 — Produktseite frisch laden ("vorher")');
  let title = await ladenUndWarten(page, URL_ARG);
  if (istChallenge(title)) {
    log('❌ Challenge nicht aufgelöst. Mit --keep-open-Variante von check.mjs zuerst prüfen.');
    throw new Error('Blockiert bei Erstaufruf');
  }
  const vorherInfo = await extractMarktInfo(page);
  const vorherCookies = await ctx.cookies();
  report.vorher = { info: vorherInfo, cookies: vorherCookies.map((c) => ({ name: c.name, domain: c.domain })) };

  log('Markt aktuell:', vorherInfo?.marktName, `(storeId ${vorherInfo?.storeId})`);
  log('Bestand:', vorherInfo?.availabilityText, '|', vorherInfo?.deliveryTimeText);
  log(`${vorherCookies.length} Cookies gesetzt.`);

  rule('Schritt 2 — Jetzt du: Markt im Browserfenster wechseln');
  log('Suche im geöffneten Fenster nach einer Standort-/Marktanzeige (meist oben');
  log('im Kopfbereich, zeigt aktuell vermutlich', JSON.stringify(vorherInfo?.marktName) + ').');
  log('Klick drauf, wähle einen ANDEREN Markt aus als den aktuellen, bestätige.');
  log('\nWenn der neue Markt angezeigt wird: hier im Terminal ENTER drücken …');
  await new Promise((r) => process.stdin.once('data', r));

  rule('Schritt 3 — Seite neu laden, Markt erneut prüfen ("nachher")');
  title = await ladenUndWarten(page, URL_ARG, 8);
  const nachherInfo = await extractMarktInfo(page);
  const nachherCookies = await ctx.cookies();
  report.nachher = { info: nachherInfo, cookies: nachherCookies.map((c) => ({ name: c.name, domain: c.domain })) };

  log('Markt jetzt:', nachherInfo?.marktName, `(storeId ${nachherInfo?.storeId})`);
  log('Bestand:', nachherInfo?.availabilityText, '|', nachherInfo?.deliveryTimeText);

  const marktGeaendert = vorherInfo?.storeId !== nachherInfo?.storeId;
  report.markt_hat_sich_geaendert = marktGeaendert;
  if (!marktGeaendert) {
    log('\n⚠️  storeId ist UNVERÄNDERT. Entweder wurde derselbe Markt erneut gewählt,');
    log('    oder der Wechsel wirkt sich nicht auf diesen Artikel/dieses Feld aus.');
    log('    Die folgenden Schritte sind dann wenig aussagekräftig.');
  }

  rule('Schritt 4 — Welche Cookies haben sich geändert?');
  const geaendert = diffCookies(vorherCookies, nachherCookies);
  report.geaenderte_cookies = geaendert;
  if (geaendert.length === 0) {
    log('— keine Cookie-Änderung erkannt —');
    log('   Der Markt wird dann vermutlich NICHT über ein Cookie gesteuert,');
    log('   sondern serverseitig (Session/IP). Das würde bedeuten: der Markt');
    log('   lässt sich nicht ohne Weiteres von außen erzwingen.');
  } else {
    geaendert.forEach((c) => log(`  ${c.name}  (${c.domain}${c.path})\n    vorher:  ${c.vorher}\n    nachher: ${c.nachher}`));
  }

  if (marktGeaendert && geaendert.length > 0) {
    rule('Schritt 5 — Wiederholungstest in sauberem Kontext');
    log('Neuer, cookie-loser Browser-Kontext. Nur die geänderten Cookies werden');
    log('gesetzt, dann wird die Seite DIREKT aufgerufen — ganz ohne UI-Klick.');

    const ctx2 = await browser.newContext({ locale: 'de-DE', timezoneId: 'Europe/Berlin' });
    const cookiesZumSetzen = geaendert
      .filter((c) => c.nachher !== '(nicht gesetzt)')
      .map((c) => ({ name: c.name, value: c.nachher, domain: c.domain, path: c.path || '/' }));
    await ctx2.addCookies(cookiesZumSetzen);

    const page2 = await ctx2.newPage();
    await ladenUndWarten(page2, URL_ARG, 8);
    const replayInfo = await extractMarktInfo(page2);
    report.replay = { gesetzte_cookies: cookiesZumSetzen.map((c) => c.name), info: replayInfo };

    log('Markt im Replay:', replayInfo?.marktName, `(storeId ${replayInfo?.storeId})`);

    const treffer = replayInfo?.storeId === nachherInfo?.storeId;
    report.replay_erfolgreich = treffer;
    rule(treffer ? '✅ ERGEBNIS: Markt lässt sich per Cookie steuern' : '❌ ERGEBNIS: Cookie allein reicht nicht');
    if (treffer) {
      log('Der Zielmarkt kam ohne jede UI-Interaktion zustande, rein durch das');
      log(`Setzen von: ${cookiesZumSetzen.map((c) => c.name).join(', ')}`);
      log('\n→ Für Abschnitt 6 der Ausarbeitung heißt das: Der Marktradius-Fall');
      log('  ist technisch abbildbar. Ein Abruf pro Markt braucht nur diesen');
      log('  Cookie mit dem jeweiligen storeId — kein Login, kein Browser-Klick.');
    } else {
      log('Der Markt aus Schritt 3 kam NICHT zustande, obwohl dieselben Cookies');
      log('gesetzt wurden. Die Marktwahl hängt an mehr als diesen Cookies —');
      log('vermutlich zusätzlich an IP/Geolocation oder einer Server-Session.');
      log('\n→ Für Abschnitt 6 heißt das: Mehrere Märkte gezielt abzufragen ist');
      log('  mit diesem Mechanismus NICHT ohne Weiteres möglich.');
    }
    await ctx2.close();
  } else if (marktGeaendert && geaendert.length === 0) {
    rule('Kein Wiederholungstest möglich');
    log('Der Markt hat sich geändert, aber kein Cookie dafür gefunden.');
    log('→ Vermutlich Server-Session oder IP-basiert, nicht per Cookie steuerbar.');
  }
} catch (err) {
  report.fehler = err.message;
  log('\n❌ ABBRUCH:', err.message);
} finally {
  fs.writeFileSync(path.join(OUT, 'markt-test.json'), JSON.stringify(report, null, 2));
  rule('Befund gespeichert');
  log(path.join(OUT, 'markt-test.json'));
  await browser.close();
}
