# HorniScrap

Preis- und Verfügbarkeitsbeobachtung für HORNBACH-Artikel.

**Aktueller Stand: Konzeptphase.** Es gibt noch keine Implementierung.

👉 **[Ausarbeitung: Preis- und Verfügbarkeitsdaten von HORNBACH](docs/Ausarbeitung-Hornbach-Preis-und-Verfuegbarkeitsdaten.md)**

## Kurzfassung

- Die HORNBACH-Websites sind site-weit durch F5 Bot Defense geschützt — **auch `robots.txt`**.
  Ein klassischer HTTP-Scraper funktioniert nicht (Messung vom 2026-09-02, siehe Anhang A).
- Empfohlen wird ein zweistufiges Vorgehen: **Preise** über lizenzierte Quellen
  (Affiliate-Produktfeed, Anfrage bei HORNBACH), **Filialbestände** nur falls
  tatsächlich benötigt und nach bewusster Entscheidung.
- Die vorgeschlagene Architektur ist quellenagnostisch: der Datenlieferant ist ein
  austauschbarer Adapter, die Pipeline (Modell, Speicher, Auswertung) ist es nicht.

Offene Entscheidungen sind in Abschnitt 9 der Ausarbeitung gesammelt.
