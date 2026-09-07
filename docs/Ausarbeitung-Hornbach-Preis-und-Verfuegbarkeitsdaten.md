# Ausarbeitung: Preis- und Verfügbarkeitsdaten von HORNBACH

**Projekt:** HorniScrap
**Stand:** 2026-09-03 (Nachtrag Abschnitt 2b: Machbarkeitstest aus echtem Netz)
**Status:** Konzept / Entscheidungsvorlage — noch keine Implementierung

---

## 1. Ziel und Fragestellung

Erfasst werden sollen für einen definierten Artikelkorb:

1. **Preise** (Online-Preis, ggf. Markt-/Aktionspreis, Grundpreis je Einheit) im Zeitverlauf
2. **Verfügbarkeit** — online lieferbar *und* Bestand je HORNBACH-Markt (Filiale)

Typische Anwendungsfälle dahinter: Preisbeobachtung für den Eigeneinkauf, Wettbewerbs-/Sortimentsbeobachtung, Beschaffungsplanung („in welchem Markt liegt Artikel X heute?"). Der Anwendungsfall bestimmt die rechtliche Bewertung mit (Abschnitt 3) und die zumutbare Abfragefrequenz (Abschnitt 7) — er sollte vor Baubeginn festgelegt sein.

---

## 2. Technischer Befund (eigene Messung, 2026-09-02)

Vor der Konzeption wurde geprüft, ob die HORNBACH-Websites automatisiert abrufbar sind. Ergebnis:

| Abruf | HTTP-Status | Antwort |
|---|---|---|
| `https://www.hornbach.de/robots.txt` | 200 | `<title>Client Challenge</title>`, 3038 Bytes |
| `https://www.hornbach.de/sitemap.xml` | 200 | identische Challenge-Seite |
| `https://www.hornbach.de/s/<suchbegriff>` | 200 | identische Challenge-Seite |
| `https://www.hornbach.de/p/<produkt>/` | 200 | identische Challenge-Seite |
| `hornbach.at` / `.ch` / `.nl` — `robots.txt` | 200 | identische Challenge-Seite |

**Interpretation:**

- Die Seiten liefern **kein** HTML des Shops, sondern eine JavaScript-Challenge unter dem Pfadpräfix `/_fs-ch-…/` mit strenger Content-Security-Policy. Das ist die Signatur von **F5 Distributed Cloud Bot Defense** (vormals Shape Security).
- Der Schutz greift **site-weit und länderübergreifend**, nicht nur auf Produktseiten.
- Er greift **sogar auf `robots.txt`**. Das ist die praktisch wichtigste Beobachtung: Die maschinenlesbare Erlaubnisdatei ist für Maschinen nicht abrufbar. Ein Crawler kann seine Erlaubnis also nicht regelkonform ermitteln, und der Betreiber signalisiert durch den flächendeckenden Schutz unmissverständlich, dass er automatisierten Zugriff nicht wünscht.
- Ein Abruf mit echtem Chromium (Playwright) war aus dieser Umgebung heraus nicht möglich (`ERR_CONNECTION_RESET` am Egress-Proxy). Ob ein normaler Browser die Challenge löst, ist damit hier **nicht** gemessen — im Alltag tut er es offensichtlich, sonst wäre der Shop unbenutzbar.

**Konsequenzen für die Architektur:**

1. Ein klassischer HTTP-Scraper (`requests`/`httpx` + HTML-Parser) funktioniert **nicht** und wird auch nicht funktionieren. Jede Planung, die darauf aufbaut, ist hinfällig.
2. Die im Netz kursierenden Beschreibungen von HORNBACH-Produktseiten (JSON-LD im `<head>`, interne JSON-Endpunkte für Marktverfügbarkeit) konnten hier **nicht verifiziert** werden. Sie sind im Folgenden als *unverifiziert* markiert und müssen vor einer Implementierung an einer echten Session geprüft werden.
3. Der aktive Bot-Schutz verschiebt die Fragestellung: Es geht nicht mehr um „wie parse ich das HTML", sondern um **„aus welcher Quelle beziehe ich die Daten legitim"**. Deshalb steht Abschnitt 4 vor der Technik.

> **Abgrenzung:** Diese Ausarbeitung beschreibt bewusst **keine** Techniken zur Umgehung des Bot-Schutzes (Fingerprint-Spoofing, CAPTCHA-Solver-Dienste, Rotation über Residential-Proxys). Das wäre technisch beschreibbar, ist aber rechtlich riskant (Abschnitt 3), betrieblich instabil (jede Gegenmaßnahme des Betreibers bricht die Pipeline) und gegenüber dem Seitenbetreiber unfair. Die empfohlenen Wege kommen ohne aus.

---

## 2b. Nachtrag: Machbarkeitstest aus echtem Netz (2026-09-03)

Der in Abschnitt 2 offengelassene Punkt wurde nachgeholt: `tools/machbarkeitstest/check.mjs` gegen eine reale Produktseite ausgeführt, aus einem normalen Heim-/Büronetz (nicht der Cloud-Sandbox dieser Ausarbeitung). Artikel: `hager-ads916d-16a-fehlerstrom-leitungsschutzschalter-fi-b-30ma/6072187`.

| Frage | Ergebnis |
|---|---|
| **F1** — Kommt ein echter (sichtbarer) Browser durch? | ✅ Ja, nach 15,75 s |
| **F2** — `robots.txt` lesbar, sobald Session besteht? | ✅ Ja |
| **F3** — Preis maschinenlesbar? | ✅ Ja, JSON-LD: `46.51` |
| **F4** — Auch headless (unbeaufsichtigter Serverbetrieb)? | ❌ **Nein** — Titel bleibt „Client Challenge" |

**Der wichtigste Einzelbefund steckt in `robots.txt`, nicht in F1.** Sie schließt `/p/`-Produktseiten **nicht** aus, verbietet aber namentlich `/frontend/`:

```
User-agent: *
Disallow: /checkout
Disallow: /customer/
Disallow: /cart/
Disallow: /wishlist/
Disallow: /contact/
Disallow: /comparison/
Disallow: /hornbach/cms/
Disallow: /ordertracking/
Disallow: /customer-purchases/
Disallow: /frontend/
```

Der Netzwerkmitschnitt zeigt genau dorthin einen Aufruf:

```
200 POST https://www.hornbach.de/frontend/query?operationName=PriceAndDeliveryInfo
200 GET  https://svc.hornbach.de/cmscontent-service/store?...&storeId=616
```

`PriceAndDeliveryInfo` ist mutmaßlich auch die Quelle für Filialbestände (Abschnitt 6) — und der einzige beobachtete Pfad, den der Betreiber maschinenlesbar ausgeschlossen hat. Das ist der in Abschnitt 3.2 beschriebene TDM-Vorbehalt (§ 44b Abs. 3 UrhG) nicht mehr als Vermutung, sondern als konkreter Befund. Daraus folgen zwei technisch mögliche, rechtlich aber unterschiedlich zu bewertende Wege:

- **Produktseite laden, Preis aus eingebettetem JSON-LD lesen** (Pfad `/p/…`) — von `robots.txt` **nicht** ausgeschlossen. Das ist der Weg, den der Test verwendet hat, und er liefert einen sauberen, strukturierten Preis.
- **`/frontend/query` direkt ansprechen** — von `robots.txt` **explizit ausgeschlossen**. Sollte nicht gebaut werden, auch wenn er technisch einfacher wäre und vermutlich auch Bestandsdaten liefert.

**F4 ist der praktisch entscheidende Befund für Phase 4.** Der Bot-Schutz unterscheidet zwischen sichtbarem und `headless`-Chromium und blockt Letzteres. Ein unbeaufsichtigter Serverjob in der getesteten Form ist damit **nicht** möglich — nicht am Preis scheitert Phase 4, sondern am Betrieb. Ein legitimer, nicht als Umgehung zu wertender nächster Test: echtes, sichtbares Chromium unter einem virtuellen Display (`Xvfb`) auf einem Server, wie es in CI-Pipelines Standard ist — das verändert am Browser nichts, nur den Zielort des Fensters. Bislang nicht getestet.

**Preis-Mehrdeutigkeit geklärt** (Rohdatei ausgewertet, 2026-09-03): `46,51 €` ist der Stückpreis. `42,32 €` ist ein Staffelpreis — „Preis — 42,32 € * … Abnahme von 6 ST", also der Preis ab 6 Stück Mengenrabatt. `49,00 €` ist **kein Produktpreis**, sondern der Liefer-Mindestbestellwert des Markts („Vom Markt liefern lassen (ab 49,00 €)"). `5,70 €` sind Versandkosten. Für das Domänenmodell (Abschnitt 5.2) heißt das: `PriceObservation` braucht ein Feld für die Staffelmenge, sonst wird der 6er-Preis fälschlich als Einzelpreis übernommen.

