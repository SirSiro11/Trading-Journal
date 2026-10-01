/* core.js — Konfiguration, Speicher (localStorage), gemeinsamer Bild-Speicher, Demo-Daten */
/* ⚠️⚠️⚠️ CLAUDE: LIES DAS ZUERST, BEVOR DU IRGENDETWAS ANDERES ÄNDERST ⚠️⚠️⚠️
   Die Versionsnummer steht NUR NOCH in index.html (Parameter ?v=JJJJ.MM.TT an allen
   CSS-/JS-Einbindungen). Sie MUSS bei JEDER Änderung an IRGENDEINER Datei der App auf das
   heutige Datum gesetzt werden — ALLE Vorkommen von ?v=… in index.html gleichzeitig
   ersetzen. Das ist zugleich das Cache-Busting: Nur mit neuem ?v= laden die Geräte die
   geänderten Dateien statt einer alten Kopie aus dem Browser-Cache. Niemals überspringen.

   AUFBAU (seit 2026.09.29 — vorher eine einzige index.html mit ~8000 Zeilen).
   Seit 2026.10.01b liegen ALLE Dateien flach im Hauptverzeichnis (auch Bilder/Icons),
   ohne Unterordner — der GitHub-Web-Upload entpackt Ordner flach:
     index.html          Gerüst (HTML), Theme-Vorabschaltung, Einbindungen
     app.css         komplettes Design
     core.js          Konfiguration, Speicher (localStorage), gemeinsamer Bild-Speicher, Demo-Daten
     sync.js          Google-Drive-Sync über den Cloud-Run-Proxy (Pull/Push/Konflikt)
     news.js          News-Daten: Import, Zeitzonen, Speicherung (ohne Oberfläche)
     state.js         Zentraler Zustand STATE, Dialoge, Navigation, Kategorien-Verwaltung, render()
     start.js         Startseite: Sessions, Kennzahlen, Equity, Routine, News-Kachel und News-Dialog
     trades.js        Live/EOD-Listen, Kalender, Trade-Detail, Trade-Formular, Screenshots
     bericht.js       Bericht: Filter, Kennzahlen, Wortwolke, Diagramm, Export/Import
     erkenntnisse.js  Erkenntnisse-Reiter (Liste)
     strategie.js     Strategie-Reiter und Erkenntnis-Formular
     init.js          Sperrbildschirm, globale Tastatur-/Fehler-Handler, Fokus-Management, Start
     design.js        Design-Schicht: Animationen, Navigation-Schieber, Hell/Dunkel
   Es sind normale <script>-Dateien (kein Build, keine Module): alle teilen sich einen
   globalen Namensraum und werden in genau dieser Reihenfolge ausgeführt. Code, der schon
   BEIM LADEN läuft (nicht erst in einer Funktion), darf nur Funktionen aus derselben oder
   einer früheren Datei aufrufen. */
/* =========================================================================
   CONFIG  —  alle Auswahlmöglichkeiten an einer Stelle.
   Neue Werte hinzufügen = einfach in das jeweilige Array eintragen.
   ========================================================================= */
// Versionsstand, wird auf der Startseite klein angezeigt. Kommt automatisch aus dem
// ?v=… dieser Script-Einbindung in index.html (siehe Hinweis ganz oben).
const APP_VERSION = (function(){
  try{ return new URL(document.currentScript.src).searchParams.get("v") || "dev"; }
  catch(e){ return "dev"; }
})();

