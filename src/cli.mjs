#!/usr/bin/env node
import { fetchHornbachArticle } from './fetcher.mjs';

const args = process.argv.slice(2);

function printHelp() {
  console.log(`
HorniScrap CLI — Preis- und Verfügbarkeitsabfrage für HORNBACH

Verwendung:
  node src/cli.mjs <URL-oder-SKU> [Optionen]

Optionen:
  --store <storeId>   Filial-ID (z. B. 609 für Berlin-Mariendorf, 616 für Berlin-Neukölln)
  --json              Gibt das reine JSON-Objekt auf stdout aus
  --headless          Im Headless-Modus ausführen (Achtung: wird ggf. von F5 Bot Defense geblockt)
  --help, -h          Hilfe anzeigen

Beispiele:
  node src/cli.mjs 6072187 --store 609
  node src/cli.mjs "https://www.hornbach.de/p/hager-ads916d.../6072187/" --json
`);
}

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(args.length === 0 ? 1 : 0);
}

const isJson = args.includes('--json');
const isHeadless = args.includes('--headless');

let storeId = null;
const storeIdx = args.indexOf('--store');
if (storeIdx !== -1 && args[storeIdx + 1]) {
  storeId = args[storeIdx + 1];
}

const targetArg = args.find((a) => !a.startsWith('--') && a !== storeId);
if (!targetArg) {
  console.error('Fehler: Keine URL oder Artikelnummer angegeben.');
  process.exit(1);
}

if (!isJson) {
  console.log(`\n🔍 Frage HORNBACH ab: ${targetArg}${storeId ? ` (Markt ${storeId})` : ''}...`);
}

try {
  const result = await fetchHornbachArticle({
    urlOrSku: targetArg,
    storeId,
    headless: isHeadless,
  });

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('\n' + '═'.repeat(60));
    console.log(`📦 ${result.title}`);
    console.log('═'.repeat(60));
    console.log(`  SKU / Art.-Nr.:    ${result.sku}`);
    if (result.brand) console.log(`  Marke:             ${result.brand}`);
    if (result.ean) console.log(`  EAN:               ${result.ean}`);
    console.log(`  Preis:             ${result.price.toFixed(2)} ${result.currency} / ${result.unit}`);

    if (result.tierPrices?.length > 0) {
      console.log('  Staffelpreise:');
      for (const tp of result.tierPrices) {
        console.log(`    · ab ${tp.minAmount} ${tp.unit}: ${tp.price.toFixed(2)} ${tp.currency}`);
      }
    }

    console.log(`  Online lieferbar:  ${result.online.canOrder ? '✅ Ja' : '❌ Nein'} (${result.online.deliveryTimeText || 'k.A.'})`);

    if (result.store) {
      console.log('\n  🏢 Filiale & Vor-Ort-Verfügbarkeit:');
      console.log(`    Markt:           ${result.store.name || result.store.storeId}`);
      console.log(`    Bestand:         ${result.store.inStock ? '✅ Vorrätig' : '❌ Nicht vorrätig'}${result.store.stockCount !== null ? ` (${result.store.stockCount} Stück)` : ''}`);
      if (result.store.pickupTimeText) console.log(`    Abholung:        ${result.store.pickupTimeText}`);
      if (result.store.aisle) console.log(`    📍 Standort:     ${result.store.aisle}`);
    }

    console.log('═'.repeat(60) + '\n');
  }
} catch (err) {
  if (isJson) {
    console.error(JSON.stringify({ error: err.message }));
  } else {
    console.error(`\n❌ Fehler beim Abruf: ${err.message}\n`);
  }
  process.exit(1);
}
