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
| `app.css` | komplettes Design, Abschnitte 01–26 (26 = Intro) |
| `core.js` | Konfiguration, Speicher, gemeinsamer Bild-Speicher, Demo-Daten |
| `sync.js` | Google-Drive-Sync: Pull, Push, Konfliktprüfung |
| `news.js` | News-Daten: Import, Zeitzonen, Speicherung |
| `state.js` | `STATE`, Dialoge, Navigation, Kategorien-Verwaltung, `render()` + `RENDER_HOOKS` |
| `start.js` | Startseite, Sessions, Kennzahlen, Routine, News-Kachel |
| `trades.js` | Live/EOD-Listen, Kalender, Trade-Detail, Trade-Formular, EOD→Live |
| `bericht.js` | Bericht mit Filtern, Kennzahlen, Wortwolke, Equity-Kurve, Export/Import |
| `erkenntnisse.js` | Erkenntnisse-Liste |
| `strategie.js` | Strategie-Reiter, Erkenntnis-Formular |
| `intro.js` | Cinematisches Intro nach dem Entsperren: Drehbuch (Datenstruktur am Dateianfang), WebGL-Bild, Web-Audio-Ton, Einstellungen `tj_intro_v1` |
| `musik.js` | Lo-Fi-Hintergrundmusik, live mit Web Audio erzeugt (Komponist + Klangerzeuger), Header-Knopf, Einstellungen `tj_musik_v1` |
| `init.js` | Sperrbildschirm, globale Tasten- und Fehler-Handler, Fokus |
| `design.js` | Animationen, Navigations-Schieber, Hell/Dunkel |
| Schrift | `inter-latin.woff2`, `inter-latin-ext.woff2` (Inter, lokal; `@font-face` in `app.css` Abschnitt 00) |
| Bilder | `icon-192/512.png`, `apple-touch-icon.png`, `favicon-32.png`, `start-bg.jpg`, Strategie-PNGs |
| `manifest.webmanifest` | PWA-Einstellungen |

**Warum keine Unterordner:** Clemens lädt Dateien teils per GitHub-Web-Upload hoch, und der legt alles flach ab. Mit Ordnern fehlten Pfade und die App startete nicht.

## Architektur – das muss man wissen
- **Normale `<script>`-Dateien, keine Module.** Sie teilen sich einen globalen Namensraum, und die Reihenfolge ist fest: `core → sync → news → state → start → trades → bericht → erkenntnisse → strategie → intro → musik → init → design` (`intro` und `musik` vor `init`, weil `init.js` sie beim Entsperren aufruft). Code, der schon beim Laden läuft, darf nur Funktionen aus derselben oder einer früheren Datei aufrufen.
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

