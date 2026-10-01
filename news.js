/* js/news.js — News-Daten: Import, Zeitzonen, Speicherung (ohne Oberfläche) */
/* =========================================================================
   NEWS — High-Impact-Wirtschaftstermine ("3 Sterne") per Import
   Seit 2026.09.26 kein automatischer Abruf mehr (Feed + CORS-Proxy-Kette war
   dauerhaft unzuverlässig). Stattdessen:
     1. Screenshot vom Investing.com-Wirtschaftskalender machen
     2. Screenshot + NEWS_PROMPT (Button "Prompt kopieren") an Claude geben
     3. Claudes Antwort (enthält einen JSON-Block) im News-Dialog einfügen
   Die Termine liegen danach lokal (LS_NEWS) und reisen über Backup/Drive-Sync
   mit — die Startseite funktioniert damit komplett ohne Internet.

   Speicherformat (bewusst kompakt, leere Felder werden weggelassen):
     STATE.news = {
       events: [{ ts: <ms UTC> | undefined, d: "YYYY-MM-DD" (Wiener Datum),
                  c: "USD", n: "Titel", f: "Prognose", p: "Vorher" }],
       ranges: [["YYYY-MM-DD","YYYY-MM-DD"], ...],  // abgedeckte Zeiträume
       importedAt: <ms>
     }
   Termine ohne ts sind ganztägig. Ein neuer Import ersetzt nur die Tage, die
   er selbst abdeckt; alles älter als NEWS_KEEP_PAST_DAYS wird entfernt, damit
   der 5-MB-localStorage und die Cloud-Datei nicht dauerhaft wachsen.
   ========================================================================= */
const NEWS_TZ = "Europe/Vienna";
const NEWS_KEEP_PAST_DAYS = 90;
const NEWS_CALENDAR_URL = "https://de.investing.com/economic-calendar/";

// Prompt für Claude — per Button "Prompt kopieren" in die Zwischenablage.
const NEWS_PROMPT = `Du bekommst einen oder mehrere Screenshots des Wirtschaftskalenders von Investing.com. Erstelle daraus eine Importdatei für mein Trading-Journal.

REGELN
1. Übernimm AUSSCHLIESSLICH Termine mit Wichtigkeit 3 (drei Stern-/Stier-Symbole in der Spalte „Wichtigkeit“; die Symbole können grau dargestellt sein). Termine mit 1 oder 2 Symbolen ignorierst du, ebenso Feiertage (Zeilen mit „Feiertag“ statt Symbolen).
2. Das Datum steht als Zwischenüberschrift über den Terminen (z. B. „Mittwoch, 2. September 2026“). Jeder Termin gehört zur letzten Datumsüberschrift darüber – auch wenn diese auf einem vorherigen Screenshot steht. Termine OBERHALB der ersten sichtbaren Datumsüberschrift (ohne eigene Überschrift) lässt du weg, weil ihr Datum nicht sicher ist, und nennst sie unter C.
3. Uhrzeit exakt wie angezeigt übernehmen (HH:MM, 24 h) und NICHT umrechnen. Steht dort „Ganztags“, „Ganztägig“, „Tentative“ oder keine Uhrzeit: "zeit": "".
4. Zeitzone: aus der Zeitangabe des Kalenders übernehmen (z. B. „GMT +2:00“ → "+02:00"). Ist keine erkennbar, nimm "+02:00".
5. "land" = das Länderkürzel genau wie in der Spalte neben der Flagge (z. B. US, DE, EU, GB, JP, CA, NZ, CN). Titel so übernehmen, wie er auf der Seite steht, inkl. Zeitraum wie „(Aug)“ oder „(Q3)“, aber ohne Zusatzsymbole wie „P“ (vorläufig). Zeilenumbrüche im Titel durch ein Leerzeichen ersetzen.
6. "prognose" und "vorher" als Text genau wie angezeigt (z. B. "0,3 %", "47K", "7,330M"). Die Spalte „Aktuell“ brauchst du nicht. Nicht lesbar oder leer → "".
7. Nichts erfinden. Bist du bei der Anzahl der Symbole unsicher, nimm den Termin auf und ergänze "unsicher": true.
8. "von" und "bis" = erster und letzter Kalendertag, der VOLLSTÄNDIG zu sehen ist (Datumsüberschrift sichtbar UND die nächste Datumsüberschrift bzw. das Tabellenende folgt). Auch Tage ohne 3-Sterne-Termin in diesem Zeitraum zählen dazu. Ist der letzte Tag unten abgeschnitten, lass ihn samt seinen Terminen weg und nenne ihn unter C.
9. Chronologisch sortieren. Überlappen sich Screenshots, jeden Termin nur einmal aufnehmen.

AUSGABE – genau in dieser Reihenfolge:
A) EIN Codeblock \`\`\`json mit exakt diesem Aufbau (sonst nichts im Codeblock):
{
  "typ": "journal-news",
  "version": 1,
  "zeitzone": "+02:00",
  "von": "2026-09-28",
  "bis": "2026-10-02",
  "termine": [
    { "datum": "2026-09-29", "zeit": "16:00", "land": "US", "titel": "CB Verbrauchervertrauen (Sep)", "prognose": "", "vorher": "97,4" }
  ]
}
B) Darunter eine kurze Kontrollübersicht: pro Tag eine Zeile mit Datum und Anzahl der 3-Sterne-Termine.
C) Hinweise nur, falls etwas unklar war (abgeschnittene Zeilen, fehlende Datumsüberschrift, Lücken im Zeitraum).`;

