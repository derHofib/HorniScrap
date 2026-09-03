# Machbarkeitstest — Ergebnis (2026-09-03)

Ausgeführt von: Dennis Hofmann, lokal (macOS), normales Heim-/Büronetz.
Artikel: `hager-ads916d-16a-fehlerstrom-leitungsschutzschalter-fi-b-30ma/6072187`

Vollständige Terminalausgabe unten. Zusammenfassung und Interpretation in
Abschnitt 2b der [Ausarbeitung](../Ausarbeitung-Hornbach-Preis-und-Verfuegbarkeitsdaten.md).

## Headful (sichtbarer Browser)

```
F1 Browser kommt durch:   JA       (15750 ms bis Auflösung)
F2 robots.txt lesbar:     JA
F3 Preis extrahierbar:    JA (JSON-LD)   — 46.51
F4 Serverbetrieb:         UNGEPRÜFT — Lauf mit --headless wiederholen

Netzwerk-Kandidaten:
  200 GET  https://svc.hornbach.de/cmscontent-service/store?language=de_DE&companyCode=1001&storeId=616
  200 POST https://www.hornbach.de/frontend/query?fitlocale=de-DE&operationName=PriceAndDeliveryInfo

Verfügbarkeitstext: "in 2 Stunden abholbereit"
EUR-Beträge im Fließtext: 46,51 € ×2 · 42,32 € ×2 · 5,70 € · 49,00 €
```

`robots.txt`:

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

User-agent: SemrushBot
Disallow: /
User-agent: proximic
Disallow: /
User-agent: BLEXbot
Disallow: /

Sitemap: https://www.hornbach.de/sitemap/sitemap.xml
```

## Headless (Serverbetrieb)

```
F1 Browser kommt durch:   NEIN     (Titel bleibt "Client Challenge" nach 15287 ms)
F2 robots.txt lesbar:     NEIN
F3 Preis extrahierbar:    NEIN
F4 Serverbetrieb:         NEIN — headless blockiert; nur mit sichtbarem Browser
```

## Kernaussagen

1. **`/frontend/query` (PriceAndDeliveryInfo) ist der einzige beobachtete Endpunkt,
   den `robots.txt` namentlich ausschließt.** Preis/Bestand über die Produktseite
   (`/p/…`, per JSON-LD) statt direkt darüber zu beziehen, ist der einzige mit
   `robots.txt` vereinbare Weg.
2. **Headless ist blockiert.** Ein unbeaufsichtigter Serverjob funktioniert in der
   getesteten Form nicht — offener nächster Test: sichtbares Chromium unter
   virtuellem Display (Xvfb), keine Fingerprint-Umgehung.
3. **Preis mehrdeutig:** JSON-LD liefert `46.51`, im Text stehen zusätzlich
   `42,32 €` und `49,00 €` — Bedeutung ungeklärt (netto? Staffelpreis? UVP?).
4. **Verfügbarkeit nur als Fließtext** gefunden, kein separates strukturiertes Feld
   in der Produktseite selbst.