## Aktueller Stand (Version 2026.11.18)
**Was funktioniert:**
- Live- und EOD-Listen, Kalender, Trade-Detail und Formular. Screenshots per Upload oder Link, doppelte Bilder werden nur einmal gespeichert.
- Kategorien: anlegen, Überschriften und Werte umbenennen (wirkt auf alle Trades).
- Bericht mit Filtern und Auswertung nach Kategorie, Erkenntnisse, Strategie-Nachschlagewerk.
- News: manueller Import per Claude-Prompt (ein automatischer Feed-Abruf war unzuverlässig und wurde verworfen).
- Google-Drive-Sync mit Konfliktauflösung, PIN-Sperre, Hell/Dunkel, PWA.
- „→ EOD“ kopiert einen Live-Trade, „→ Ins Live“ übernimmt einen EOD-Trade (optional verknüpft).
- 2026.10.04: In den EOD-Buttons der Liste sind Pfeil und Haken jetzt SVGs, die Beschriftung sitzt per `text-box: trim-both cap alphabetic` exakt mittig.
- 2026.10.15b: Beim Reveal blenden im Start-Hero nur die Texte ein. Das Foto, die Schnell-Buttons und die Session-Kachel stehen sofort da. **Regel:** Milchglas-Flächen (`backdrop-filter`) nie per `opacity` animieren, weder selbst noch über einen Vorfahren unterhalb des Hintergrundbilds. Chromium/Safari zeigen den Blur sonst erst nach dem Fade. Den Hero selbst nicht einblenden, sonst schimmert das Foto beim Login heller durch (Liste `NO_REVEAL` in `design.js`).
- 2026.10.15c: **Cinematisches Intro** (`intro.js`, CSS-Abschnitt 26), ~18 s nach dem Entsperren, Kurzfassung ~4,4 s, ruhige Titelkarte bei `prefers-reduced-motion`, ohne WebGL die Kurzfassung als DOM-Version. Testparameter: `?intro=vorschau`, `?intro=kurz`, `?intro=bild:8.5` (Standbild), `?intro=live` (folgt der Einstellung) oder über „Intro jetzt abspielen“ im Modal „⚙ Einstellungen“ (früher „Kategorien“). Regeln: Das Intro liest nur, Toasts/Dialoge warten währenddessen (`UI_HOLD` in `state.js`), der Einstieg der Startseite (Reveal) wird über `designReplayEnter()` nachgeholt, `appShellIn` läuft bei Intro nicht (Klasse `intro-shell`). Der `AudioContext` muss in der Entsperr-Geste entstehen (`INTRO.vorbereiten()` in `tryUnlock`).
- 2026.10.16: Intro 2.0 — der Akt „Disziplin“ zeigt jetzt Clemens' echten Trade (GBP/USD M5, 08.10.2026, Long 1,31902 → Ziel 1,32176) als 3D-Chart; Daten in `D.trade` im Drehbuch (austauschbar). Neue Übergänge aus `D.effekte`: Kamera-Stöße, Glitch-Schnitte, radiale Zoom-Unschärfe, Lichteinfälle, Sog der Scherben ins Objektiv mit Match-Cut auf den Chart, Whip-Wipe vom Titel aufs Foto. Satz 5: „Aber jeder bestimmt sein Risiko.“ / „Plan your trade. Trade your plan.“
- 2026.10.16b: Der Chart im Akt „Disziplin“ ist jetzt 1:1 aus Clemens' TradingView-Screenshot vermessen: 232 Kerzen (22:50–18:05), alle Zonen, Linien, Labels (5, 15, 2, C), Preis-Etiketten und die Long-Box (Entry 1,31902, Ziel 1,32170, lila Stop-Zone). Die Daten stehen in `D.trade` (Kerzen als O,H,L,C in 0,00001 über 1,3170, Zeiten als „HH:MM“). Die Totale zeigt denselben Bildausschnitt wie der Screenshot, Text C liegt im leeren Streifen darunter.
- 2026.10.16c: **Intro freigeschaltet (Phase 3):** `INTRO_LIVE = true` in `intro.js`. Nach jedem echten Entsperren läuft das Intro gemäß Einstellung `tj_intro_v1` (Standard „Immer“; „Einmal am Tag, sonst kurz“, „Nur Kurzfassung“, „Aus“ — je Gerät).
- 2026.10.17: **Intro-Texte auf Englisch** (Wunsch Clemens): alle 5 Textsätze in `D.saetze` (rotieren täglich über `satzDesTages()`), Datenzeile „Trade #{n} awaits.“, Pille „Skip“, Ton-Knopf „Sound on/off“; `lang="en"` am Intro. Ausnahme von Regel 1 (Sprache) nur für das Intro, die Einstellungen bleiben deutsch.
- 2026.10.21: **Aufstieg (11,0–13,6 s) neu:** Kamera reißt aus dem Trade zurück und fährt dem Kopf der Equity-Kurve nach, zum Schluss die ganze Kurve im Licht. Kurve mit Lichtvorhang, R-Stufen (+25R …, Achse wandert mit dem Kopf), Drawdowns rot mit gestrichelter Hochwassermarke, Lichtsäulen bei neuen Allzeithochs, Funken, Komet-Kopf, Zähler oben links (`.intro-hud`: Equity in R, Trades). Die Kurve ist ein erfundenes, realistisches Konto (Seed = Datum, endet auf dem Allzeithoch); Zeitachse `EQ_T`/`eqKopf()` in `intro.js`.
- 2026.10.21b: **Begrüßung** in der Stille (0,06–1,42 s) über der Nulllinie: „Welcome back,“ / „Meister Clemens“ (`D.gruss`, Zeiten `D.texte.G`); der Chaos-Einsatz bei 1,2 s reißt sie mit Glitch weg. Nur in der vollen Fassung (nicht in Kurzfassung/ruhiger Titelkarte). 2026.10.21c: darunter, unter der Nulllinie, „Remember...“ im Format von „Welcome back,“ (`D.gruss.unten`, die Punkte erscheinen einzeln).
- 2026.10.21d: **Erste Sequenz 1 s länger** (Intro jetzt ~19,1 s). Das Drehbuch behält seine Zeiten („Drehbuchzeit“); `D.dehnung` + `drehbuchZeit()`/`laufZeit()` in `intro.js` lassen die Stille zwischen 0,6 und 1,2 s weich in Zeitlupe laufen und verschieben alles danach (Bild und Ton) um 1 s. Uhr, Ende, `?intro=bild:` und `INTRO.bild()` rechnen in Laufzeit; die Begrüßung (`D.texte.G`) ebenfalls (0,06–2,42 s, Chaos-Einsatz bei 2,2 s).

