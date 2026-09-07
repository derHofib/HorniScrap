import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { parseHornbachApolloState } from '../src/parser.mjs';

const samplePath = path.resolve('tools/machbarkeitstest/befunde/apollo-sample.json');
if (!fs.existsSync(samplePath)) {
  console.error('Fixture nicht gefunden:', samplePath);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
const parsed = parseHornbachApolloState(raw);

console.log('--- TEST: Parser Output ---');
console.log(JSON.stringify(parsed, null, 2));

// Validierungen
assert.equal(parsed.sku, '6072187', 'SKU stimmt nicht');
assert.equal(parsed.title, 'Hager ADS916D 16A Fehlerstrom Leitungsschutzschalter FI B 30mA');
assert.equal(parsed.brand, 'Hager');
assert.equal(parsed.ean, '3250611068143');
assert.equal(parsed.price, 46.51);
assert.equal(parsed.currency, 'EUR');
assert.equal(parsed.unit, 'ST');

// Staffelpreise
assert.equal(parsed.tierPrices.length, 1);
assert.equal(parsed.tierPrices[0].minAmount, 6);
assert.equal(parsed.tierPrices[0].price, 42.32);

// Online
assert.equal(parsed.online.canOrder, true);
assert.equal(parsed.online.deliveryTimeText, 'Lieferzeit ca. 2 Werktage');

// Store 609
assert.ok(parsed.store, 'Store-Objekt fehlt');
assert.equal(parsed.store.storeId, '609');
assert.equal(parsed.store.name, 'HORNBACH Berlin-Mariendorf');
assert.equal(parsed.store.city, 'Berlin-Mariendorf');
assert.equal(parsed.store.inStock, true);
assert.equal(parsed.store.stockCount, 12);
assert.equal(parsed.store.availabilityText, '12 ST im Markt vorrätig');
assert.equal(parsed.store.aisle, 'Elektro, Gang 20');

console.log('\n✅ Alle Assertions erfolgreich bestanden!');