**Bestand ist bereits strukturiert vorhanden — ohne den gesperrten Endpunkt.** Die Produktseite (`/p/…`) rendert serverseitig ein `<script>window.__ARTICLE_DETAIL_APOLLO_STATE__ = {…}</script>` — den Apollo-GraphQL-Cache, mit dem die Seite clientseitig weiterrendert. Darin, für den aktuell gewählten Markt (hier automatisch „HORNBACH Berlin-Neukölln", `storeId: "616"`):

```json
"availabilityText": "10 ST im Markt vorrätig",
"deliveryTimeText": "in 2 Stunden abholbereit",
"locationText": "Elektro, Gang 10",
"defaultPrice": { "price": 46.51, "unit": "ST", "currency": "€" }
```

Das ist **kein Fließtext-Fund mehr, sondern ein reguläres JSON-Feld mit exakter Stückzahl**, dazu Regal-Standort und Abholzeit — und es steht im selben, von `robots.txt` erlaubten Dokument wie der Preis. Der zuvor als notwendig angenommene Aufruf von `/frontend/query` (verboten, Abschnitt 2b) ist für den **aktuell zugeordneten Markt** also gar nicht nötig; ein Parser, der `__ARTICLE_DETAIL_APOLLO_STATE__` aus der Seite zieht, bekommt Preis, Staffelpreis und Filialbestand in einem erlaubten Abruf.

**Offen blieb die Marktwahl.** Der Store `616` wurde nicht explizit angefordert — kein Cookie- oder Query-Parameter dafür war im ersten Seitenaufruf sichtbar. Das wurde im Nachtrag 2c erfolgreich geklärt.

---

## 2c. Nachtrag: Marktwahl programmatisch per Cookie gelöst (2026-09-07)

Die in Abschnitt 2b offengebliebene Frage zur Marktwahl wurde mit dem Testskript `test-cookie-store.mjs` aus einem realen Browserlauf verifiziert.

**Ergebnis:**
Die Filialauswahl bei HORNBACH wird **vollständig über zwei einfache First-Party-Cookies** gesteuert:

1. `hbMarketCookie` = `"<storeId>"` (z. B. `"609"`)
2. `hbMarketSession` = `"<storeId>"` (z. B. `"609"`)

**Verifizierung:**
Wird ein komplett isolierter, neuer Browser-Kontext geöffnet und werden vor dem Aufruf der Produktseite lediglich diese beiden Cookies für `www.hornbach.de` gesetzt, rendert der Shop serverseitig direkt den Apollo-Cache für den gewünschten Zielmarkt:

```json
{
  "storeId": "609",
  "name": "HORNBACH Berlin-Mariendorf",
  "availabilityText": "12 ST im Markt vorrätig",
  "deliveryTimeText": "Lieferzeit ca. 2 Werktage",
  "locationText": "Elektro, Gang 20"
}
```

*Vergleich zur Default-Filiale 616 (Berlin-Neukölln):*
* In Markt 616 lag der Hager-Schalter in **Gang 10**.
* In Markt 609 liegt er nachweislich in **Gang 20**.

**Konsequenz für das Projekt:**
* Abschnitt 6 (Marktradius / Filialvergleich) ist **vollständig technisch abbildbar**.
* Es sind keine UI-Klicks, keine Geolocation-Manipulation und keine Server-Sessions erforderlich.
* Ein einzelner Abruf mit übergebenen Cookies liefert für jede beliebige Filiale sofort den exakten Filialbestand, die Abholzeit und den Regalplatz vor Ort.

---

## 3. Rechtliche Einordnung (Deutschland/EU)

*Keine Rechtsberatung. Bei kommerzieller Nutzung vor Produktivbetrieb anwaltlich prüfen lassen.*

### 3.1 Was unproblematisch ist

- **Einzelne Preise als Fakten** sind nicht urheberrechtlich geschützt. Preisbeobachtung ist als solche zulässig und im Handel gängige Praxis.
- **Text- und Data-Mining, § 44b UrhG:** Vervielfältigungen rechtmäßig zugänglicher Werke zum TDM sind erlaubt — **aber** der Rechteinhaber kann bei online zugänglichen Inhalten einen **maschinenlesbaren Nutzungsvorbehalt** erklären (§ 44b Abs. 3 UrhG). Ein Nutzungsvorbehalt steckt typischerweise in `robots.txt`, den AGB und, mit guten Argumenten, auch in einem aktiv betriebenen Bot-Schutz.
- **DSGVO** ist hier praktisch nicht betroffen: Preise und Filialbestände sind keine personenbezogenen Daten. Relevant würde sie erst bei Bewertungen, Verkäufernamen (Marktplatz) o. ä.

### 3.2 Was Risiko trägt

| Norm | Risiko im konkreten Fall |
|---|---|
| **§§ 87a–87e UrhG (Datenbankherstellerrecht)** | Der Produktkatalog ist eine geschützte Datenbank. Untersagt ist die Entnahme *„nach Art und Umfang wesentlicher Teile"* sowie die wiederholte, systematische Entnahme unwesentlicher Teile, die einer normalen Auswertung zuwiderläuft (§ 87b Abs. 1 S. 2). **Genau das ist ein Dauer-Crawl über das Gesamtsortiment.** Ein enger Artikelkorb (Dutzende bis wenige Hundert Artikel) ist deutlich besser vertretbar als ein Vollabzug. |
| **§ 44b Abs. 3 UrhG** | Wirksamer Nutzungsvorbehalt ⇒ die TDM-Schranke greift nicht. Da `robots.txt` nicht abrufbar ist, kann ein Vorbehalt nicht ausgeschlossen werden — im Zweifel ist von seiner Existenz auszugehen. |
| **§ 3, § 4 Nr. 4 UWG** | Bei Handeln als Mitbewerber: gezielte Behinderung. Der BGH hat Scraping im Wettbewerbsverhältnis (*„Automobil-Onlinebörse"*) nicht per se untersagt, aber die Grenze u. a. beim Überwinden technischer Schutzmaßnahmen und bei Belastung der fremden Infrastruktur gezogen. |
| **Vertrag / AGB** | Die Nutzungsbedingungen untersagen automatisiertes Auslesen typischerweise ausdrücklich. Bindungswirkung ohne Registrierung ist umstritten, das Risiko einer Abmahnung besteht praktisch trotzdem. |
| **§ 202a StGB (Ausspähen von Daten)** | Die schärfste Norm hier. Sie setzt Daten voraus, die *„gegen unberechtigten Zugang besonders gesichert"* sind, und deren Zugangserlangung *unter Überwindung der Sicherung*. Ob ein Bot-Schutz vor öffentlich abrufbaren Inhalten eine Zugangssicherung in diesem Sinne ist, ist umstritten und höchstrichterlich nicht geklärt. **Wer die Challenge gezielt umgeht, bewegt sich in dieser Grauzone — wer sie mit einem echten Browser in menschlichem Tempo passiert, deutlich weniger.** Das ist der Hauptgrund für die Abgrenzung am Ende von Abschnitt 2. |

### 3.3 Praktische Leitplanken

1. **Artikelkorb statt Vollabzug.** Nur beobachten, was tatsächlich gebraucht wird.
2. **Keine Umgehung von Schutzmaßnahmen**, keine Solver-Dienste, keine Proxy-Rotation zur Verschleierung.
3. **Menschliches Tempo.** Ein Abruf pro Artikel und Tag reicht für Preisbeobachtung fast immer; Verfügbarkeit ggf. häufiger, aber gezielt.
4. **Keine Weiterverbreitung** der Rohdaten, kein öffentlicher Preisvergleich aus fremden Daten, keine Wiederveröffentlichung des Katalogs.
5. **Identifizierbar bleiben**, wo möglich (eigener User-Agent mit Kontaktadresse) statt sich zu tarnen.
6. **Abschaltknopf.** Ein Kontakt des Betreibers muss die Pipeline sofort stoppen können.

---

## 4. Datenquellen — Optionen und Bewertung

| # | Quelle | Preis | Verfügbarkeit online | Bestand je Markt | Rechtslage | Aufwand | Laufende Kosten |
|---|---|---|---|---|---|---|---|
| **A** | **Affiliate-Produktfeed (Awin o. ä.)** | ✅ | ⚠️ teilweise | ❌ | ✅ sauber lizenziert | gering | 0 € (Programmteilnahme nötig) |
| **B** | **Preisvergleichs-/Shopping-APIs** (idealo, billiger.de, Google Shopping Content API) | ✅ | ⚠️ | ❌ | ✅ | mittel | teils kostenpflichtig |
| **C** | **Kommerzielle Scraping-Anbieter** (ShoppingScraper, getrealprice u. a.) | ✅ | ✅ | ⚠️ anbieterabhängig | ⚠️ Risiko verlagert, nicht beseitigt | gering | ab ca. 50–500 €/Monat |
| **D** | **Direkte Anfrage bei HORNBACH** (Partner-/Marktplatz-/Data-Sharing) | ✅ | ✅ | ✅ | ✅ optimal | Vertriebs-/Vertragsaufwand | verhandelbar |
| **E** | **Eigenes Browser-Scraping** (Playwright, menschliches Tempo) | ✅ | ✅ | ✅ | ⚠️ Grauzone (Abschnitt 3) | hoch | Infrastruktur + Pflege |

### Bewertung im Detail

**A — Affiliate-Feed.** Der sauberste Einstieg. HORNBACH betreibt Affiliate-Aktivitäten; Produktdatenfeeds über Netzwerke wie Awin liefern Preis, Grundpreis, EAN, Kategorie und meist ein Verfügbarkeitsflag als CSV/XML, typischerweise täglich aktualisiert. **Grenze: keine filialbezogenen Bestände.** Wer nur Preisverläufe braucht, ist hiermit fertig — ohne jedes Rechtsrisiko und ohne Bot-Schutz-Problem. Voraussetzung ist die Aufnahme als Publisher ins Partnerprogramm; das ist eine Anmeldung, kein Projekt.

**B — Shopping-APIs.** Sinnvoll als Ergänzung/Kreuzvalidierung, insbesondere wenn ohnehin mehrere Händler verglichen werden sollen (Preisverlauf HORNBACH vs. OBI vs. Bauhaus). Ebenfalls ohne Filialbestände.

**C — Fertiganbieter.** Es existieren spezialisierte Dienste, die HORNBACH-Daten als Service liefern. Vorteil: sofort lauffähig, Bot-Schutz ist deren Problem. Nachteil: Die rechtliche Frage aus Abschnitt 3 ist damit ausgelagert, aber nicht beantwortet — wer die Daten nutzt, sollte sich die Rechtekette zusichern lassen. Kosten skalieren mit Artikelzahl und Frequenz.

**D — Direkte Anfrage.** Wird regelmäßig übersprungen und ist oft der kürzeste Weg. Für Handwerksbetriebe, Wiederverkäufer und Marktplatzhändler gibt es etablierte Datenkanäle; HORNBACH betreibt einen Marktplatz mit Händleranbindung (u. a. über ChannelEngine/Base.com), also existieren produktive Schnittstellen. Eine Mail an Partner-Management/Einkauf kostet einen Nachmittag und kann das gesamte Projekt erübrigen.

**E — Eigenes Browser-Scraping.** Liefert als Einzige zuverlässig **Marktbestände**, und die sind der eigentliche Mehrwert gegenüber jedem Feed. Technisch machbar mit echtem Browser in menschlichem Tempo, aber: laufender Pflegeaufwand, mögliche Blockade jederzeit, rechtliche Grauzone.

### Empfehlung

**Zweistufig vorgehen:**

- **Stufe 1 (sofort, risikofrei):** Option **A** für Preise, parallel Anfrage nach **D**. Damit steht die komplette Pipeline — Modell, Speicher, Auswertung, Alerting — auf einer sauberen Datenbasis. Das ist ohnehin 80 % der Arbeit und quellenunabhängig.
- **Stufe 2 (nur falls Marktbestände wirklich gebraucht werden):** Entscheidung zwischen **C** (einkaufen) und **E** (selbst bauen, eng begrenzt auf den Artikelkorb, nach anwaltlicher Prüfung).

Der Architekturvorschlag in Abschnitt 5 ist deshalb **quellenagnostisch**: Der Datenlieferant ist ein austauschbarer Adapter, nicht das Fundament.

---

## 5. Architektur

### 5.1 Prinzip

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  Scheduler   │──▶│   Adapter    │──▶│ Normalizer   │──▶│    Store     │
│ (Was, wann?) │   │ (Quelle X)   │   │ (Validierung)│   │ (Append-only)│
└──────────────┘   └──────────────┘   └──────────────┘   └──────┬───────┘
                          ▲                                     │
             ┌────────────┼────────────┐               ┌────────▼───────┐
             │            │            │               │  Diff/Alert    │
        AwinFeed   ScrapeVendor   BrowserAdapter       │  Export/API    │
                                                       └────────────────┘
```

Kern der Entkopplung ist ein schmales Adapter-Interface. Jede Quelle aus Abschnitt 4 implementiert dasselbe:

```python
class PriceSource(Protocol):
    name: str

    def fetch_offers(self, skus: Sequence[Sku]) -> Iterable[RawOffer]:
        """Liefert Rohbeobachtungen. Wirft SourceUnavailable bei Blockade."""

    def fetch_store_stock(
        self, sku: Sku, stores: Sequence[StoreId]
    ) -> Iterable[RawStock]:
        """Optional. NotImplementedError, wenn die Quelle keine Märkte kennt."""
```

Damit ist ein Wechsel von Awin-Feed auf einen Fertiganbieter oder auf eigenes Scraping eine Adapterklasse, kein Umbau.

### 5.2 Domänenmodell

```python
from datetime import datetime
from decimal import Decimal
from enum import Enum
from pydantic import BaseModel

class Product(BaseModel):
    sku: str                  # HORNBACH-Artikelnummer, Primärschlüssel
    ean: str | None           # für Cross-Händler-Abgleich
    title: str
    brand: str | None
    category_path: list[str]
    url: str

class PriceObservation(BaseModel):
    sku: str
    observed_at: datetime     # UTC
    source: str               # "awin" | "vendor_x" | "browser"
    price: Decimal            # brutto, EUR
    currency: str = "EUR"
    base_price: Decimal | None   # Grundpreis
    base_unit: str | None        # "m²", "l", "kg", "Stk"
    promo: bool = False          # Aktionspreis erkannt
    raw_hash: str                # Hash der Rohantwort für Nachvollziehbarkeit

class StockLevel(str, Enum):
    IN_STOCK = "in_stock"
    LOW = "low"               # "nur noch wenige"
    OUT_OF_STOCK = "out_of_stock"
    UNKNOWN = "unknown"

class StoreAvailability(BaseModel):
    sku: str
    store_id: str             # HORNBACH-Marktnummer
    observed_at: datetime
    level: StockLevel
    quantity: int | None      # falls die Quelle Stückzahlen liefert
```

**Wichtig: `PriceObservation` und `StoreAvailability` sind append-only.** Niemals ein Preisfeld überschreiben — der Zeitverlauf *ist* das Produkt. Verdichtung passiert beim Lesen, nicht beim Schreiben.

### 5.3 Speicher

PostgreSQL reicht bis weit in den Millionenbereich an Beobachtungen; TimescaleDB erst, wenn es weh tut. Für einen Artikelkorb von 500 Artikeln × 1 Beobachtung/Tag sind das 180 k Zeilen/Jahr — SQLite genügt.

```sql
CREATE TABLE product (
    sku            TEXT PRIMARY KEY,
    ean            TEXT,
    title          TEXT NOT NULL,
    brand          TEXT,
    category_path  TEXT[],
    url            TEXT NOT NULL,
    first_seen     TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE price_observation (
    id           BIGSERIAL PRIMARY KEY,
    sku          TEXT NOT NULL REFERENCES product(sku),
    observed_at  TIMESTAMPTZ NOT NULL,
    source       TEXT NOT NULL,
    price_cents  INTEGER NOT NULL CHECK (price_cents >= 0),
    base_price_cents INTEGER,
    base_unit    TEXT,
    promo        BOOLEAN NOT NULL DEFAULT false,
    raw_hash     TEXT NOT NULL
);
CREATE INDEX ON price_observation (sku, observed_at DESC);

-- Entprellung: identische Folgebeobachtung nicht doppelt speichern
CREATE UNIQUE INDEX price_dedup
    ON price_observation (sku, source, price_cents, promo, observed_at);

CREATE TABLE store_availability (
    id           BIGSERIAL PRIMARY KEY,
    sku          TEXT NOT NULL REFERENCES product(sku),
    store_id     TEXT NOT NULL,
    observed_at  TIMESTAMPTZ NOT NULL,
    level        TEXT NOT NULL,
    quantity     INTEGER
);
CREATE INDEX ON store_availability (sku, store_id, observed_at DESC);

-- Protokoll jedes Abrufversuchs, auch der gescheiterten
CREATE TABLE fetch_log (
    id           BIGSERIAL PRIMARY KEY,
    started_at   TIMESTAMPTZ NOT NULL,
    source       TEXT NOT NULL,
    target       TEXT NOT NULL,
    outcome      TEXT NOT NULL,   -- ok | blocked | parse_error | timeout
    http_status  INTEGER,
    duration_ms  INTEGER,
    note         TEXT
);
```

Das `fetch_log` ist kein Beiwerk: Ohne es lässt sich später nicht unterscheiden, ob ein Artikel *nicht verfügbar* war oder *nicht abgerufen werden konnte*. Diese Verwechslung ruiniert jede Auswertung.

### 5.4 Tech-Stack-Vorschlag

| Baustein | Empfehlung | Alternative |
|---|---|---|
| Sprache | Python 3.12 | TypeScript/Node |
| HTTP (Feeds) | `httpx` | `requests` |
| Browser (nur Option E) | `playwright` | `selenium` |
| Validierung | `pydantic` v2 | `attrs` + `cattrs` |
| DB-Zugriff | `SQLAlchemy` 2.x + `alembic` | rohes SQL |
| Scheduling | `APScheduler` (klein) / `Prefect` (mit Retry-UI) | Cron + Skript |
| Auswertung | `pandas` + Streamlit-Dashboard | Grafana auf Postgres |
| Tests | `pytest` + gespeicherte Fixtures (echte Rohantworten) | — |

**Gespeicherte Rohantworten als Test-Fixtures sind nicht optional.** Parser für fremdes HTML brechen bei jedem Redesign; nur mit Fixtures ist ein Bruch in Minuten statt Stunden repariert.

---

## 6. Sonderproblem Marktverfügbarkeit

Der Filialbestand ist der wertvollste Teil der Daten und zugleich der teuerste.

**Kombinatorik:** HORNBACH betreibt rund 170 Märkte (DE + AT/CH/NL/LU/CZ/RO/SK/SE). Artikelkorb × Märkte explodiert:

| Artikel | Märkte | Abrufe je Durchlauf |
|---|---|---|
| 50 | 5 (Umkreis) | 250 |
| 50 | 170 (alle) | 8 500 |
| 500 | 170 | 85 000 |

Bei menschlichem Tempo (Abschnitt 3.3) ist die letzte Zeile schlicht nicht durchführbar — und wäre als systematische Entnahme auch rechtlich am wenigsten haltbar.

**Konsequente Eingrenzung:**

1. **Marktradius definieren** — realistisch 3–8 Märkte, die tatsächlich angefahren werden. Das reduziert die Last um Faktor 20–50.
2. **Nur bewegliche Artikel häufig prüfen.** Ein Artikel, der seit 30 Tagen konstant verfügbar ist, braucht keine stündliche Prüfung. Adaptive Frequenz: bei Wechsel des Zustands Frequenz hoch, bei Stabilität herunter.
3. **Preis und Bestand entkoppeln.** Preise kommen aus dem Feed (Option A, billig), Bestände nur für eine engere Teilmenge.

**Technisch — teilweise verifiziert durch den Machbarkeitstest (Abschnitt 2b):** Der Bestand wird per GraphQL-Aufruf `PriceAndDeliveryInfo` an `/frontend/query` nachgeladen, parallel ein Marktabruf an `svc.hornbach.de/cmscontent-service/store?storeId=616`. **Beide sind für dieses Vorhaben keine gangbare Datenquelle** — nicht weil sie technisch nicht erreichbar wären, sondern weil `/frontend/` in `robots.txt` namentlich ausgeschlossen ist (Abschnitt 2b). Ein direkter Aufruf dieses Endpunkts widerspricht dem erklärten Vorbehalt des Betreibers.

**Nachtrag (Rohdatei ausgewertet, 2026-09-03): besser als angenommen.** Was bleibt, ist kein Fließtext, sondern ein reguläres JSON-Feld: Die `/p/`-Produktseite rendert serverseitig `window.__ARTICLE_DETAIL_APOLLO_STATE__` mit `"availabilityText": "10 ST im Markt vorrätig"` — exakte Stückzahl, dazu Regal-Standort und Abholzeit, für den dem Aufruf zugeordneten Markt (`storeId`, hier automatisch „HORNBACH Berlin-Neukölln"/616). Details in Abschnitt 2b.

Damit ist die Bestandsfrage nicht mehr „Fließtext parsen, unstrukturiert", sondern „ein JSON-Blob aus einem `<script>`-Tag extrahieren" — technisch deutlich robuster und im selben, von `robots.txt` erlaubten Abruf wie der Preis enthalten.

**Was weiterhin offen ist und den Marktradius-Fall entscheidet:** Wie wird der Markt gezielt gesetzt? Im Test kam `storeId: "616"` ohne erkennbaren Cookie- oder Query-Parameter zustande — vermutlich IP-/Standort-basiert. Für einen einzelnen, festen Markt (z. B. der Stammmarkt) ist das kein Problem. Für „Bestand in 5 definierten Märkten vergleichen" (die Eingrenzung oben) ist noch zu klären, ob sich der Markt pro Abruf explizit wählen lässt — und falls nicht, ob mehrere physische Anfragen aus unterschiedlicher Herkunft nötig wären, was den Aufwand wieder in Richtung der ursprünglichen Kombinatorik-Tabelle verschiebt.

---

## 7. Betriebskonzept

### Frequenz

| Datum | Empfohlene Frequenz | Begründung |
|---|---|---|
| Preis (Feed) | 1×/Tag | Feeds werden ohnehin nur täglich erneuert |
| Preis (Scraping) | 1×/Tag, nachts verteilt | mehr bringt keinen Erkenntnisgewinn |
| Verfügbarkeit | 1–4×/Tag, adaptiv | Bestände ändern sich innertägig |
| Aktionen/Prospekte | wöchentlich | Aktionszyklus |

Abrufe **gleichmäßig über das Zeitfenster verteilen**, nicht als Burst. Ein Burst ist das, was Bot-Schutz und Betreiber gleichermaßen stört; 500 Abrufe über 8 Stunden sind ein Abruf pro Minute und für die Gegenseite unsichtbar.

### Fehlerklassen und Reaktion

| Klasse | Erkennung | Reaktion |
|---|---|---|
| **Blockiert** | Challenge-Seite, 403, leerer Body | **Sofort stoppen**, exponentielles Backoff, Alarm. Nicht aggressiv weiterversuchen. |
| **Struktur geändert** | Parser findet Pflichtfeld nicht | Rohantwort sichern, Artikel überspringen, Alarm; Fixture aktualisieren |
| **Netzwerk/Timeout** | Exception | 3× Retry mit Backoff, dann als `timeout` protokollieren |
| **Unplausibler Wert** | Preis 0, Sprung > 60 % | Beobachtung als `suspect` markieren, nicht verwerfen, manuell prüfen |

Die erste Zeile ist die wichtigste Betriebsregel des Projekts: **Blockade heißt anhalten, nicht härter probieren.**

### Datenqualität

- **Grundpreis validieren:** `base_price ≈ price / menge` — deckt Einheiten-Parsingfehler zuverlässig auf.
- **Aktionspreise markieren**, nicht glattziehen. Ein Preisverlauf ohne Aktionskennzeichnung ist für Beschaffungsentscheidungen wertlos.
- **Währung und Land immer mitführen** (AT/CH-Preise sind nicht vergleichbar).
- **Nichts löschen.** Fehlerhafte Beobachtungen markieren; ein Filter beim Lesen ist reversibel, ein `DELETE` nicht.

---

## 8. Roadmap

| Phase | Inhalt | Aufwand | Ergebnis |
|---|---|---|---|
| **0 — Klärung** | Anwendungsfall festschreiben, Artikelkorb + Marktradius definieren, Anfrage an HORNBACH (Option D), Awin-Anmeldung (Option A) | 1–2 Tage, davon 0 Entwicklung | Entscheidungsgrundlage, ggf. erübrigt sich Phase 3 |
| **1 — Fundament** | Domänenmodell, DB-Schema + Migrationen, `fetch_log`, Adapter-Interface, Test-Setup | 2–3 Tage | lauffähiges Skelett, quellenunabhängig |
| **2 — Erste Quelle** | Awin-Feed-Adapter, Normalisierung, tägliche Ingestion, Grundpreis-Validierung | 2–3 Tage | **Preisverläufe produktiv** |
| **3 — Auswertung** | Diff-Erkennung, Alerting (Preis fällt unter Schwelle), Streamlit-/Grafana-Dashboard, CSV-Export | 2–3 Tage | nutzbares Produkt |
| **4 — Verfügbarkeit** *(nur nach Entscheidung C vs. E)* | Bestandsadapter, Marktstammdaten, adaptive Frequenz, Blockade-Handling | 5–10 Tage | Filialbestände |
| **5 — Betrieb** | Containerisierung, Scheduler, Monitoring, Backup, Abschaltknopf | 2–3 Tage | Dauerbetrieb |

**Phasen 1–3 sind unabhängig von der Quellenentscheidung** und können sofort beginnen. Phase 4 ist die einzige, die Abschnitt 3 und 4 wirklich braucht — und die einzige, die man sich unter Umständen sparen kann.

---

## 9. Zu entscheiden

Diese Punkte kann die Ausarbeitung nicht ersetzen:

1. **Anwendungsfall:** privat/intern oder kommerziell/Wettbewerbsbeobachtung? (bestimmt die rechtliche Bewertung)
2. **Werden Marktbestände wirklich gebraucht** oder reichen Preise + Online-Verfügbarkeit? (bestimmt, ob Phase 4 überhaupt stattfindet)
3. **Artikelkorb:** Größenordnung 10, 100 oder 10 000 Artikel?
4. **Marktradius:** welche Filialen konkret?
5. **Bei Bedarf an Beständen:** Fertiganbieter einkaufen (C) oder selbst bauen (E)?
6. **Zielland:** nur DE oder auch AT/CH?

---

## Anhang A — Messprotokoll

```
Datum:    2026-09-02
Werkzeug: curl 8.x, UA=Chrome/140 (Windows), Accept-Language: de-DE
Ergebnis: Alle geprüften URLs auf hornbach.de/.at/.ch/.nl antworten mit
          HTTP 200 und einem identischen 3038-Byte-Dokument
          <title>Client Challenge</title>, Assets unter /_fs-ch-<token>/,
          CSP: default-src 'self'; script-src 'self' 'sha256-…'
          => F5 Distributed Cloud Bot Defense, site-weit, inkl. robots.txt

Playwright/Chromium: nicht auswertbar (ERR_CONNECTION_RESET am Egress-Proxy
          dieser Umgebung, kein Rückschluss auf das Verhalten der Seite)
```

## Anhang B — Quellen

- [Awin — Produktdatenfeeds](https://www.awin.com/de/mit-awin-arbeiten/produktdatenfeed)
- [Awin — Produktdatenfeeds für Fortgeschrittene](https://www.awin.com/de/mit-awin-arbeiten/produktdatenfeed-publisher-modelle)
- [ShoppingScraper — Hornbach Price and Data Scraper](https://shoppingscraper.com/scrapers/hornbach)
- [getrealprice — Hornbach price monitoring](https://getrealprice.com/hornbach-de-goppingen-data-scraping-price-monitoring)
- [ChannelEngine — HORNBACH marketplace guide](https://support.channelengine.com/hc/en-us/articles/14837873232925-HORNBACH-marketplace-guide)
- [Base.com — Integrate HORNBACH Marktplatz](https://base.com/en-US/integrations/hornbachde/)
- [Hornbach (retailer) — Wikipedia](https://en.wikipedia.org/wiki/Hornbach_(retailer))
