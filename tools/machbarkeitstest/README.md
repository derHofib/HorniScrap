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
