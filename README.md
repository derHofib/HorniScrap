# HorniScrap 🛠️

Echtzeit-Preis- und Verfügbarkeitsbeobachtung für HORNBACH-Artikel — inklusive automatischer Filialauswahl und exakter Gang-/Regalplatz-Ermittlung für Handwerksbetriebe.

Entwickelt als eigenständiger Dienst und als **Plugin für [FieldVibe](https://github.com/derHofib/FieldVibe)**.

* 📖 **[Ausarbeitung: Preis- und Verfügbarkeitsdaten von HORNBACH](docs/Ausarbeitung-Hornbach-Preis-und-Verfuegbarkeitsdaten.md)**
* 🔌 **[FieldVibe-Plugin Architektur & Integration](docs/FIELDVIBE_PLUGIN.md)**

---

## Features

* 🔍 **Live-Volltextsuche**: Suche nach Begriffen wie *„FI Schalter 16A“*, *„NYM-J 5x2.5“* oder *„Wago Klemmen“* mit Trefferlisten, Bildern und Bewertungen.
* 📍 **Exakter Regal-Standort**: Zeigt sofort, in welchem Gang des Markts der Artikel liegt (z. B. `📍 Elektro, Gang 20`).
* 🏢 **Programmatische Filialauswahl**: Beliebige Märkte ansteuerbar über First-Party-Cookies (`hbMarketCookie` / `hbMarketSession`).
* 💰 **Preise & Staffelpreise**: Einzelpreise und Mengenrabatte (z. B. ab 6 Stk.).
* 📦 **Bestände & Abholzeiten**: Exakte Stückzahl im Markt und Abholbereitschaft (z. B. *„in 2 Stunden abholbereit“*).
* ⚡ **Integrierter Cache**: 15-Minuten-Cache schützt vor überflüssigen Anfragen und liefert bekannte Treffer in < 5 ms (`X-Cache: HIT`).
* 💻 **Moderne Test-Oberfläche**: Eingebettete Web-UI mit responsivem Raster und Detail-Modal.
* 📡 **REST-API**: Einfache JSON-Schnittstelle für CRM- und ERP-Systeme.

---

## Installation

### Voraussetzungen
* **Node.js** >= 18 (empfohlen: Node 20+)
* **npm**

### 1. Repository klonen & Abhängigkeiten installieren

```bash
git clone git@github.com:derHofib/HorniScrap.git
cd HorniScrap

# Installiert Abhängigkeiten & Playwright Chromium Browser
npm install
```

---

## Verwendung

### A. Web-Oberfläche starten (Empfohlen zum Testen)

```bash
npm start
```

Öffne deinen Browser unter: **[http://localhost:8050](http://localhost:8050)**

Dort kannst du:
* Jeden Suchbegriff oder eine Artikelnummer eingeben
* Die HORNBACH-Wunschfiliale (z. B. Berlin-Mariendorf, Berlin-Neukölln, Frankfurt, München, etc.) auswählen
* Bei jedem Treffer mit einem Klick auf **„📍 Filialbestand & Gang prüfen“** den genauen Regalplatz sehen.

---

### B. Über die Kommandozeile (CLI)

```bash
# 1. Artikel per Artikelnummer und Filiale abfragen
node src/cli.mjs 6072187 --store 609

# 2. Artikel per vollständiger Hornbach-URL abfragen
node src/cli.mjs "https://www.hornbach.de/p/hager-ads916d.../6072187/" --store 616

# 3. Reine maschinenlesbare JSON-Ausgabe (z. B. für Shell-Skripte)
node src/cli.mjs 6072187 --store 609 --json
```

---

### C. Docker

HorniScrap kann direkt als Docker-Container betrieben werden:

```bash
# Mit Docker Compose starten
docker compose up -d --build
```
Der Dienst läuft anschließend unter Port `8050`.

---

## REST-API Schnittstelle

### 1. Such-Endpunkt
```http
GET /api/search?q=<SUCHBEGRIFF>&storeId=<STORE_ID>
```
**Beispiel**: `/api/search?q=fi%20schalter%2016a&storeId=609`

**Antwort**:
```json
{
  "isSingleProduct": false,
  "count": 18,
  "results": [
    {
      "sku": "2730985",
      "title": "ABB F204A-40/0,03 40A 30mA Fehlerstrom Schutzschalter...",
      "price": 33.49,
      "currency": "EUR",
      "unit": "ST",
      "imageUrl": "https://media.hornbach.de/hb/packshot/as.181745431.jpg",
      "rating": { "averageRating": 4.8, "reviewCount": 38 },
      "canReserveInStore": true,
      "canOrderOnline": true
    }
  ]
}
```

### 2. Einzelartikel-Endpunkt
```http
GET /api/article?query=<SKU_ODER_URL>&storeId=<STORE_ID>
```
**Beispiel**: `/api/article?query=6072187&storeId=609`

**Antwort**:
```json
{
  "sku": "6072187",
  "title": "Hager ADS916D 16A Fehlerstrom Leitungsschutzschalter FI B 30mA",
  "brand": "Hager",
  "ean": "3250611068143",
  "price": 46.51,
  "currency": "EUR",
  "unit": "ST",
  "tierPrices": [
    { "minAmount": 6, "price": 42.32, "unit": "ST", "currency": "EUR" }
  ],
  "online": {
    "canOrder": true,
    "deliveryTimeText": "Lieferzeit ca. 2 Werktage"
  },
  "store": {
    "storeId": "609",
    "name": "HORNBACH Berlin-Mariendorf",
    "city": "Berlin-Mariendorf",
    "inStock": true,
    "stockCount": 12,
    "availabilityText": "12 ST im Markt vorrätig",
    "pickupTimeText": "in 2 Stunden abholbereit",
    "aisle": "Elektro, Gang 20"
  }
}
### 3. Multi-Store Umkreisvergleich
```http
GET /api/article/multi-store?query=<SKU_ODER_URL>&stores=<CLUSTER_ODER_IDS>
```
**Beispiel**: `/api/article/multi-store?query=6072187&stores=berlin`

Vergleicht parallel alle Filialen einer Region (oder kommagetrennte Markt-IDs) und liefert Bestände, Gangplätze und 1-Klick-Reservierungs-Links.

---

### 4. GPS-Filialsuche & Entfernungsberechnung
```http
GET /api/stores/nearest?lat=<LAT>&lng=<LNG>&limit=5
```
**Beispiel**: `/api/stores/nearest?lat=52.52&lng=13.41&limit=3`

Ermittelt anhand der GPS-Koordinaten (z. B. Smartphone des Monteurs oder Baustellenadresse aus FieldVibe) die nächstgelegenen HORNBACH-Märkte mit genauer km-Entfernung nach der Haversine-Formel.

---

## Integration als FieldVibe-Plugin

In [FieldVibe](https://github.com/derHofib/FieldVibe) lässt sich HorniScrap als modulares Plugin aktivieren:
1. HorniScrap in `docker-compose.yml` als Service einbinden.
2. Im FieldVibe-Mandanten das Modul-Flag `"hornbach"` aktivieren.
3. Im Vorgang (`MaterialBedarf`) und Materialstamm steht automatisch die HORNBACH-Echtzeitsuche zur Verfügung.

Ausführliche Implementierungsdetails und Code-Snippets siehe **[docs/FIELDVIBE_PLUGIN.md](docs/FIELDVIBE_PLUGIN.md)**.
