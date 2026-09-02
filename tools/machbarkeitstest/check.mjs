#!/usr/bin/env node
/**
 * HorniScrap — Machbarkeitstest
 *
 * Beantwortet vier Fragen, die aus einer Sandbox heraus nicht beantwortbar sind
 * und die darüber entscheiden, ob Option E (eigenes Browser-Scraping) trägt:
 *
 *   F1  Kommt ein echter Browser durch den Bot-Schutz?
 *   F2  Was steht in robots.txt — sobald eine Session besteht, ist sie lesbar.
 *   F3  Stehen Preis und Verfügbarkeit maschinenlesbar auf der Produktseite?
 *   F4  Geht es auch headless (= auf einem Server) oder nur mit sichtbarem Fenster?
 *
 * Der Test ruft EINE Produktseite ab, in menschlichem Tempo, ohne jede
 * Umgehungstechnik. Er ist ein Messwerkzeug, kein Scraper.
 *
 * Voraussetzung:  npm i    (installiert playwright + Chromium)
 * Aufruf:         node check.mjs "<produkt-url>"
 *                 node check.mjs "<produkt-url>" --headless
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const HEADLESS = args.includes('--headless');
const KEEP_OPEN = args.includes('--keep-open');
const URL_ARG = args.find((a) => a.startsWith('http'));

if (!URL_ARG) {
  console.error('Aufruf: node check.mjs "https://www.hornbach.de/p/…" [--headless] [--keep-open]');
  process.exit(2);
}

const OUT = path.join(process.cwd(), 'befunde');
fs.mkdirSync(OUT, { recursive: true });

const report = {
  gestartet: new Date().toISOString(),
  modus: HEADLESS ? 'headless' : 'headful',
  url: URL_ARG,
  f1_challenge: null,
  f2_robots: null,
  f3_extraktion: null,
  f4_serverfaehig: null,
  netzwerk_kandidaten: [],
  timings_ms: {},
};

const log = (...a) => console.log(...a);
const rule = (t) => log('\n' + '─'.repeat(70) + '\n' + t + '\n' + '─'.repeat(70));

// Erkennt die F5-Challenge-Seite an ihren stabilen Merkmalen.
const istChallenge = (html, title) =>
  /client challenge/i.test(title || '') || /\/_fs-ch-|Client Challenge/i.test(html || '');

const ts = () => Date.now();

const browser = await chromium.launch({
  headless: HEADLESS,
  // Bewusst KEINE Stealth-Flags, kein UA-Spoofing, keine Fingerprint-Manipulation.
  // Getestet wird ein normaler Browser, nicht ein getarnter.
});

const ctx = await browser.newContext({
  locale: 'de-DE',
  timezoneId: 'Europe/Berlin',
  viewport: { width: 1440, height: 900 },
});

const page = await ctx.newPage();

// Netzwerkmitschnitt: Kandidaten für einen Verfügbarkeits-Endpunkt sammeln.
page.on('response', (res) => {
  const u = res.url();
  if (/\.(png|jpe?g|svg|gif|webp|woff2?|css|ico|mp4)(\?|$)/i.test(u)) return;
  if (!/availability|verfuegbar|stock|bestand|market|markt|store|filiale|price|preis|graphql|\/api\//i.test(u)) return;
  report.netzwerk_kandidaten.push({
    status: res.status(),
    methode: res.request().method(),
    url: u.slice(0, 240),
    typ: res.headers()['content-type'] || '',
  });
});

try {
  // ── F1 ───────────────────────────────────────────────────────────────────
  rule('F1 — Kommt ein echter Browser durch?');
  let t0 = ts();
  await page.goto('https://www.hornbach.de/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  log('Startseite geladen, warte 15s auf Auflösung der Challenge …');
  await page.waitForTimeout(15_000);
  report.timings_ms.startseite = ts() - t0;

  let html = await page.content();
  let title = await page.title();
  const blockiert = istChallenge(html, title);
  report.f1_challenge = {
    durchgekommen: !blockiert,
    titel: title,
    html_bytes: html.length,
    dauer_ms: report.timings_ms.startseite,
  };
  log(blockiert ? '❌ BLOCKIERT — noch Challenge-Seite' : '✅ DURCHGEKOMMEN');
  log(`   Titel: "${title}"  |  ${html.length} Bytes  |  ${report.timings_ms.startseite} ms`);

  if (blockiert && KEEP_OPEN) {
    log('\n   --keep-open: Löse die Challenge im Fenster von Hand, dann Enter hier …');
    await new Promise((r) => process.stdin.once('data', r));
    html = await page.content();
    title = await page.title();
    report.f1_challenge.nach_handaufloesung = !istChallenge(html, title);
  }

  // ── F2 ───────────────────────────────────────────────────────────────────
  rule('F2 — Was steht in robots.txt?');
  await page.waitForTimeout(3000);
  const robots = await page.evaluate(async () => {
    try {
      const r = await fetch('/robots.txt', { credentials: 'include' });
      return { status: r.status, text: (await r.text()).slice(0, 8000) };
    } catch (e) {
      return { status: 0, text: 'FEHLER: ' + e.message };
    }
  });
  const robotsLesbar = robots.status === 200 && !/Client Challenge/i.test(robots.text);
  report.f2_robots = { lesbar: robotsLesbar, status: robots.status, inhalt: robots.text };
  log(robotsLesbar ? '✅ robots.txt lesbar:' : '❌ robots.txt weiterhin nicht lesbar');
  if (robotsLesbar) {
    fs.writeFileSync(path.join(OUT, 'robots.txt'), robots.text);
    log(robots.text.slice(0, 1500));
    log('\n   ⚠️  DIESE DATEI IST DIE ERLAUBNIS. Untersagt sie /p/ oder /s/,');
    log('       endet der Machbarkeitstest hier — unabhängig davon, was technisch ginge.');
  }

  // ── F3 ───────────────────────────────────────────────────────────────────
  rule('F3 — Preis und Verfügbarkeit maschinenlesbar?');
  await page.waitForTimeout(4000);
  t0 = ts();
  await page.goto(URL_ARG, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(8000);
  report.timings_ms.produktseite = ts() - t0;

  html = await page.content();
  title = await page.title();
  fs.writeFileSync(path.join(OUT, `produktseite-${report.modus}.html`), html);

  if (istChallenge(html, title)) {
    report.f3_extraktion = { moeglich: false, grund: 'Produktseite zeigt Challenge' };
    log('❌ Produktseite blockiert.');
  } else {
    // Quellenagnostische Extraktion — ohne Kenntnis der konkreten Selektoren.
    const daten = await page.evaluate(() => {
      const out = { jsonld: [], meta: {}, microdata: [], eur_treffer: [] };

      for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
        try {
          out.jsonld.push(JSON.parse(s.textContent));
        } catch {
          out.jsonld.push({ _parse_fehler: s.textContent.slice(0, 200) });
        }
      }
      for (const m of document.querySelectorAll('meta[property],meta[itemprop],meta[name]')) {
        const k = m.getAttribute('property') || m.getAttribute('itemprop') || m.getAttribute('name');
        if (/price|currency|availability|product/i.test(k)) out.meta[k] = m.content;
      }
      for (const e of document.querySelectorAll('[itemprop]')) {
        const k = e.getAttribute('itemprop');
        if (/price|availability/i.test(k)) {
          out.microdata.push({ itemprop: k, content: e.getAttribute('content'), text: e.textContent.trim().slice(0, 60) });
        }
      }
      const txt = document.body.innerText;
      out.eur_treffer = [...txt.matchAll(/[\d.]+,\d{2}\s*(?:€|EUR)/g)].map((m) => m[0]).slice(0, 15);
      out.verfuegbarkeit_text = [...txt.matchAll(/[^\n]{0,60}(verfügbar|lieferbar|abholbereit|nicht auf Lager|ausverkauft)[^\n]{0,60}/gi)]
        .map((m) => m[0].trim())
        .slice(0, 10);
      return out;
    });

    const preisAusJsonLd = JSON.stringify(daten.jsonld).match(/"price"\s*:\s*"?([\d.,]+)/);
    report.f3_extraktion = {
      moeglich: true,
      jsonld_bloecke: daten.jsonld.length,
      preis_aus_jsonld: preisAusJsonLd ? preisAusJsonLd[1] : null,
      meta: daten.meta,
      microdata: daten.microdata,
      eur_treffer: daten.eur_treffer,
      verfuegbarkeit_text: daten.verfuegbarkeit_text,
      dauer_ms: report.timings_ms.produktseite,
    };
    fs.writeFileSync(path.join(OUT, 'extraktion.json'), JSON.stringify(daten, null, 2));

    log(`✅ Seite geladen in ${report.timings_ms.produktseite} ms`);
    log(`   JSON-LD-Blöcke:        ${daten.jsonld.length}`);
    log(`   Preis aus JSON-LD:     ${preisAusJsonLd ? preisAusJsonLd[1] : '— nicht gefunden'}`);
    log(`   Preis-Meta-Tags:       ${Object.keys(daten.meta).join(', ') || '—'}`);
    log(`   EUR-Beträge im Text:   ${daten.eur_treffer.join('  ') || '—'}`);
    log(`   Verfügbarkeitstexte:`);
    daten.verfuegbarkeit_text.forEach((t) => log('     · ' + t));
  }

  // ── F4 ───────────────────────────────────────────────────────────────────
  rule('F4 — Servertauglichkeit');
  report.f4_serverfaehig = HEADLESS
    ? report.f1_challenge.durchgekommen
      ? 'JA — headless kam durch, unbeaufsichtigter Betrieb möglich'
      : 'NEIN — headless blockiert; nur mit sichtbarem Browser'
    : 'UNGEPRÜFT — Lauf mit --headless wiederholen';
  log(report.f4_serverfaehig);

  rule('Netzwerk-Kandidaten für Verfügbarkeits-Endpunkte');
  if (report.netzwerk_kandidaten.length === 0) log('— keine —');
  report.netzwerk_kandidaten.slice(0, 25).forEach((c) => log(`  ${c.status} ${c.methode} ${c.url}`));
} catch (err) {
  report.fehler = err.message;
  log('\n❌ ABBRUCH: ' + err.message);
} finally {
  const ziel = path.join(OUT, `befund-${report.modus}.json`);
  fs.writeFileSync(ziel, JSON.stringify(report, null, 2));
  rule('Ergebnis');
  log(`F1 Browser kommt durch:   ${report.f1_challenge?.durchgekommen ? 'JA' : 'NEIN'}`);
  log(`F2 robots.txt lesbar:     ${report.f2_robots?.lesbar ? 'JA' : 'NEIN'}`);
  log(`F3 Preis extrahierbar:    ${report.f3_extraktion?.preis_aus_jsonld ? 'JA (JSON-LD)' : report.f3_extraktion?.moeglich ? 'TEILWEISE' : 'NEIN'}`);
  log(`F4 Serverbetrieb:         ${report.f4_serverfaehig ?? "— (Abbruch vor der Messung)"}`);
  log(`\nBefunde geschrieben nach: ${OUT}`);
  await browser.close();
}