const DEFAULT_CONFIG = {
  markets:      ["XAUUSD","GBPUSD","DAX","BTCUSD","EURUSD"],
  directions:   ["Long","Short"],
  sessions:     ["London","New York","Out of Session"],
  entryTypes:   ["CE","SE","Continuation","71er","Limit","Counter","Flip","Engulfing"],
  levels:       ["32","50","71","passiv"],
  trend:        ["Counter","pro"],
  // Die sechs Zonen-Kriterien der Strategie (Mehrfachauswahl pro Trade)
  kriterien:    ["BOS/ChoCh","IMB","EZ/IND","LQs","GB","LQ-Ziel"],
  invalidierung:["50%","v. Zone","kein B/C","Trendline"],
  timeframes:   ["m1","m2","m5","m15"],
  results:      ["SL","TP","BE"],
  // manuell ausgeblendete Begriffe für die Stichwort-Wolken (Notizen im Bericht / Erkenntnisse)
  hiddenNoteWords:    [],
  hiddenInsightWords: [],
  // Gruppen zusammengeführter Begriffe: [{id, label, words:[...]}]
  noteWordGroups:    [],
  insightWordGroups: [],
  // Vorbelegte Werte der Kategorie "Risiko %" (siehe migrateStrategyCategories)
  custom_risiko: ["1 %","0,5 %"],
  // Frei vom Nutzer erstellte, zusätzliche Kategorien: [{key, label, multi}]
  // Die eigentlichen Auswahlwerte jeder solchen Kategorie liegen unter
  // config["custom_"+key], genau wie bei den fest eingebauten Kategorien oben.
  customCategories: [{ key:"risiko", label:"Risiko %", multi:false }],
  // Umbenannte Überschriften für die FEST eingebauten Kategorien (Richtung, Session, ...).
  // Key = das Trade-Feld (z.B. "session"), Wert = der vom Nutzer vergebene neue Name.
  categoryLabelOverrides: {},
  // High-Impact-News zusätzlich in der Kalender-Tagesansicht und auf der Trade-Detailseite zeigen
  newsBeiTrades: false,
  // Pre-Trade-Routine der Startseite (Punkte zum täglichen Abhaken; Häkchen selbst nur lokal/pro Tag)
  routine: ["HTF-Bias notiert","News geprüft","Levels im Chart markiert","Max. 2 Trades heute","Kein Trade 15 Min vor News"]
};

const AREA_LABEL  = { live:"Live", eod:"EOD" };
// GEÄNDERT (Design): Farben aus den CSS-Tokens (passen sich Hell/Dunkel an); fürs Canvas per cssColor() aufgelöst
const AREA_COLOR  = { live:"var(--green)", eod:"var(--amber)" };

// Beschreibt, welche Kategorien im "Kategorien verwalten"-Bereich bearbeitbar sind
// und in welchem Trade-Feld sie verwendet werden. SL/TP/BE (results) ist bewusst
// nicht enthalten, da diese Werte fest mit der Statistik-Logik verknüpft sind.
const CATEGORY_META = [
  {cfgKey:"markets",       field:"markt",         label:"Markt",              multi:false},
  {cfgKey:"directions",    field:"richtung",      label:"Richtung",           multi:false},
  {cfgKey:"sessions",      field:"session",       label:"Session",            multi:false},
  {cfgKey:"entryTypes",    field:"art",           label:"Entry-Art",          multi:false},
  {cfgKey:"levels",        field:"level",         label:"Level",              multi:false},
  {cfgKey:"trend",         field:"trend",         label:"Trend",              multi:false},
  {cfgKey:"kriterien",     field:"kriterien",     label:"Kriterien",          multi:true},
  {cfgKey:"invalidierung", field:"invalidierung", label:"Invalidierungskriterien", multi:true},
  {cfgKey:"timeframes",    field:"zeiteinheit",   label:"Zeiteinheit",        multi:false},
];

/* =========================================================================
   STORAGE
   ========================================================================= */
const LS_TRADES = "tj_trades_v1";
const LS_CONFIG = "tj_config_v1";
const LS_INSIGHTS = "tj_insights_v1";
const LS_DAYCONFIRM = "tj_dayconfirm_v1"; // Liste von ISO-Daten, an denen der Tag ohne Trades manuell bestätigt wurde
const LS_LASTCHANGE = "tj_lastchange_v1"; // Zeitstempel (ms) der letzten Datenänderung
const LS_LASTBACKUP = "tj_lastbackup_v1"; // Zeitstempel (ms) des letzten JSON-Backups (Export oder Import)
const LS_DRIVE_SEEN = "tj_driveseen_v1"; // savedAt des zuletzt gesehenen Cloud-Stands (Pull oder eigener Push) — Basis der Konfliktprüfung
const LS_BERICHT_UI = "tj_berichtui_v1"; // gemerkte Bericht-Einstellungen (Bereiche, Filter, Zeitraum, Gruppierung, Modus)
const LS_SHOTS = "tj_shots_v1"; // gemeinsamer Bild-Speicher: jedes Screenshot-Bild liegt hier genau EINMAL, Trades/Erkenntnisse verweisen nur darauf
const LS_NEWS = "tj_news_v1"; // importierte High-Impact-News { events, ranges, importedAt } — wird mit Backup/Drive synchronisiert (siehe NEWS weiter unten)
const LS_NEWS_VIEW = "tj_newsview_v1"; // gemerkte Ansicht der News-Kachel: "heute" | "woche" (reine UI-Präferenz, kein Sync)

