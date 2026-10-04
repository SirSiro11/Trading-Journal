# Trading Journal – Anleitung für Claude

Diese Datei liest Claude zu Beginn jeder Code-Sitzung. Sie beschreibt die App, die festen Regeln und den aktuellen Stand.
**Achtung: Das Repo ist öffentlich.** Hier kommen keine Schlüssel, Passwörter oder Sicherheitsdetails hinein.

## Was die App ist
Ein persönliches Trading-Journal von Clemens für Live-Trades, EOD-Setups, Erkenntnisse und die eigene Strategie. Es wertet ausführlich aus und gleicht automatisch zwischen PC und iPhone ab (PWA).
- **Live:** https://sirsiro11.github.io/Trading-Journal/ über GitHub Pages vom Branch `main`.
- **Kein Build, kein Framework:** reines HTML, CSS und JavaScript.

## Dateien (alle flach im Hauptverzeichnis, keine Unterordner!)
| Datei | Inhalt |
|---|---|
| `index.html` | Gerüst, Theme-Umschaltung vor dem ersten Zeichnen, Einbindungen mit `?v=` |
| `app.css` | komplettes Design, Abschnitte 01–25 |
| `core.js` | Konfiguration, Speicher, gemeinsamer Bild-Speicher, Demo-Daten |
| `sync.js` | Google-Drive-Sync: Pull, Push, Konfliktprüfung |
| `news.js` | News-Daten: Import, Zeitzonen, Speicherung |
| `state.js` | `STATE`, Dialoge, Navigation, Kategorien-Verwaltung, `render()` + `RENDER_HOOKS` |
| `start.js` | Startseite, Sessions, Kennzahlen, Routine, News-Kachel |
| `trades.js` | Live/EOD-Listen, Kalender, Trade-Detail, Trade-Formular, EOD→Live |
| `bericht.js` | Bericht mit Filtern, Kennzahlen, Wortwolke, Equity-Kurve, Export/Import |
| `erkenntnisse.js` | Erkenntnisse-Liste |
| `strategie.js` | Strategie-Reiter, Erkenntnis-Formular |
| `init.js` | Sperrbildschirm, globale Tasten- und Fehler-Handler, Fokus |
| `design.js` | Animationen, Navigations-Schieber, Hell/Dunkel |
| Bilder | `icon-192/512.png`, `apple-touch-icon.png`, `favicon-32.png`, `start-bg.jpg`, Strategie-PNGs |
| `manifest.webmanifest` | PWA-Einstellungen |

**Warum keine Unterordner:** Clemens lädt Dateien teils per GitHub-Web-Upload hoch, und der legt alles flach ab. Mit Ordnern fehlten Pfade und die App startete nicht.

## Architektur – das muss man wissen
- **Normale `<script>`-Dateien, keine Module.** Sie teilen sich einen globalen Namensraum, und die Reihenfolge ist fest: `core → sync → news → state → start → trades → bericht → erkenntnisse → strategie → init → design`. Code, der schon beim Laden läuft, darf nur Funktionen aus derselben oder einer früheren Datei aufrufen.
- **Daten:** Sie liegen primär in `localStorage` (Schlüssel `tj_*_v1`), damit die App offline voll funktioniert. Die Cloud-Kopie ist eine einzige JSON-Datei in Google Drive.
- **Cloud-Zugriff nur über den Proxy `journalProxy` (Cloud Run).** Das Google-Token bleibt auf dem Server, ein Login direkt im Browser macht in der iPhone-PWA Probleme. Neue Backend-Funktionen kommen als Erweiterung in diesen Proxy, Geheimnisse liegen als Umgebungsvariablen und nie im Repo.
- **Sync:**
  - Nach Änderungen wird 4 Sekunden gewartet, dann hochgeladen. Der neuere Stand gewinnt, die Konfliktprüfung läuft über `savedAt`.
  - Beim Zurückkehren in die App wird nachgeladen, höchstens einmal pro Minute.
  - Ein Abruf aus der Cloud darf **nie** einen Upload auslösen.
- **Screenshots:** Im Cloud- und Backup-Format stehen sie einmal im Feld `shots`, Trades verweisen mit `shot:<key>` darauf. `expandPayloadShots()` liest altes und neues Format.
- **Rendering:**
  - `render()` baut die aktuelle Ansicht neu, danach laufen die `RENDER_HOOKS`.
  - Chip-Klicks im Formular schalten nur ihre eigene Gruppe um.
  - Listen nutzen Event-Delegation, also einen Listener pro Liste.
- **Dialoge:** keine `confirm()`/`alert()`, sondern `uiDialog`, `uiConfirm`, `uiPrompt` und `uiAlert`.
- **Filter:** `getFilterDimensions()`, denn Kategorien sind konfigurierbar. Es gibt keine feste Liste.
- **Symbole in Buttons:** als kleines SVG mit `stroke="currentColor"`, nicht als Textzeichen wie „→“, weil die je nach Schrift falsch sitzen.

