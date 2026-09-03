# Machbarkeitstest

Beantwortet die eine Frage, die die Ausarbeitung offenlassen musste:
**Können wir die Preise wirklich selbst ziehen?**

Aus einer Cloud-/Sandbox-Umgebung ist das nicht messbar (siehe Anhang A der
Ausarbeitung). Dieser Test muss **auf einem normalen Rechner mit normalem
Internetanschluss** laufen — idealerweise dem, auf dem später auch produktiv
abgerufen würde.

## Ausführen

```bash
cd tools/machbarkeitstest
npm install                       # zieht Playwright + Chromium

# 1. Durchlauf: sichtbarer Browser (der realistische Fall)
node check.mjs "https://www.hornbach.de/p/<echte-produkt-url>/"

# 2. Durchlauf: headless (der Serverfall)
node check.mjs "https://www.hornbach.de/p/<echte-produkt-url>/" --headless
```

Bleibt die Challenge im sichtbaren Fenster stehen, einmal von Hand lösen:

```bash
node check.mjs "<url>" --keep-open
```

## Was der Test beantwortet

| | Frage | Bedeutung für das Projekt |
|---|---|---|
| **F1** | Kommt ein echter Browser durch? | Nein ⇒ Option E ist tot, es bleiben A/C/D. |
| **F2** | Was steht in `robots.txt`? | Untersagt sie `/p/` oder `/s/`, endet der Test hier — unabhängig davon, was technisch ginge. |
| **F3** | Preis maschinenlesbar (JSON-LD, Meta, Microdata)? | JSON-LD ⇒ robuster Parser. Nur Fließtext ⇒ bricht bei jedem Redesign. |
| **F4** | Geht es auch headless? | Nein ⇒ kein unbeaufsichtigter Serverbetrieb, es braucht einen Rechner mit Desktop-Sitzung. |

Nebenbei protokolliert er Netzwerkaufrufe, die nach einem Verfügbarkeits-
Endpunkt aussehen, und misst die Ladedauer — die Zahl, die darüber entscheidet,
ob ein Live-Abruf im Angebotsdialog zumutbar ist.

## Was der Test bewusst NICHT tut

- kein Fingerprint-Spoofing, keine Stealth-Plugins, kein UA-Spoofing
- keine CAPTCHA-Solver, keine Proxy-Rotation
- keine Massenabrufe: **eine** Produktseite, mit Pausen dazwischen

Getestet wird ein normaler Browser, nicht ein getarnter. Kommt der nicht durch,
ist das die Antwort — und nicht der Anlass, härter zu drücken.

## Ergebnis

Alles landet in `befunde/`:

- `befund-headful.json` / `befund-headless.json` — maschinenlesbares Protokoll
- `robots.txt` — sobald lesbar
- `produktseite-*.html` — Rohantwort, später die Test-Fixture für den Parser
- `extraktion.json` — alle gefundenen Preis-/Verfügbarkeitsfelder

Schick mir `befund-*.json` und `extraktion.json`, dann geht es mit belastbaren
Zahlen weiter.

---

## Markt-Wahl-Test (`market-check.mjs`)

Ergebnis des ersten Tests: Preis und Bestand liegen bereits strukturiert in der
Produktseite selbst (`window.__ARTICLE_DETAIL_APOLLO_STATE__`), zugeordnet zu
einem automatisch gewählten Markt (im ersten Test: HORNBACH Berlin-Neukölln,
ohne erkennbaren Cookie oder Parameter im Aufruf). Offen blieb: **Lässt sich
der Markt gezielt setzen?** Das entscheidet, ob sich Abschnitt 6 der
Ausarbeitung (Bestand in mehreren definierten Märkten vergleichen) technisch
abbilden lässt.

```bash
node market-check.mjs "https://www.hornbach.de/p/<echte-produkt-url>/"
```

Ablauf:

1. Skript lädt die Produktseite frisch, protokolliert den aktuellen Markt und
   alle gesetzten Cookies ("vorher").
2. **Du** wechselst im geöffneten Browserfenster von Hand auf einen anderen
   Markt (die Standort-/Marktanzeige liegt meist im Kopfbereich der Seite),
   dann Enter im Terminal.
3. Skript lädt die Seite neu, protokolliert Markt und Cookies erneut
   ("nachher") und bildet die Differenz.
4. Hat sich genau ein Cookie geändert, testet das Skript automatisch: neuer,
   komplett leerer Browser-Kontext, **nur** dieser Cookie gesetzt, Seite
   direkt aufgerufen — ganz ohne Klick. Kommt derselbe Zielmarkt zustande,
   ist die Marktwahl ein reiner Cookie-Mechanismus und programmatisch
   steuerbar. Kommt er nicht zustande, hängt sie an mehr (IP, Server-Session)
   und lässt sich nicht ohne Weiteres von außen erzwingen.

Ergebnis liegt in `befunde/markt-test.json`. Das Terminal fasst am Ende in
einer Zeile zusammen, ob der Wiederholungstest erfolgreich war — schick mir
diese Datei, dann weiß ich, ob und wie Phase 4 den Marktradius abbilden kann.