// Merkt sich, dass sich Daten geändert haben (wird von allen save*()-Funktionen aufgerufen).
function markDataChanged(){
  localStorage.setItem(LS_LASTCHANGE, String(Date.now()));
  scheduleDriveAutoPush();
}
// Merkt sich, dass der aktuelle Stand gerade gesichert wurde (Export) bzw. exakt einem
// Backup entspricht (Import) — ab hier gilt wieder "nichts Neues seit dem letzten Backup".
function markBackedUp(){ localStorage.setItem(LS_LASTBACKUP, String(Date.now())); }
function getLastChangeAt(){ return parseInt(localStorage.getItem(LS_LASTCHANGE), 10) || 0; }
function getLastBackupAt(){ const v = localStorage.getItem(LS_LASTBACKUP); return v ? (parseInt(v,10)||null) : null; }
// Gibt es Änderungen, die noch in keinem JSON-Backup stecken?
function hasUnbackedChanges(){ return getLastChangeAt() > (getLastBackupAt() || 0); }

// Baut den kompletten Datenstand für Backup/Export/Cloud-Sync zusammen.
// GEÄNDERT (Performance, Stufe 2): Screenshots stecken nicht mehr einzeln in jedem Trade,
// sondern — wie im localStorage — genau einmal im Feld "shots"; Trades/Erkenntnisse
// enthalten nur Verweise ("shot:<prüfsumme>"). Ein Bild, das in mehreren Trades
// (z. B. Live + EOD-Kopie) vorkommt, wird damit nur einmal hoch- und heruntergeladen.
// Gelesen wird über expandPayloadShots() — das versteht altes UND neues Format.
function buildBackupPayload(){
  const shots = {};
  const trades = dedupeShots(STATE.trades, shots);
  const insights = dedupeShots(STATE.insights, shots);
  return { trades, config: STATE.config, insights, dayConfirmations: STATE.dayConfirmations, news: STATE.news, shots, shotFormat: 1, savedAt: Date.now(), exportedAt: new Date().toISOString() };
}
// Setzt die Bilder eines (Cloud- oder Backup-)Stands wieder in Trades/Erkenntnisse ein.
// Alte Stände ohne "shots" bleiben unverändert (enthalten die Bilder bereits direkt).
function expandPayloadShots(data){
  if(!data || typeof data !== "object" || !data.shots || typeof data.shots !== "object") return data;
  if(Array.isArray(data.trades)) expandShots(data.trades, data.shots);
  if(Array.isArray(data.insights)) expandShots(data.insights, data.shots);
  delete data.shots;
  delete data.shotFormat;
  return data;
}

// Bringt Trades aus älteren Speicherständen (localStorage oder importiertes JSON-Backup)
// auf die aktuelle Struktur. Wird sowohl von loadTrades() als auch von importJson()
// aufgerufen, damit beide Wege denselben Stand garantieren.
let backtestRemovedCount = 0;  // wie viele Backtest-Einträge zuletzt entfernt wurden
let strukturRemovedCount = 0;  // in wie vielen Trades zuletzt das alte Feld "struktur" steckte