const NEWS_COUNTRY_FLAG = {
  USD:"🇺🇸", EUR:"🇪🇺", GBP:"🇬🇧", JPY:"🇯🇵", CHF:"🇨🇭",
  AUD:"🇦🇺", NZD:"🇳🇿", CAD:"🇨🇦", CNY:"🇨🇳"
};

/* ---------- Laden / Speichern ---------- */
function emptyNewsStore(){ return { events: [], ranges: [], importedAt: null }; }

function sanitizeNewsStore(v){
  if(!v || typeof v !== "object" || !Array.isArray(v.events)) return emptyNewsStore();
  return {
    events: v.events.filter(e=> e && typeof e.d === "string" && typeof e.n === "string"),
    ranges: Array.isArray(v.ranges) ? v.ranges.filter(r=> Array.isArray(r) && r.length===2 && r[0] <= r[1]) : [],
    importedAt: v.importedAt || null
  };
}

function loadNews(){
  // Alter Feed-Cache (bis 2026.09.25) wird nicht mehr gebraucht — Platz freigeben.
  try{ localStorage.removeItem("tj_newscache_v1"); }catch(e){}
  try{ return pruneNewsStore(sanitizeNewsStore(JSON.parse(localStorage.getItem(LS_NEWS)))); }
  catch(e){ return emptyNewsStore(); }
}
function saveNews(){ if(safeSetItem(LS_NEWS, JSON.stringify(STATE.news))) markDataChanged(); }

/* ---------- Datum/Zeit (immer Wiener Ortszeit, unabhängig vom Gerät) ---------- */
function viennaParts(ts){
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone:NEWS_TZ, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hourCycle:"h23" }).formatToParts(new Date(ts));
  const o = {}; parts.forEach(p=>{ o[p.type] = p.value; });
  return o;
}
function viennaDateISO(ts){ const o = viennaParts(ts); return `${o.year}-${o.month}-${o.day}`; }
function viennaTimeHM(ts){ const o = viennaParts(ts); return `${o.hour}:${o.minute}`; }
function newsTodayISO(){ return viennaDateISO(Date.now()); }

function isoAddDays(iso, n){
  const [y,m,d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m-1, d + n));
  return dt.toISOString().slice(0,10);
}
function isoWeekday(iso){ // Mo=0 … So=6
  const [y,m,d] = iso.split("-").map(Number);
  return (new Date(Date.UTC(y, m-1, d)).getUTCDay() + 6) % 7;
}
function isoWeekdayShort(iso){ return ["Mo","Di","Mi","Do","Fr","Sa","So"][isoWeekday(iso)]; }
function formatNewsDay(iso){ const [y,m,d] = iso.split("-"); return `${isoWeekdayShort(iso)} ${d}.${m}.`; }

