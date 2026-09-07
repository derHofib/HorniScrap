# HorniScrap

Preis- und Verfügbarkeitsbeobachtung für HORNBACH-Artikel — mit automatischer Filial- und Regalplatz-Ermittlung.

👉 **[Ausarbeitung: Preis- und Verfügbarkeitsdaten von HORNBACH](docs/Ausarbeitung-Hornbach-Preis-und-Verfuegbarkeitsdaten.md)**

---

## Aktueller Stand

✅ **Funktionsfähiger Extraktor & CLI implementiert** (2026-09-07).
* **Marktsteuerung gelöst**: Jeder HORNBACH-Markt lässt sich gezielt über die First-Party-Cookies `hbMarketCookie` und `hbMarketSession` ansteuern.
* **Apollo-Cache-Extraktion**: Direktes Auslesen von `window.__ARTICLE_DETAIL_APOLLO_STATE__` aus der gerenderten Produktseite.
* **Daten**:
  * Exakter Einzelpreis & Staffelpreise (ab X Stück)
  * EAN, Artikelnummer (SKU), Marke, Titel, Produktbild
  * Online-Lieferbarkeit & Lieferzeit
  * Filialbestand (Stückzahl im Markt)
  * Abholzeit (z. B. „in 2 Stunden abholbereit“)
  * 📍 **Exakter Regal-Standort** (z. B. „Elektro, Gang 20“)

---

## Schnellstart

### 1. Installation

```bash
npm install
```

### 2. Tests ausführen (Offline-Parser-Test gegen Fixtures)

```bash
npm test
```

### 3. CLI verwenden

```bash
# Abfrage per Artikelnummer und Wunschfiliale (z. B. 609 = Berlin-Mariendorf)
node src/cli.mjs 6072187 --store 609

# Abfrage per Produkt-URL
node src/cli.mjs "https://www.hornbach.de/p/hager-ads916d-16a-fehlerstrom-leitungsschutzschalter-fi-b-30ma/6072187/" --store 616

# Maschinenlesbare JSON-Ausgabe (z. B. für FieldVibe oder Weiterverarbeitung)
node src/cli.mjs 6072187 --store 609 --json
```

---

## Programmatische Nutzung

```javascript
import { fetchHornbachArticle } from 'horniscrap';

const article = await fetchHornbachArticle({
  urlOrSku: '6072187',
  storeId: '609', // z. B. Berlin-Mariendorf
});

console.log(article.title);           // "Hager ADS916D 16A Fehlerstrom Leitungsschutzschalter..."
console.log(article.price);           // 46.51
console.log(article.store.stockCount); // 12
console.log(article.store.aisle);      // "Elektro, Gang 20"
```

---

## Architektur

* `src/parser.mjs`: Zustandslose Extraktionslogik aus dem Apollo-State (100% offline testbar, keine Browser-Abhängigkeit).
* `src/fetcher.mjs`: Playwright-Browser-Fetcher mit automatischer Cookie-Injektion für Zielmärkte.
* `src/cli.mjs`: Kommandozeilenwerkzeug mit formatierter Konsolen- und JSON-Ausgabe.
* `tests/test-parser.mjs`: Offline-Unit-Test gegen reale GraphQL-Cache-Snapshots.