function migrateTrades(trades){
  // Der Backtest-Bereich wurde entfernt (Version 2026.09.04). Hier — und damit auf
  // BEIDEN Wegen (lokal laden und Cloud-Stand übernehmen) — fallen solche Einträge
  // raus, sonst brächte sie der nächste Drive-Pull wieder zurück.
  // Die Kategorie "Struktur" wurde aus dem Journal entfernt (Version 2026.09.06).
  // Das Feld fällt hier aus allen Trades — auch aus denen, die per Drive-Sync
  // von einem noch nicht aktualisierten Gerät hereinkommen.
  strukturRemovedCount = 0;
  trades.forEach(t=>{ if(t && "struktur" in t){ delete t.struktur; strukturRemovedCount++; } });

  const beforeBacktest = trades.length;
  trades = trades.filter(t=> !t || t.area !== "backtest");
  backtestRemovedCount = beforeBacktest - trades.length;

  trades.forEach(t=>{
    // Ganz altes Einzelbild-Feld "screenshot" (Singular) -> Liste
    if(t.screenshots === undefined && t.screenshot){
      t.screenshots = [t.screenshot];
    }
    delete t.screenshot;

    // Screenshots in Kategorien (HTF/LTF/Zusätzlich) überführen, falls noch nicht
    // geschehen. Alte flache Listen landen komplett in "Zusätzlich", damit nichts
    // verloren geht — die Zuordnung zu HTF/LTF ist im Nachhinein nicht bekannt.
    if(Array.isArray(t.screenshots)){
      t.screenshots = { htf: [], ltf: [], sonstige: t.screenshots };
    }else if(!t.screenshots || typeof t.screenshots !== "object"){
      t.screenshots = { htf: [], ltf: [], sonstige: [] };
    }else{
      if(!Array.isArray(t.screenshots.htf)) t.screenshots.htf = [];
      if(!Array.isArray(t.screenshots.ltf)) t.screenshots.ltf = [];
      if(!Array.isArray(t.screenshots.sonstige)) t.screenshots.sonstige = [];
    }
  });
  // Migration: "Counter"/"pro" waren früher Teil von Level, sind jetzt eine eigene
  // Kategorie "Trend" — bestehende Trades entsprechend überführen, statt Daten zu verlieren.
  trades.forEach(t=>{
    if(t.level === "Counter" || t.level === "pro"){
      if(!t.trend) t.trend = t.level;
      t.level = null;
    }
    if(t.trend === undefined) t.trend = null;
  });
  return trades;
}

/* =========================================================================
   GEMEINSAMER BILD-SPEICHER (Deduplizierung)
   Früher stand jedes Screenshot-Bild als Base64 direkt im jeweiligen Trade.
   Dieselbe Grafik lag dadurch mehrfach im localStorage — vor allem, weil eine
   EOD-Kopie eines Live-Trades dessen Screenshots komplett mitkopiert. Bei einem
   Browser-Limit von rund 5 MB war das der größte Verschwender.
   Jetzt: beim Speichern werden alle Bilder in tj_shots_v1 abgelegt (Schlüssel =
   Prüfsumme des Bildinhalts, identische Bilder ergeben denselben Schlüssel),
   in den Trades/Erkenntnissen steht nur noch "shot:<schlüssel>". Beim Laden
   werden die Verweise wieder zu echten Bilddaten aufgelöst — der Rest des
   Programms (Anzeige, Bearbeiten, Export, Drive-Sync) arbeitet unverändert mit
   vollständigen Bilddaten und musste nicht angefasst werden.
   Der Speicher wird bei jedem Schreiben komplett neu aufgebaut; nicht mehr
   verwendete Bilder verschwinden dadurch automatisch.
   ========================================================================= */
const SHOT_REF_PREFIX = "shot:";