// Wandelt eine Wanduhrzeit (Datum + HH:MM) aus Zeitzone tz in einen UTC-Zeitstempel um.
// tz: "+02:00" / "-05:00" (fester Versatz) oder "Europe/Vienna" (Sommer-/Winterzeit automatisch).
function newsWallToTs(dateIso, hm, tz){
  const [y,mo,d] = dateIso.split("-").map(Number);
  const [h,mi] = hm.split(":").map(Number);
  const wall = Date.UTC(y, mo-1, d, h, mi);
  const fixed = /^([+-])(\d{2}):(\d{2})$/.exec(tz);
  if(fixed){
    const off = (parseInt(fixed[2],10)*60 + parseInt(fixed[3],10)) * (fixed[1]==="-" ? -1 : 1);
    return wall - off*60000;
  }
  // Benannte Zeitzone: Versatz iterativ bestimmen (2 Runden genügen auch rund um die Zeitumstellung)
  let ts = wall;
  for(let i=0;i<2;i++){
    const o = new Intl.DateTimeFormat("en-CA", { timeZone:tz, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hourCycle:"h23" }).formatToParts(new Date(ts))
      .reduce((a,p)=>{ a[p.type]=p.value; return a; }, {});
    const asUtc = Date.UTC(+o.year, +o.month-1, +o.day, +o.hour, +o.minute);
    ts = wall - (asUtc - ts);
  }
  return ts;
}

// Akzeptiert "+02:00", "+2", "GMT+2", "GMT +2:00", "UTC+01:00", "Europe/Vienna"
function normalizeNewsTz(v){
  if(!v) return "+02:00";
  const s = String(v).trim();
  if(/^[A-Za-z]+\/[A-Za-z_]+$/.test(s)) return s;
  const m = /([+-])\s*(\d{1,2})(?::?(\d{2}))?/.exec(s);
  if(m) return `${m[1]}${m[2].padStart(2,"0")}:${m[3]||"00"}`;
  if(/^(gmt|utc)$/i.test(s)) return "+00:00";
  return "+02:00";
}
function newsTzLabel(tz){
  if(tz === NEWS_TZ) return "Wiener Ortszeit (keine Umrechnung)";
  return "GMT" + tz.replace(/^([+-])0?(\d+):00$/, "$1$2").replace(/^([+-])0?(\d+):(\d{2})$/, "$1$2:$3");
}

/* ---------- Import: Text -> geprüfte Termine ---------- */
// Holt das JSON aus beliebigem Text — ganze Claude-Antwort, nur der Codeblock oder eine .json-Datei.
function extractNewsJson(text){
  const tries = [];
  const t = String(text||"").trim();
  if(!t) return null;
  tries.push(t);
  const fenceRe = /```(?:json)?\s*([\s\S]*?)```/gi;
  let m;
  while((m = fenceRe.exec(t))) tries.push(m[1]);
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if(a >= 0 && b > a) tries.push(t.slice(a, b+1));
  for(const s of tries){
    try{
      const v = JSON.parse(s.replace(/[“”„]/g, '"')); // typografische Anführungszeichen tolerieren
      if(Array.isArray(v)) return { termine: v };
      if(v && typeof v === "object" && (Array.isArray(v.termine) || Array.isArray(v.events))) return v;
    }catch(e){}
  }
  return null;
}

// Liefert { ok, error, events, from, to, tz, skipped, unsure } — tzOverride überschreibt die Zeitzone der Datei.
function parseNewsImport(text, tzOverride){
  const data = extractNewsJson(text);
  if(!data) return { ok:false, error:"Kein gültiger News-Block gefunden. Bitte die komplette Antwort von Claude (mit dem ```json-Block) einfügen." };
  const list = data.termine || data.events || [];
  const fileTz = normalizeNewsTz(data.zeitzone || data.timezone || data.tz);
  const tz = tzOverride || fileTz;
  const events = [];
  let skipped = 0, unsure = 0;
  const seen = new Set();
  list.forEach(r=>{
    if(!r || typeof r !== "object"){ skipped++; return; }
    const datum = String(r.datum || r.date || "").trim();
    let zeit = String(r.zeit || r.time || "").trim();
    const cur = String(r.land || r.waehrung || r.währung || r.currency || "").trim().toUpperCase().slice(0,6);
    const title = String(r.titel || r.title || r.ereignis || "").trim().slice(0,120);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(datum) || !title){ skipped++; return; }
    const tm = /^(\d{1,2})[:.](\d{2})$/.exec(zeit);
    if(zeit && !tm){ zeit = ""; } // "Ganztägig", "Tentative" …
    const ev = { d: datum, c: cur, n: title };
    if(tm){
      const hm = tm[1].padStart(2,"0") + ":" + tm[2];
      ev.ts = newsWallToTs(datum, hm, tz);
      ev.d = viennaDateISO(ev.ts); // kann sich durch die Umrechnung um einen Tag verschieben
    }
    const f = String(r.prognose ?? r.forecast ?? "").trim().slice(0,20);
    const p = String(r.vorher ?? r.previous ?? "").trim().slice(0,20);
    if(f) ev.f = f;
    if(p) ev.p = p;
    if(r.unsicher === true) unsure++;
    const key = ev.d + "|" + (ev.ts||"") + "|" + ev.c + "|" + ev.n.toLowerCase();
    if(seen.has(key)) return;
    seen.add(key);
    events.push(ev);
  });
  if(!events.length) return { ok:false, error: list.length ? "Keiner der Termine war gültig (Datum im Format JJJJ-MM-TT und Titel nötig)." : "Der News-Block enthält keine Termine." };
  events.sort(newsSortFn);
  const dates = events.map(e=>e.d).sort();
  let from = /^\d{4}-\d{2}-\d{2}$/.test(data.von||"") ? data.von : dates[0];
  let to = /^\d{4}-\d{2}-\d{2}$/.test(data.bis||"") ? data.bis : dates[dates.length-1];
  if(from > to) [from, to] = [to, from];
  if(dates[0] < from) from = dates[0];
  if(dates[dates.length-1] > to) to = dates[dates.length-1];
  return { ok:true, events, from, to, tz, fileTz, skipped, unsure };
}