- 2026.11.16: **Schrift Inter lokal** statt von Google Fonts (`inter-latin*.woff2`, variable Schrift 100–900). Windows fiel vorher auf Arial zurück, wenn der Google-Abruf scheiterte (offline, Werbeblocker). Rückfall-Reihenfolge jetzt SF Pro → Inter → Segoe UI → Helvetica Neue → Arial. Die App lädt keine Schrift mehr aus dem Internet.

- 2026.11.16b: **„Nach dem BE“:** Bei BE-Trades (Live und EOD) lässt sich festhalten, ob der Trade danach TP geworden wäre oder den SL gehittet hätte, optional mit R-Wert. Felder `nachBE` („TP“/„SL“/null) und `nachBER` (R mit Vorzeichen wie `r`), nur bei `ergebnis === "BE"`. Der Trade bleibt 0R, die Kennzahlen ändern sich nicht. Zu sehen in Formular, Liste (Zeile unter 0,00R), Detail, Kalender/Notizen (Badge „BE → TP“ über `resultBadgeHtml()`), Suche, Bericht (Filter „Nach dem BE“, nicht in der Auswertung nach Kategorie; Kachel „Break-Even-Check“ mit „erspart“/„verschenkt“, SL ohne R-Angabe zählt 1R; Zeile in der Gegenüberstellung) und im CSV/Excel-Export. Helfer in `trades.js`: `hatNachBE()`, `nachBEWert()`, `nachBEText()`. 2026.11.16c: In der Liste steht nur noch „TP +4,00R“ (ohne „danach“), rechtsbündig unter der R-Zahl (`.trade-r.has-nachbe`), damit nichts ins Vorschaubild ragt.

- 2026.11.17: **Lo-Fi-Hintergrundmusik** (`musik.js`): komplett live erzeugt (Rhodes-Akkorde per FM, Bass, Boom-Bap-Drums mit Swing, gelegentliche Melodie, Vinyl-Knistern, Tape-Leiern, Hall, Sidechain-Pumpen), keine Audiodateien. Tonart, Tempo (70–82 BPM) und Akkordfolgen je Sitzung zufällig, Muster wechseln laufend. Regler und Mischung oben in `K`. An/Aus über den Equalizer-Knopf im Header (`#btnMusik`, Balken bewegen sich beim Spielen) oder im Modal „⚙ Einstellungen“ (Stil „Lo-Fi Beats“/„Ohne Beat“, „Neu mischen“, Lautstärke). Standard aus, je Gerät (`tj_musik_v1`). Ablauf: `MUSIK.vorbereiten()` in der Entsperr-Geste (`tryUnlock`), `MUSIK.starten()` in `startApp()` wartet selbst, bis das Intro vorbei ist, und blendet 5 s ein; im Hintergrund wird ausgeblendet und der `AudioContext` angehalten. `audioSession.type = "ambient"` (folgt dem Stummschalter). Test ohne Lautsprecher: `MUSIK.offline(sek, {seed, stimmung, vinyl})`. 2026.11.18: Schalter „Vinyl“ (Rauschen + Knistern, eigener Bus `P.vinyl`, live umschaltbar), Einstellung `vinyl` in `tj_musik_v1`, Standard an.

**Offen / bekannt:**
- Am iPhone noch prüfen (Musik): Start nach dem Entsperren/Intro, Stummschalter, Weiterlaufen nach Rückkehr in die PWA (ggf. erst nach einer Berührung), Klang über Lautsprecher und Kopfhörer.
- Am iPhone noch prüfen (Intro): Ton nach dem Entsperren, Stummschalter, flüssige Wiedergabe (60 fps), Safe Areas in der PWA, Lesbarkeit der Texte, Match-Cut auf den Hero.
- `intro.js` ist ~108 KB (Richtwert 80 KB, gzip ~40 KB): Trade-Daten (232 Kerzen), drei Ersatzfassungen und Test-Hilfen (`INTRO.tonOffline`, `?intro=bild:`) sind mit drin.
- Am iPhone (Safari) noch prüfen: Start-Hero, „g“ in der Begrüßung, Detail-Kategorien (2026.10.02b), EOD-Buttons (2026.10.04) und Milchglas von „+ Erkenntnis“ beim Wechsel auf Start sowie die Login-Animation des Hero-Fotos (2026.10.15b).
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