// cyrb53: kurze, schnelle 53-Bit-Prüfsumme. Keine Kryptografie, aber fuer die
// Wiedererkennung identischer Bilder mehr als ausreichend (zusaetzlich geht die
// Länge in den Schlüssel ein).
function shotKey(str){
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for(let i = 0, ch; i < str.length; i++){
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const n = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return n.toString(36) + "-" + str.length.toString(36);
}

// Ruft fn fuer jedes Screenshot-Array auf — Trades haben { htf, ltf, sonstige },
// Erkenntnisse eine flache Liste.
function forEachShotArray(list, fn){
  (list || []).forEach(item=>{
    if(!item || typeof item !== "object") return;
    const sc = item.screenshots;
    if(Array.isArray(sc)) fn(sc);
    else if(sc && typeof sc === "object"){
      Object.keys(sc).forEach(k=>{ if(Array.isArray(sc[k])) fn(sc[k]); });
    }
  });
}

// Liefert eine Kopie der Liste, in der alle Bilddaten durch Verweise ersetzt sind;
// die Bilder selbst landen in store.
function dedupeShots(list, store){
  const copy = JSON.parse(JSON.stringify(list || []));
  forEachShotArray(copy, arr=>{
    for(let i = 0; i < arr.length; i++){
      const u = arr[i];
      if(typeof u === "string" && u.indexOf("data:") === 0){
        const k = shotKey(u);
        if(!store[k]) store[k] = u;
        arr[i] = SHOT_REF_PREFIX + k;
      }
    }
  });
  return copy;
}

// Ersetzt Verweise wieder durch die echten Bilddaten (direkt in der Liste).
function expandShots(list, store){
  forEachShotArray(list, arr=>{
    for(let i = arr.length - 1; i >= 0; i--){
      const u = arr[i];
      if(typeof u === "string" && u.indexOf(SHOT_REF_PREFIX) === 0){
        const data = store[u.slice(SHOT_REF_PREFIX.length)];
        if(data) arr[i] = data;
        else arr.splice(i, 1); // Bild nicht mehr vorhanden — toten Verweis entfernen
      }
    }
  });
  return list;
}

function loadShotStore(){
  try{ return JSON.parse(localStorage.getItem(LS_SHOTS)) || {}; }
  catch(e){ return {}; }
}

// Schreibt Trades, Erkenntnisse und Bild-Speicher gemeinsam — sie gehören
// zusammen, weil die Verweise sonst ins Leere zeigen würden. Die alten Stände
// werden vorher entfernt, damit nicht kurzzeitig alter UND neuer Stand ins
// 5-MB-Kontingent passen müssen. Schlägt ein Schreibvorgang fehl (Speicher
// voll), wird der vorherige Stand wiederhergestellt.
function persistLocalData(){
  const store = {};
  const trades = dedupeShots(STATE.trades, store);
  const insights = dedupeShots(STATE.insights, store);
  const prevShots = localStorage.getItem(LS_SHOTS);
  const prevTrades = localStorage.getItem(LS_TRADES);
  const prevInsights = localStorage.getItem(LS_INSIGHTS);
  try{
    localStorage.removeItem(LS_SHOTS);
    localStorage.removeItem(LS_TRADES);
    localStorage.removeItem(LS_INSIGHTS);
  }catch(e){}
  const ok = safeSetItem(LS_SHOTS, JSON.stringify(store))
          && safeSetItem(LS_TRADES, JSON.stringify(trades))
          && safeSetItem(LS_INSIGHTS, JSON.stringify(insights));
  if(!ok){
    try{
      if(prevShots !== null) localStorage.setItem(LS_SHOTS, prevShots);
      if(prevTrades !== null) localStorage.setItem(LS_TRADES, prevTrades);
      if(prevInsights !== null) localStorage.setItem(LS_INSIGHTS, prevInsights);
    }catch(e){}
  }
  return ok;
}

function loadTrades(){
  try{
    const trades = expandShots(JSON.parse(localStorage.getItem(LS_TRADES)) || [], loadShotStore());
    return migrateTrades(trades);
  }
  catch(e){ return []; }
}
// Schreibt einen Wert in den localStorage und fängt den Fall ab, dass der Speicher voll
// ist (Browser-Limit ~5 MB, wird v. a. durch eingebettete Screenshots erreicht). Ohne
// diese Absicherung würde setItem eine QuotaExceededError werfen, der Eintrag bliebe nur
// im Arbeitsspeicher und wäre nach dem nächsten Neuladen weg — obwohl "gespeichert"
// gemeldet wurde. Gibt true zurück, wenn wirklich geschrieben wurde.
let storageFullWarned = false;
function safeSetItem(key, value){
  try{
    localStorage.setItem(key, value);
    storageFullWarned = false;
    return true;
  }catch(err){
    console.error("localStorage-Schreibfehler für " + key, err);
    if(!storageFullWarned){
      storageFullWarned = true;
      toast("⚠ Lokaler Speicher voll — Änderung konnte NICHT gespeichert werden! Bitte Backup exportieren und Screenshots reduzieren (z. B. Bild-URLs statt Uploads).", null, null, 12000);
    }
    return false;
  }
}
function saveTrades(){ if(persistLocalData()) markDataChanged(); }

function loadConfig(){
  try{
    const stored = JSON.parse(localStorage.getItem(LS_CONFIG));
    if(!stored) return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    // merge: falls neue Default-Keys dazukommen, nicht verlieren
    return Object.assign(JSON.parse(JSON.stringify(DEFAULT_CONFIG)), stored);
  }catch(e){ return JSON.parse(JSON.stringify(DEFAULT_CONFIG)); }
}
function saveConfig(){ if(safeSetItem(LS_CONFIG, JSON.stringify(STATE.config))) markDataChanged(); }

function loadInsights(){
  try{ return expandShots(JSON.parse(localStorage.getItem(LS_INSIGHTS)) || [], loadShotStore()); }
  catch(e){ return []; }
}
function saveInsights(){ if(persistLocalData()) markDataChanged(); }

// Tage, die manuell als "journaliert" bestätigt wurden, obwohl kein Trade/keine Erkenntnis
// eingetragen wurde (z. B. "kein Setup heute, aber bewusst geprüft"). Liste von ISO-Daten.
function loadDayConfirmations(){
  try{
    const v = JSON.parse(localStorage.getItem(LS_DAYCONFIRM));
    return Array.isArray(v) ? v : [];
  }catch(e){ return []; }
}
function saveDayConfirmations(){ if(safeSetItem(LS_DAYCONFIRM, JSON.stringify(STATE.dayConfirmations))) markDataChanged(); }

/* =========================================================================
   DEMO-DATEN
   Fiktive Beispiel-Trades zum Beurteilen der Oberfläche. Werden NUR beim
   allerersten Start eingefügt (kein tj_trades_v1 im localStorage vorhanden) —
   sobald einmal echte Trades existieren, greift das nie wieder, damit nichts
   überschrieben wird. Einfach über die normalen Löschen-Buttons entfernbar,
   oder localStorage-Key tj_trades_v1 leeren.
   ========================================================================= */
function buildDemoTrades(){
  const mk = (o) => Object.assign({
    id: "demo-" + Math.random().toString(36).slice(2),
    richtung:null, markt:null, session:null, art:null, level:null, trend:null,
    kriterien:[], invalidierung:[], zeiteinheit:null,
    ergebnis:null, r:null, genommen:undefined, grundNichtGenommen:"", mentor:false,
    notizen:"", screenshots:{ htf:[], ltf:[], sonstige:[] }
  }, o, {
    createdAt: new Date(o.date+"T12:00:00").getTime(),
    updatedAt: new Date(o.date+"T12:00:00").getTime()
  });

  const liveCeId = "demo-live-ce-0714";
  const liveSeId = "demo-live-se-0814";

  return [
    // ---- LIVE ----
    mk({id:liveCeId, area:"live", date:"2026-07-14", richtung:"Long", markt:"XAUUSD", session:"London", art:"CE", level:"50", trend:"pro", kriterien:["BOS/ChoCh","IMB","LQs"], zeiteinheit:"m5", ergebnis:"TP", r:2, notizen:"Sauberer CE nach Liquidity-Grab, Ausführung nach Plan.", copiedToEod:true}),
    mk({area:"live", date:"2026-07-15", richtung:"Short", markt:"GBPUSD", session:"New York", art:"SE", level:"32", trend:"Counter", invalidierung:["v. Zone"], zeiteinheit:"m15", ergebnis:"SL", r:-1, notizen:"Zu früh eingestiegen, Setup war noch nicht fertig."}),
    mk({area:"live", date:"2026-07-17", richtung:"Long", markt:"XAUUSD", session:"London", art:"71er", level:"71", trend:"pro", kriterien:["LQ davor","LQ n. davor"], zeiteinheit:"m5", ergebnis:"TP", r:3, notizen:"Bestes Setup der Woche, Geduld hat sich ausgezahlt."}),
    mk({area:"live", date:"2026-07-21", richtung:"Short", markt:"DAX", session:"New York", art:"Continuation", level:"50", trend:"pro", zeiteinheit:"m15", ergebnis:"BE", r:0, notizen:"Auf BE nachgezogen, solide Entscheidung."}),
    mk({area:"live", date:"2026-07-24", richtung:"Long", markt:"BTCUSD", session:"Out of Session", art:"Limit", level:"passiv", trend:"Counter", invalidierung:["50%"], zeiteinheit:"m1", ergebnis:"SL", r:-1, notizen:"Gegen den Trend gehandelt, Lehrgeld gezahlt."}),
    mk({area:"live", date:"2026-07-29", richtung:"Long", markt:"GBPUSD", session:"London", art:"CE", level:"32", trend:"pro", kriterien:["BOS/ChoCh","IMB","LQs"], zeiteinheit:"m5", ergebnis:"TP", r:2, notizen:"Nach Plan, Einstieg etwas spät aber ok."}),
    mk({area:"live", date:"2026-08-04", richtung:"Short", markt:"XAUUSD", session:"New York", art:"Flip", level:"50", trend:"Counter", invalidierung:["kein B/C"], zeiteinheit:"m15", ergebnis:"SL", r:-1, notizen:"B/C hat gefehlt, trotzdem genommen — Fehler."}),
    mk({area:"live", date:"2026-08-06", richtung:"Long", markt:"DAX", session:"London", art:"Counter", level:"71", trend:"pro", kriterien:["BOS/ChoCh","EZ/IND","GB","LQ-Ziel"], zeiteinheit:"m5", ergebnis:"TP", r:2.5, notizen:"Gutes Reversal-Setup, Timing hat gepasst."}),
    mk({area:"live", date:"2026-08-12", richtung:"Long", markt:"XAUUSD", session:"New York", art:"CE", level:"50", trend:"pro", kriterien:["BOS/ChoCh","IMB","LQs"], zeiteinheit:"m5", notizen:"Noch offen, laufe mit Teilgewinn."}),
    mk({id:liveSeId, area:"live", date:"2026-08-14", richtung:"Short", markt:"GBPUSD", session:"London", art:"SE", level:"32", trend:"Counter", invalidierung:["Trendline"], zeiteinheit:"m15", ergebnis:"TP", r:1.5, notizen:"Kleiner sauberer Trade zum Wochenausklang.", copiedToEod:true}),

    // ---- EOD ----
    mk({area:"eod", date:"2026-07-14", richtung:"Long", markt:"XAUUSD", session:"London", art:"CE", level:"50", trend:"pro", kriterien:["BOS/ChoCh","IMB","LQs"], zeiteinheit:"m5", ergebnis:"TP", r:2, genommen:true, notizen:"Wie live gehandelt.", copiedFromLiveId:liveCeId}),
    mk({area:"eod", date:"2026-07-18", richtung:"Short", markt:"BTCUSD", session:"Out of Session", art:"Flip", level:"passiv", trend:"Counter", invalidierung:["50%"], zeiteinheit:"m1", ergebnis:"SL", r:-1, genommen:false, grundNichtGenommen:"News-Risiko, Setup bewusst abgewartet."}),
    mk({area:"eod", date:"2026-07-22", richtung:"Long", markt:"DAX", session:"New York", art:"71er", level:"71", trend:"pro", kriterien:["BOS/ChoCh","EZ/IND","GB","LQ-Ziel"], zeiteinheit:"m15", ergebnis:"TP", r:2.5, genommen:false, grundNichtGenommen:"Zu spät gesehen, Zug war schon fast durch."}),
    mk({area:"eod", date:"2026-07-28", richtung:"Short", markt:"XAUUSD", session:"London", art:"Continuation", level:"50", trend:"Counter", zeiteinheit:"m5", ergebnis:"SL", r:-1, genommen:true, notizen:"Sauber genommen, hat einfach nicht funktioniert."}),
    mk({area:"eod", date:"2026-08-01", richtung:"Long", markt:"GBPUSD", session:"New York", art:"CE", level:"32", trend:"pro", kriterien:["BOS/ChoCh","IMB","LQs"], zeiteinheit:"m5", ergebnis:"TP", r:1.5, genommen:false, grundNichtGenommen:"Unsicher wegen anstehender News, ausgelassen."}),
    mk({area:"eod", date:"2026-08-07", richtung:"Short", markt:"DAX", session:"London", art:"SE", level:"71", trend:"Counter", invalidierung:["Trendline"], zeiteinheit:"m15", ergebnis:"BE", r:0, genommen:true, notizen:"Auf BE rausgenommen."}),
    mk({area:"eod", date:"2026-08-11", richtung:"Long", markt:"XAUUSD", session:"New York", art:"71er", level:"71", trend:"pro", kriterien:["LQ davor","LQ n. davor"], zeiteinheit:"m5", ergebnis:"TP", r:3, genommen:false, grundNichtGenommen:"Setup kam nachts, verpasst."}),
    mk({area:"eod", date:"2026-08-14", richtung:"Short", markt:"GBPUSD", session:"London", art:"SE", level:"32", trend:"Counter", invalidierung:["Trendline"], zeiteinheit:"m15", ergebnis:"TP", r:1.5, genommen:true, notizen:"Wie live gehandelt.", copiedFromLiveId:liveSeId}),
  ];
}