function newsSortFn(a,b){
  if(a.d !== b.d) return a.d < b.d ? -1 : 1;
  const at = a.ts == null ? -Infinity : a.ts, bt = b.ts == null ? -Infinity : b.ts; // ganztägig zuerst
  if(at !== bt) return at - bt;
  return a.c.localeCompare(b.c);
}

/* ---------- Zusammenführen & Aufräumen ---------- */
function mergeNewsRanges(ranges){
  const sorted = ranges.slice().sort((a,b)=> a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  const out = [];
  sorted.forEach(r=>{
    const last = out[out.length-1];
    if(last && r[0] <= isoAddDays(last[1], 1)){ if(r[1] > last[1]) last[1] = r[1]; }
    else out.push([r[0], r[1]]);
  });
  return out;
}

function pruneNewsStore(store){
  const cutoff = isoAddDays(newsTodayISO(), -NEWS_KEEP_PAST_DAYS);
  store.events = store.events.filter(e=> e.d >= cutoff);
  // Prognose/Vorwert sind nach dem Termin wertlos — nach einer Woche entfernen (spart ~30 % Platz)
  const slim = isoAddDays(newsTodayISO(), -7);
  store.events.forEach(e=>{ if(e.d < slim){ delete e.f; delete e.p; } });
  store.ranges = mergeNewsRanges(store.ranges.filter(r=> r[1] >= cutoff).map(r=> [r[0] < cutoff ? cutoff : r[0], r[1]]));
  return store;
}

// Wie viele vorhandene Termine würde ein Import ersetzen?
function newsReplacedCount(from, to){
  return STATE.news.events.filter(e=> e.d >= from && e.d <= to).length;
}

function applyNewsImport(parsed){
  const store = STATE.news;
  store.events = store.events.filter(e=> e.d < parsed.from || e.d > parsed.to).concat(parsed.events).sort(newsSortFn);
  store.ranges = mergeNewsRanges(store.ranges.concat([[parsed.from, parsed.to]]));
  store.importedAt = Date.now();
  pruneNewsStore(store);
  saveNews();
}

/* ---------- Abfragen für die Anzeige ---------- */
function newsForDate(iso){ return STATE.news.events.filter(e=> e.d === iso); }
function newsCovers(iso){ return STATE.news.ranges.some(r=> iso >= r[0] && iso <= r[1]); }
// Letzter abgedeckter Tag des zusammenhängenden Zeitraums, der heute enthält (oder null)
function newsCoverageEndFrom(iso){
  const r = STATE.news.ranges.find(r=> iso >= r[0] && iso <= r[1]);
  return r ? r[1] : null;
}
function newsStoreBytes(){ return JSON.stringify(STATE.news).length * 2; }


// Gemerkte Ansicht der News-Kachel ("heute" | "woche") — hier statt in start.js, weil
// STATE (js/state.js) sie schon beim Laden braucht.
function loadNewsView(){ try{ return localStorage.getItem(LS_NEWS_VIEW) === "woche" ? "woche" : "heute"; }catch(e){ return "heute"; } }
function saveNewsView(v){ try{ localStorage.setItem(LS_NEWS_VIEW, v); }catch(e){} }