## Regeln für jede Änderung
1. **Sprache:** Oberfläche und Code-Kommentare auf Deutsch.
2. **Markieren:** Änderungen mit `/* GEÄNDERT (JJJJ-MM-TT): Grund */`, neue Funktionen oder Konstanten mit `NEU (JJJJ-MM-TT)`.
3. **Version erhöhen:** Die Version steht nur in `index.html` als `?v=JJJJ.MM.TT` und muss an **allen** CSS- und JS-Einbindungen gleich gesetzt werden. Bei mehreren Änderungen am selben Tag kommt ein Buchstabe dazu (`2026.10.04b`, `c` …). `APP_VERSION` liest den Wert automatisch. Ohne höhere Version laden die Geräte die neuen Dateien nicht.
4. **Konsistenz:** Neue Felder immer durchgängig einbauen, also in Liste, Detail, Formular und Filter/Bericht.
5. **Design:** an Apple angelehnt. Mobil zuerst denken und bei 375, 390 und 430 px Breite prüfen, dazu Hell- und Dunkelmodus.
6. **Größere Eingriffe:** zuerst analysieren und Clemens den Plan nennen, erst nach seinem OK umbauen. Kleine Korrekturen dürfen direkt erfolgen.

## Prüfen vor dem Push (Pflicht)
- **Syntax** jeder geänderten JS-Datei prüfen, zum Beispiel mit `node --check datei.js`.
- **Darstellungs-Änderungen im Browser rendern** (Playwright/Chromium ist in der Cloud-Umgebung vorhanden) und das Ergebnis per Screenshot oder Messung kontrollieren. Ein „syntaktisch fehlerfrei“ allein reicht nicht.
- Was nur am echten iPhone prüfbar ist (Safari, PWA), offen als „am iPhone noch prüfen“ benennen.

## Ablauf und Lieferung
- **Nach erfolgreicher Prüfung direkt auf `main` pushen.** Das ist nach etwa einer Minute live auf allen Geräten. Sagt Clemens in der Aufgabe „erst zeigen“ oder „nicht live“, nur auf einen eigenen Branch pushen.
- **Am Ende kurz auf Deutsch zusammenfassen:** was geändert wurde, welche Dateien betroffen sind, die neue Versionsnummer und was am iPhone noch zu prüfen ist.
- **Diese Datei pflegen:** Nach jeder größeren Änderung den Abschnitt „Aktueller Stand“ unten aktualisieren und im selben Commit mitpushen.

## Aktueller Stand (Version 2026.10.04)
**Was funktioniert:**
- Live- und EOD-Listen, Kalender, Trade-Detail und Formular. Screenshots per Upload oder Link, doppelte Bilder werden nur einmal gespeichert.
- Kategorien: anlegen, Überschriften und Werte umbenennen (wirkt auf alle Trades).
- Bericht mit Filtern und Auswertung nach Kategorie, Erkenntnisse, Strategie-Nachschlagewerk.
- News: manueller Import per Claude-Prompt (ein automatischer Feed-Abruf war unzuverlässig und wurde verworfen).
- Google-Drive-Sync mit Konfliktauflösung, PIN-Sperre, Hell/Dunkel, PWA.
- „→ EOD“ kopiert einen Live-Trade, „→ Ins Live“ übernimmt einen EOD-Trade (optional verknüpft).
- 2026.10.04: In den EOD-Buttons der Liste sind Pfeil und Haken jetzt SVGs, die Beschriftung sitzt per `text-box: trim-both cap alphabetic` exakt mittig.

**Offen / bekannt:**
- Am iPhone (Safari) noch prüfen: Start-Hero, „g“ in der Begrüßung, Detail-Kategorien (2026.10.02b) und EOD-Buttons (2026.10.04).
- Die Konfliktprüfung lädt vor jedem Upload die ganze Cloud-Datei. Schlanker wäre eine Proxy-Abfrage, die nur `savedAt` liefert.
- `localStorage` hat ein Limit von etwa 5 MB, viele Screenshots füllen es.
- Fokus und Einblenden der Dialoge laufen noch über einen `MutationObserver` auf `#modalRoot`. Das funktioniert, ist aber unaufgeräumt.
- Ein Sicherheits-Umbau am Zugriffsschutz ist geplant. Details bespricht Clemens außerhalb des Repos, bitte nicht hier dokumentieren.

## Nächste Schritte
1. **KI-Wochenbericht:**
   - neuer Unter-Reiter im Bericht
   - neue Analyse-Funktion in `journalProxy`, die die Anthropic API aufruft (API-Schlüssel als Umgebungsvariable)
   - Berichte als Liste `aiWeeklyReports` in derselben Drive-JSON
   - jeden Samstag automatisch erstellen, Push-Hinweis um 09:00 (wie die bestehende Erinnerung über Cloud Scheduler und ntfy)
2. Optional: „→ Ins Live“ zusätzlich direkt in der EOD-Liste anbieten.
