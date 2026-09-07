# FieldVibe-Plugin: HORNBACH Material- & Filial-Connector

Dieses Dokument beschreibt die modulare Plugin-Architektur, mit der **HorniScrap** als optionales Erweiterungsmodul in **FieldVibe** integriert wird.

---

## 1. Übersicht & Plugin-Konzept

FieldVibe unterstützt modulare Mandanten-Features über `module_flags` (wie bereits für `postfach`, `karten` und `projekte`). 

Das **HORNBACH-Plugin** (`"hornbach"`) erweitert FieldVibe um folgende Fähigkeiten:
1. **Live-Materialsuche**: Monteure können direkt im Vorgang nach Material suchen und Hornbach-Treffer mit Live-Preisen durchsuchen.
2. **Filialbestand & Regalplatz**: Anzeige, in welchem Gang des nächstgelegenen Markts das Teil liegt (z. B. `📍 Gang 20`), inklusive aktueller Stückzahl.
3. **1-Klick-Übernahme**: Übernahme von Artikeln (Titel, Bild, EAN, Einkaufspreis, Staffelpreise) direkt in den `MaterialBedarf` des Vorgangs oder in den globalen `Material`-Stamm.

---

## 2. Docker-Compose Integration

HorniScrap läuft als eigenständiger Container im selben Compose-Netzwerk wie FieldVibe:

```yaml
# In FieldVibe's docker-compose.yml
services:
  # ... postgres, backend, frontend, minio ...

  horniscrap:
    image: horniscrap:latest
    build:
      context: ../HorniScrap
    container_name: fieldvibe-horniscrap
    restart: unless-stopped
    ports:
      - "127.0.0.1:8050:8050"
    environment:
      - PORT=8050
```

---

## 3. Backend-Architektur in FieldVibe

### 3.1 Plugin-Aktivierung (`module_flags`)
In `backend/app/models/mandant.py`:
```python
# Im Dict mandanten.module_flags:
# { "hornbach": true }
```

### 3.2 Integration & Mandanten-Einstellungen
Der Handwerksbetrieb konfiguriert seinen Stamm-Markt in den Mandanten-Einstellungen (`mandant_einstellungen` oder `mandant_integrationen`):

```json
{
  "typ": "hornbach",
  "config": {
    "api_url": "http://horniscrap:8050",
    "standard_store_id": "609",
    "standard_store_name": "HORNBACH Berlin-Mariendorf",
    "cache_ttl_min": 15
  }
}
```

### 3.3 Backend-Service (`app/services/hornbach_service.py`)
```python
import httpx
from app.core.config import get_settings

HORNISCRAP_URL = "http://horniscrap:8050"

async def search_hornbach(query: str, store_id: str | None = None) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{HORNISCRAP_URL}/api/search",
            params={"q": query, "storeId": store_id},
            timeout=35.0,
        )
        resp.raise_for_status()
        return resp.json()

async def get_hornbach_article(sku_or_url: str, store_id: str | None = None) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{HORNISCRAP_URL}/api/article",
            params={"query": sku_or_url, "storeId": store_id},
            timeout=35.0,
        )
        resp.raise_for_status()
        return resp.json()
```

### 3.4 API-Routen in FieldVibe (`app/api/routes/integrationen_hornbach.py`)
* `GET /api/integrationen/hornbach/search?q=...`: Liefert Trefferliste für das Frontend.
* `GET /api/integrationen/hornbach/article?sku=...`: Liefert Detaildaten, Filialbestand und Gangplatz.
* `POST /api/vorgaenge/{id}/material-bedarfe/aus-hornbach`: Legt einen `MaterialBedarf` direkt aus den HORNBACH-Daten an.

---

## 4. Frontend-Integration (Feld-App & Office)

### 4.1 Im Vorgang (`VorgangDetailPage.tsx` / `MaterialBedarfeSection`)
* Sobald das Plugin für den Mandanten aktiv ist, erscheint im Abschnitt *Materialbedarf* ein Suchfeld:  
  **`[ 🔍 Bei HORNBACH suchen... ]`**
* Bei Eingabe öffnet sich eine Drawer- / Modal-Ansicht mit den Treffern (Bild, Preis, Vor-Ort-Verfügbarkeit).
* Der Monteur tippt auf den gewünschten Artikel → Der Artikel wird mit Preis, Menge und dem Hinweis `📍 Gang 20` im Vorgang gebucht.

### 4.2 Im Materialstamm (`MaterialPage.tsx`)
* Button: **„Aus HORNBACH importieren“**.
* Automatische Übernahme von:
  * `bezeichnung` = HORNBACH-Titel
  * `einzelpreis` = HORNBACH-Stückpreis (netto/brutto kalkuliert)
  * `artikelnummer` = HORNBACH-SKU
  * `bestell_url` = HORNBACH-Produkt-URL
  * `lieferant_id` = Lieferant "HORNBACH" (wird bei Erstinstallation automatisch als Lieferant angelegt)

---

## 5. Rechtliche & betriebliche Sicherheit
* **Menschliches Tempo**: Integrierter 15-Minuten-Cache verhindert mehrfaches Scraping gleicher Artikel.
* **Fallback**: Ist HorniScrap temporär nicht erreichbar, fällt das UI transparent auf manuelle Materialerfassung zurück, ohne den FieldVibe-Kern zu beeinträchtigen.
