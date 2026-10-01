/* start.js — Startseite: Sessions, Kennzahlen, Equity, Routine, News-Kachel und News-Dialog */
/* =========================================================================
   START (Startseite / Dashboard)
   Begrüßung, Live-Datum/Uhrzeit und der Cloud-Status auf einen Blick, direkt
   beim Öffnen des Journals — statt den Drive-Status im Bericht suchen zu müssen.
   ========================================================================= */
// Handelssessions anhand der echten Ortszeit in London bzw. New York (Intl berücksichtigt
// die jeweilige Sommer-/Winterzeit automatisch — vorher war das eine feste UTC-Näherung,
// die im Winter um eine Stunde daneben lag). Session = 8:00–17:00 Ortszeit, Mo–Fr.
// Bei Überlappung (London + New York gleichzeitig) hat New York Vorrang, da dort meist
// das höhere Volumen liegt.
function localHourIn(timeZone, date){
  try{
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour:"numeric", minute:"numeric", weekday:"short", hour12:false }).formatToParts(date);
    const get = type => (parts.find(p=>p.type===type)||{}).value;
    const hour = parseInt(get("hour"), 10) % 24; // "24" bei Mitternacht in manchen Engines
    const minute = parseInt(get("minute"), 10) || 0;
    const weekday = get("weekday") || "";
    return { h: hour + minute/60, weekend: weekday === "Sat" || weekday === "Sun" };
  }catch(e){
    // Fallback ohne Zeitzonen-Unterstützung: alte UTC-Näherung
    const h = date.getUTCHours() + date.getUTCMinutes()/60;
    const d = date.getUTCDay();
    return { h: timeZone === "Europe/London" ? h + 1 : h - 4, weekend: d === 0 || d === 6 };
  }
}
/* ---------- Session-Tagesleiste ----------
   Die beiden für die Strategie relevanten Sessions laufen von 08:00 bis 17:00
   ORTSZEIT in London bzw. New York. Weil sich Sommer-/Winterzeit in Europa und
   den USA an unterschiedlichen Tagen umstellen, wird die Lage der Blöcke nicht
   fest verdrahtet, sondern jedes Mal aus der echten Ortszeit berechnet: Die
   Differenz zwischen der Uhrzeit hier und der Uhrzeit dort verschiebt das
   Fenster auf der Leiste automatisch mit. */
const SESSION_DEFS = [
  { key:"london",  label:"London",   tz:"Europe/London",     cls:"sesstl-ldn", color:"var(--sess-ldn)", open:8, close:17 },
  { key:"newyork", label:"New York", tz:"America/New_York",  cls:"sesstl-nyc", color:"var(--sess-nyc)", open:8, close:17 }
];

function sessionTimeline(now){
  const d = now || new Date();
  const deviceH = d.getHours() + d.getMinutes()/60 + d.getSeconds()/3600;
  const blocks = SESSION_DEFS.map(def=>{
    const z = localHourIn(def.tz, d);
    let diff = deviceH - z.h;          // Zeitverschiebung zwischen hier und dort
    while(diff > 12) diff -= 24;       // über die Datumsgrenze normalisieren
    while(diff <= -12) diff += 24;
    return Object.assign({}, def, {
      start: def.open + diff,
      end:   def.close + diff,
      zoneH: z.h,
      weekend: z.weekend,
      open_: !z.weekend && z.h >= def.open && z.h < def.close
    });
  });
  // Läuft beides, gewinnt New York — das ist die aktivere Session.
  const openBlocks = blocks.filter(b=>b.open_);
  const current = openBlocks.length ? openBlocks[openBlocks.length-1] : null;
  const weekend = blocks.every(b=>b.weekend);

  let next = null;
  if(!current && !weekend){
    blocks.forEach(b=>{
      if(b.weekend) return;
      const inHours = ((b.open - b.zoneH) + 24) % 24;
      if(!next || inHours < next.inHours) next = { label:b.label, inHours };
    });
  }
  return { blocks, current, next, weekend, nowH: deviceH };
}

// "7:12 Std" — Stunden und Minuten, wie in der Restzeit-Anzeige gebraucht.
function formatDurationHM(hours){
  const total = Math.max(0, Math.round(hours * 60));
  return Math.floor(total/60) + ":" + String(total % 60).padStart(2, "0") + " Std";
}

function renderSessionTimeline(){
  const tl = sessionTimeline();
  const pc = h => Math.max(0, Math.min(100, h / 24 * 100));
  const clip = (a, b) => ({ left: pc(a), width: pc(b) - pc(a) });

  const blockHtml = tl.blocks.map(b=>{
    const g = clip(b.start, b.end);
    if(g.width <= 0) return "";
    return `<div class="sesstl-block ${b.cls}" style="left:${g.left}%; width:${g.width}%;">${b.label.toUpperCase()}</div>`;
  }).join("");

  // Überlappung beider Sessions (die aktivste Phase des Tages) etwas heller.
  let overlapHtml = "";
  if(tl.blocks.length === 2){
    const a = tl.blocks[0], b = tl.blocks[1];
    const from = Math.max(a.start, b.start), to = Math.min(a.end, b.end);
    if(to > from){
      const g = clip(from, to);
      if(g.width > 0) overlapHtml = `<div class="sesstl-block sesstl-overlap" style="left:${g.left}%; width:${g.width}%;"></div>`;
    }
  }

  let axis = "";
  for(let h = 0; h <= 24; h += 4) axis += `<span style="left:${pc(h)}%">${String(h).padStart(2,"0")}</span>`;

  let cap;
  if(tl.weekend){
    cap = `<b>Wochenende</b> · London öffnet Montag`;
  }else if(tl.current){
    cap = `<b style="color:${tl.current.color};">${tl.current.label} offen</b> · noch ${formatDurationHM(tl.current.close - tl.current.zoneH)}`;
  }else if(tl.next){
    cap = `<b>Keine Session</b> · ${tl.next.label} öffnet in ${formatDurationHM(tl.next.inHours)}`;
  }else{
    cap = `<b>Keine Session</b>`;
  }

  return `<div class="sesstl${tl.weekend?" sesstl-weekend":""}" id="sessionTimeline">
      <div class="sesstl-bar">
        ${blockHtml}${overlapHtml}
        <div class="sesstl-now" style="left:${pc(tl.nowH)}%"></div>
      </div>
      <div class="sesstl-axis">${axis}</div>
      <div class="sesstl-cap">${cap}</div>
    </div>`;
}

function journaledTodayCount(){
  const t = todayISO();
  return STATE.trades.filter(x=>x.date===t).length + STATE.insights.filter(x=>x.date===t).length;
}

function isTodayConfirmed(){
  return STATE.dayConfirmations.includes(todayISO());
}

// Bestätigt (bzw. macht rückgängig), dass der heutige Tag journaliert wurde, auch ohne
// Trades/Erkenntnisse — z. B. "kein Setup heute, aber bewusst geprüft".
function toggleTodayConfirmed(){
  const t = todayISO();
  const idx = STATE.dayConfirmations.indexOf(t);
  if(idx > -1) STATE.dayConfirmations.splice(idx,1);
  else STATE.dayConfirmations.push(t);
  saveDayConfirmations();
  render();
}

let startClockInterval = null;
function stopStartClock(){
  if(startClockInterval){ clearInterval(startClockInterval); startClockInterval = null; }
}
// GEÄNDERT (Stufe 4): Uhrzeit sekündlich (nur Text), die Session-Karte aber nur noch beim
// Minutenwechsel neu — Status, Restzeit und nächster Termin ändern sich höchstens minütlich,
// vorher wurde die ganze Karte 60× pro Minute ausgetauscht.
let startSessMinute = -1;
function startStartClock(){
  stopStartClock();
  startSessMinute = Math.floor(Date.now() / 60000); // Karte wurde gerade frisch gerendert
  startClockInterval = setInterval(()=>{
    const el = document.getElementById("liveClock");
    if(!el){ stopStartClock(); return; }
    el.textContent = formatLiveTime();
    // Session-Karte wandert mit: Status, Tagesleiste, Restzeit und nächster News-Termin.
    const minute = Math.floor(Date.now() / 60000);
    const sessEl = minute !== startSessMinute ? document.getElementById("startSessCard") : null;
    if(sessEl){ startSessMinute = minute; sessEl.outerHTML = renderStartSessionCard(); }
    // News-Kachel einmal pro Minute auffrischen (vergangene Termine ausgrauen, Countdown)
    refreshNewsPanelTick();
  }, 1000);
}

// Kompakte Live-Kennzahlen für die Startseite: aktuelle Woche und aktueller Monat
// (nur Bereich Live, nur Trades mit Ergebnis — offene werden separat gezählt).
function startPeriodStats(filter){
  const trades = STATE.trades.filter(t=> t.area==="live" && dateMatchesFilter(t.date, filter));
  const closed = trades.filter(t=> t.r!==null && t.r!==undefined);
  const sum = closed.reduce((a,t)=>a+t.r, 0);
  const wins = closed.filter(t=>t.r>0).length, losses = closed.filter(t=>t.r<0).length;
  return { count:trades.length, closed:closed.length, open:trades.length-closed.length, sum, wins, losses, winrate:(wins+losses)?Math.round(wins/(wins+losses)*100):null };
}
// Aktuelle Serie über die letzten geschlossenen Live-Trades (z. B. "3 Gewinner in Folge").
function startStreak(){
  const closed = STATE.trades.filter(t=> t.area==="live" && t.r!==null && t.r!==undefined && t.r!==0)
    .sort((a,b)=> (b.date||"").localeCompare(a.date||"") || (b.createdAt||0)-(a.createdAt||0));
  if(!closed.length) return null;
  const sign = closed[0].r > 0;
  let n = 0;
  for(const t of closed){ if((t.r>0)===sign) n++; else break; }
  return { n, win:sign };
}
/* ---------- Speicherverbrauch (localStorage) ----------
   Der Browser gibt jeder Seite nur rund 5 MB localStorage. Weil Screenshots als
   Base64 direkt in den Trades liegen, ist das die einzige echte Grenze der App.
   Gezählt wird in UTF-16-Einheiten (2 Byte pro Zeichen) — so rechnen Chrome und
   Safari ihre Quota ab. Die Schaetzung "noch Platz für X Screenshots" nutzt die
   durchschnittliche Größe der bereits gespeicherten Bilder. */
const LS_LIMIT_BYTES = 5 * 1024 * 1024;
const LS_FALLBACK_SHOT_BYTES = 150 * 1024; // Annahme, solange noch kein Bild gespeichert ist

function formatBytes(bytes){
  if(bytes >= 1024*1024) return (bytes/(1024*1024)).toFixed(2).replace(".", ",") + " MB";
  return Math.round(bytes/1024).toLocaleString("de-DE") + " KB";
}

function storageStats(){
  let totalChars = 0, appChars = 0, shotChars = 0, shotCount = 0;
  try{
    for(let i = 0; i < localStorage.length; i++){
      const k = localStorage.key(i);
      const v = localStorage.getItem(k) || "";
      const chars = (k ? k.length : 0) + v.length;
      totalChars += chars;
      if(k && k.indexOf("tj_") === 0) appChars += chars;
    }
  }catch(e){}
  // Identische Bilder liegen dank des gemeinsamen Bild-Speichers nur EINMAL im
  // localStorage — deshalb wird hier nach Bildinhalt entdoppelt gezählt.
  const seen = new Set();
  let dupCount = 0, dupChars = 0;
  const addShot = (u)=>{
    if(typeof u !== "string" || !u) return;
    if(u.indexOf("data:") !== 0) return;
    if(seen.has(u)){ dupCount++; dupChars += u.length; return; }
    seen.add(u);
    shotChars += u.length; shotCount++;
  };
  try{
    (STATE.trades||[]).forEach(t=>{
      const sc = t.screenshots || {};
      ["htf","ltf","sonstige"].forEach(cat=>{ (sc[cat]||[]).forEach(addShot); });
    });
    (STATE.insights||[]).forEach(i=>{ (i.screenshots||[]).forEach(addShot); });
  }catch(e){}
  const usedBytes = totalChars * 2;
  const shotBytes = shotChars * 2;
  const freeBytes = Math.max(0, LS_LIMIT_BYTES - usedBytes);
  const avgShotBytes = shotCount ? Math.round(shotBytes / shotCount) : LS_FALLBACK_SHOT_BYTES;
  return {
    usedBytes,
    appBytes: appChars * 2,
    shotBytes,
    shotCount,
    freeBytes,
    avgShotBytes,
    percent: Math.min(100, Math.round(usedBytes / LS_LIMIT_BYTES * 100)),
    shotsLeft: Math.floor(freeBytes / avgShotBytes),
    dupCount,
    dupBytes: dupChars * 2
  };
}

/* ---------- Startseite "Cockpit" ----------
   Aufbau: kompakter Foto-Kopf (Gruß, Uhr, Journal-Status, Schnellaktionen) mit
   Session-Karte rechts; darunter ein Bento-Raster aus Kennzahlen (Woche, Monat,
   Trefferquote, Serie), Equity-Kurve, Pre-Trade-Routine, letzten Trades und News.
   Sync, Speicher und Version stehen in einer schmalen Statusleiste am Ende. */
const LS_START_EQUITY_RANGE = "tj_start_eqrange_v1"; // "30" | "90" | "alles" (reine UI-Präferenz)
const LS_ROUTINE_CHECKS = "tj_routine_checks_v1";     // {date, done:[Punkt-Texte]} — nur heute, pro Gerät
const DEFAULT_ROUTINE = ["HTF-Bias notiert","News geprüft","Levels im Chart markiert","Max. 2 Trades heute","Kein Trade 15 Min vor News"];
let startRoutineEditing = false;

function startEquityRange(){ try{ const v = localStorage.getItem(LS_START_EQUITY_RANGE); return v==="30"||v==="alles" ? v : "90"; }catch(e){ return "90"; } }
function saveStartEquityRange(v){ try{ localStorage.setItem(LS_START_EQUITY_RANGE, v); }catch(e){} }

function routineItems(){
  const r = STATE.config.routine;
  return Array.isArray(r) ? r : DEFAULT_ROUTINE.slice();
}
function routineDoneToday(){
  try{
    const o = JSON.parse(localStorage.getItem(LS_ROUTINE_CHECKS) || "null");
    if(o && o.date === todayISO() && Array.isArray(o.done)) return o.done;
  }catch(e){}
  return [];
}
function saveRoutineDone(done){
  try{ localStorage.setItem(LS_ROUTINE_CHECKS, JSON.stringify({ date: todayISO(), done })); }catch(e){}
}

// Gruß nach Wiener Ortszeit
function startGreeting(){
  const h = localHourIn("Europe/Vienna", new Date()).h;
  if(h < 5)  return "Gute Nacht";
  if(h < 11) return "Guten Morgen";
  if(h < 13) return "Guten Tag";
  if(h < 18) return "Guten Nachmittag";
  return "Guten Abend";
}
function formatLiveDate(){
  const d = new Date();
  return d.toLocaleDateString("de-DE", { weekday:"long", day:"2-digit", month:"long", year:"numeric" });
}
function formatLiveTime(){
  return new Date().toLocaleTimeString("de-DE", { hour:"2-digit", minute:"2-digit", second:"2-digit" }) + " Uhr";
}

// Kurzform "+1,5 R" für große Kennzahlen (formatR bleibt für Listen/Tabellen)
function formatRShort(v){
  const n = Math.round(Number(v) * 100) / 100;
  const s = Math.abs(n).toLocaleString("de-DE", { minimumFractionDigits:1, maximumFractionDigits:2 });
  return (n>0?"+":n<0?"−":"±") + s + " R";
}
function isClosedTrade(t){ return t.r!==null && t.r!==undefined && t.r!==""; }
function liveClosedSorted(){
  return STATE.trades.filter(t=> t.area==="live" && isClosedTrade(t))
    .sort((a,b)=> (a.date||"").localeCompare(b.date||"") || (a.createdAt||0)-(b.createdAt||0));
}

/* ---- Session-Karte (wird jede Sekunde neu gezeichnet) ---- */
function renderStartSessionCard(){
  const tl = sessionTimeline();
  const open = tl.blocks.filter(b=>b.open_);
  let state, cap;
  if(tl.weekend){
    state = "Wochenende"; cap = "London öffnet Montag";
  }else if(open.length === 2){
    const ldn = open.find(b=>b.key==="london") || open[0];
    state = `London <span class="sess-amp">&amp;</span> New York offen`;
    cap = `Überschneidung · noch ${formatDurationHM(ldn.close - ldn.zoneH)} bis London schließt`;
  }else if(open.length === 1){
    state = `${open[0].label} offen`;
    cap = `noch ${formatDurationHM(open[0].close - open[0].zoneH)}`;
  }else{
    state = "Keine Session";
    cap = tl.next ? `${tl.next.label} öffnet in ${formatDurationHM(tl.next.inHours)}` : "";
  }

  // Nächster High-Impact-Termin von heute
  const now = Date.now();
  const nextEv = newsForDate(newsTodayISO()).filter(e=> e.ts != null && e.ts >= now - 60000).sort((a,b)=> a.ts - b.ts)[0];
  let nextHtml;
  if(nextEv){
    const sameTime = newsForDate(newsTodayISO()).filter(e=> e.ts === nextEv.ts).length;
    const mins = Math.round((nextEv.ts - now) / 60000);
    const inTxt = mins <= 0 ? "jetzt" : mins < 60 ? `in ${mins} Min` : `in ${Math.floor(mins/60)} h ${String(mins%60).padStart(2,"0")} Min`;
    nextHtml = `<span class="start-next-flag">${newsFlag(nextEv.c)}</span>
      <div class="start-next-txt"><b>${escHtml(nextEv.n)}</b>${sameTime>1?` +${sameTime-1}`:""} um ${viennaTimeHM(nextEv.ts)}</div>
      <span class="news-next">${inTxt}</span>`;
  }else{
    nextHtml = `<span class="start-next-flag">📰</span><div class="start-next-txt">Heute keine weiteren High-Impact-Termine</div>`;
  }

  return `<div class="start-sess" id="startSessCard">
      <div>
        <div class="start-eyebrow">Sessions</div>
        <div class="start-sess-state">${state}</div>
        <div class="start-sess-cap">${cap}</div>
        ${renderSessionTimeline()}
      </div>
      <div class="start-next">${nextHtml}</div>
    </div>`;
}

/* ---- Mini-Grafiken ---- */
function startSparkline(vals, h){
  const w = 240;
  if(vals.length < 2) return "";
  const min = Math.min(0, ...vals), max = Math.max(0, ...vals);
  const x = i => i/(vals.length-1)*w, y = v => h-4 - (v-min)/((max-min)||1)*(h-8);
  const pts = vals.map((v,i)=> `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = vals[vals.length-1];
  const col = last >= 0 ? "var(--green)" : "var(--red)";
  return `<svg class="start-spark" width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="startSparkGrad" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".22"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
    <polygon points="0,${h} ${pts} ${w},${h}" fill="url(#startSparkGrad)"/>
    <polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
  </svg>`;
}

function startRing(pct, r, sw, col){
  const c = 2*Math.PI*r;
  return `<circle r="${r}" cx="0" cy="0" fill="none" stroke="var(--fill)" stroke-width="${sw}"/>
    <circle r="${r}" cx="0" cy="0" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${(c*pct).toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90)"/>`;
}

function startWeekBars(){
  const monday = startOfWeek(new Date());
  const days = [];
  for(let i=0;i<7;i++){
    const d = new Date(monday); d.setDate(monday.getDate()+i);
    const iso = d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
    const ts = STATE.trades.filter(t=> t.area==="live" && t.date===iso);
    if(i >= 5 && !ts.length) continue; // Sa/So nur, wenn dort gehandelt wurde
    days.push({ iso, ts });
  }
  const sums = days.map(d=> d.ts.filter(isClosedTrade).reduce((a,t)=>a+t.r,0));
  const mx = Math.max(1, ...sums.map(Math.abs));
  const today = todayISO();
  return `<div class="start-bars">` + days.map((d,i)=>{
    const closed = d.ts.filter(isClosedTrade);
    const s = sums[i];
    const h = closed.length ? Math.max(8, Math.abs(s)/mx*100) : 6;
    const cls = closed.length ? (s>0?"p":s<0?"n":"z") : "";
    const tip = `${isoWeekdayShort(d.iso)} ${formatDateDE(d.iso)} · ${closed.length ? formatRShort(s) : "kein Ergebnis"}${d.ts.length>closed.length?` · ${d.ts.length-closed.length} offen`:""}`;
    return `<div class="start-bcol${d.iso===today?" today":""}" title="${escAttr(tip)}"><div class="start-b ${cls}" style="height:${h}%"></div><div class="start-blbl">${isoWeekdayShort(d.iso)}</div></div>`;
  }).join("") + `</div>`;
}

const START_COMPACT_MQ = window.matchMedia ? window.matchMedia("(max-width:640px)") : null;
function startIsCompact(){ return !!(START_COMPACT_MQ && START_COMPACT_MQ.matches); }
// Beim Wechsel über die Mobil-Grenze die Kurve in passenden Maßen neu zeichnen
if(START_COMPACT_MQ){
  const onMq = ()=>{ const el = document.getElementById("startEquityBody"); if(el) el.innerHTML = startEquityChart(); };
  if(START_COMPACT_MQ.addEventListener) START_COMPACT_MQ.addEventListener("change", onMq); else if(START_COMPACT_MQ.addListener) START_COMPACT_MQ.addListener(onMq);
}

function startEquityChart(){
  const range = startEquityRange();
  let trades = liveClosedSorted();
  if(range !== "alles"){
    const from = isoAddDays(todayISO(), -(Number(range)-1));
    trades = trades.filter(t=> (t.date||"") >= from);
  }
  if(trades.length < 2){
    return `<div class="start-empty">Noch zu wenige abgeschlossene Live-Trades${range!=="alles"?" in diesem Zeitraum":""} für eine Kurve.</div>`;
  }
  const compact = startIsCompact();
  const W = compact ? 380 : 700, H = compact ? 200 : 210, padL = compact ? 30 : 36, padB = 22, pw = W - padL - 8, ph = H - padB - 8;
  let s = 0;
  const pts = [{ v:0 }].concat(trades.map(t=>{ s += t.r; return { v:s, t }; }));
  const vals = pts.map(p=>p.v);
  let min = Math.min(...vals), max = Math.max(...vals);
  const span = Math.max(1, max - min); min -= span*.08; max += span*.08;
  const x = i => padL + i/(pts.length-1)*pw;
  const y = v => 8 + (max - v)/(max - min)*ph;
  // Rasterlinien mit "runden" Schritten
  const rawStep = (max - min) / 5;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step = [1,2,2.5,5,10].map(m=>m*mag).find(st=> st >= rawStep) || rawStep;
  let grid = "";
  for(let v = Math.ceil(min/step)*step; v <= max; v += step){
    const vv = Math.round(v*100)/100;
    grid += `<line x1="${padL}" x2="${W-8}" y1="${y(vv).toFixed(1)}" y2="${y(vv).toFixed(1)}" stroke="var(--separator)" stroke-width="1"${vv===0?"":` stroke-dasharray="2 4"`}/>
      <text x="${padL-8}" y="${(y(vv)+3.5).toFixed(1)}" font-size="10.5" text-anchor="end" fill="var(--text-faint)">${vv>0?"+":""}${String(vv).replace(".",",")}</text>`;
  }
  // Monatsbeschriftung am jeweils ersten Trade des Monats
  let months = "", lastM = "";
  pts.forEach((p,i)=>{
    if(!p.t) return;
    const m = p.t.date.slice(0,7);
    if(m !== lastM){
      lastM = m;
      const lbl = new Date(p.t.date+"T00:00:00").toLocaleDateString("de-DE", { month:"short" });
      months += `<text x="${x(i).toFixed(1)}" y="${H-5}" font-size="10.5" fill="var(--text-faint)">${escHtml(lbl)}</text>`;
    }
  });
  const line = pts.map((p,i)=> `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const showDots = pts.length <= 80;
  const dots = pts.map((p,i)=>{
    if(!p.t) return "";
    const col = p.t.r>0 ? "var(--green)" : p.t.r<0 ? "var(--red)" : "var(--text-faint)";
    const tip = `${formatDateDE(p.t.date)} · ${p.t.markt||"Trade"}${p.t.art?" "+p.t.art:""} · ${formatR(p.t.r)} → Summe ${formatR(p.v)}`;
    return `<g class="start-eq-pt" data-starttrade="${escAttr(p.t.id)}"><title>${escHtml(tip)}</title>
      <circle cx="${x(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="10" fill="transparent"/>
      ${showDots ? `<circle cx="${x(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="3.2" fill="var(--bg-panel)" stroke="${col}" stroke-width="2"/>` : ""}</g>`;
  }).join("");
  const y0 = y(0).toFixed(1);
  return `<svg class="start-eq" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Equity-Kurve der Live-Trades, aktuell ${escAttr(formatR(s))}">
    <defs><linearGradient id="startEqGrad" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--accent-fill)" stop-opacity=".2"/><stop offset="1" stop-color="var(--accent-fill)" stop-opacity="0"/></linearGradient></defs>
    ${grid}
    <polygon points="${x(0).toFixed(1)},${y0} ${line} ${x(pts.length-1).toFixed(1)},${y0}" fill="url(#startEqGrad)"/>
    <polyline points="${line}" fill="none" stroke="var(--accent-fill)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}${months}
  </svg>`;
}

/* ---- Kacheln ---- */
function renderStartKpis(){
  const w = startPeriodStats("woche"), m = startPeriodStats("monat"), streak = startStreak();
  const rCls = v => v>0?"pos":(v<0?"neg":"");
  const monthName = new Date().toLocaleDateString("de-DE", { month:"long" });

  // Monat: kumulierter Verlauf
  const mTrades = liveClosedSorted().filter(t=> dateMatchesFilter(t.date, "monat"));
  let acc = 0; const mVals = [0].concat(mTrades.map(t=> acc += t.r));
  const mBe = mTrades.filter(t=>t.r===0).length;

  // Rekord-Serie (Gewinner in Folge) über alle Live-Trades
  let best = 0, cur = 0;
  liveClosedSorted().forEach(t=>{ if(t.r>0){ cur++; best = Math.max(best, cur); } else if(t.r<0) cur = 0; });
  const last8 = liveClosedSorted().slice(-8).map(t=>
    `<i class="${t.r>0?"rw":t.r<0?"rl":"re"}" title="${escAttr(formatDateDE(t.date)+" · "+(t.markt||"Trade")+" · "+formatR(t.r))}"></i>`).join("");

  const hit = m.winrate;
  return `
    <div class="panel start-kpi s3">
      <div class="start-eyebrow">Diese Woche<span class="start-long"> · Live</span></div>
      <div class="value ${rCls(w.sum)}">${w.closed ? formatRShort(w.sum) : "—"}</div>
      <div class="sub">${w.count} Trade${w.count===1?"":"s"}${w.open?` · ${w.open} offen`:""}</div>
      <div class="start-kpi-viz">${startWeekBars()}</div>
    </div>
    <div class="panel start-kpi s3">
      <div class="start-eyebrow">${escHtml(monthName)}<span class="start-long"> · Live</span></div>
      <div class="value ${rCls(m.sum)}">${m.closed ? formatRShort(m.sum) : "—"}</div>
      <div class="sub">${m.count} Trade${m.count===1?"":"s"}${m.closed?` · Ø ${formatRShort(m.sum/m.closed)}`:""}${m.open?` · ${m.open} offen`:""}</div>
      <div class="start-kpi-viz">${startSparkline(mVals, 44) || `<div class="start-empty-sm">Kurve ab 1 Ergebnis</div>`}</div>
    </div>
    <div class="panel start-kpi s3">
      <div class="start-eyebrow">Trefferquote<span class="start-long"> · ${escHtml(monthName)}</span></div>
      <div class="start-hit">
        <svg width="78" height="78" viewBox="-39 -39 78 78" aria-hidden="true">${startRing(hit!==null ? hit/100 : 0, 32, 9, "var(--green)")}
          <text y="5.5" text-anchor="middle" font-size="16" font-weight="700" fill="var(--text)">${hit!==null ? hit+"%" : "—"}</text></svg>
        <div class="start-hit-leg">
          <div><b class="pos">${m.wins}</b> Gewinner</div>
          <div><b class="neg">${m.losses}</b> Verlierer</div>
          <div><b>${mBe}</b> <span class="start-long">Break-even</span><span class="start-short">BE</span></div>
        </div>
      </div>
    </div>
    <div class="panel start-kpi s3">
      <div class="start-eyebrow">Aktuelle Serie</div>
      <div class="value ${streak ? (streak.win?"pos":"neg") : ""}">${streak ? streak.n : "—"}${streak ? ` <span class="start-kpi-unit">${streak.win?"Gewinner":"Verlierer"}</span>` : ""}</div>
      <div class="sub">${streak ? "in Folge" : "noch kein Ergebnis"}${best ? ` · Rekord: ${best}` : ""}</div>
      <div class="start-kpi-viz">${last8 ? `<div class="start-faint">Letzte ${Math.min(8, liveClosedSorted().length)} Ergebnisse</div><div class="start-results">${last8}</div>` : ""}</div>
    </div>`;
}

function renderStartEquityCard(){
  const range = startEquityRange();
  const seg = [["30","30 T"],["90","90 T"],["alles","Alles"]].map(([v,l])=>
    `<button type="button" class="subtab ${range===v?"active":""}" data-eqrange="${v}">${l}</button>`).join("");
  return `
    <div class="panel s8 start-o-eq">
      <div class="start-card-head">
        <div><div class="start-eyebrow">Equity-Kurve · Live</div><div class="start-faint" style="margin-top:2px;">Kumuliert in R, jeder Punkt ein Trade — Klick öffnet ihn</div></div>
        <div class="subtab-row" role="group" aria-label="Zeitraum der Equity-Kurve">${seg}</div>
      </div>
      <div id="startEquityBody">${startEquityChart()}</div>
    </div>`;
}

function renderStartRoutineCard(){
  const items = routineItems();
  if(startRoutineEditing){
    return `
      <div class="panel s4 start-o-routine" id="startRoutineCard">
        <div class="start-card-head"><div class="start-eyebrow">Pre-Trade-Routine bearbeiten</div></div>
        <p class="start-faint" style="margin:0 0 8px;">Ein Punkt pro Zeile. Wird mit den Einstellungen synchronisiert.</p>
        <textarea id="startRoutineInput" class="start-routine-input" rows="7">${escHtml(items.join("\n"))}</textarea>
        <div style="display:flex; gap:8px; margin-top:10px;">
          <button type="button" class="btn btn-sm btn-primary" id="startRoutineSave">Speichern</button>
          <button type="button" class="btn btn-sm btn-ghost" id="startRoutineCancel">Abbrechen</button>
        </div>
      </div>`;
  }
  const done = routineDoneToday();
  const doneCount = items.filter(i=> done.includes(i)).length;
  const rows = items.length
    ? items.map(i=> `<button type="button" class="start-check${done.includes(i)?" done":""}" data-routine="${escAttr(i)}" aria-pressed="${done.includes(i)}"><span class="box" aria-hidden="true"></span><span class="lbl">${escHtml(i)}</span></button>`).join("")
    : `<div class="start-empty-sm">Noch keine Punkte angelegt.</div>`;
  return `
    <div class="panel s4 start-o-routine" id="startRoutineCard">
      <div class="start-card-head">
        <div class="start-eyebrow">Pre-Trade-Routine</div>
        <span class="start-faint${items.length && doneCount===items.length ? " pos" : ""}">${items.length ? (doneCount===items.length ? "✓ erledigt" : `${doneCount} / ${items.length}`) : ""}</span>
      </div>
      <div class="start-checks">${rows}</div>
      <button type="button" class="linklike start-link" id="startRoutineEdit">Routine bearbeiten</button>
    </div>`;
}

function renderStartRecentTrades(){
  const trades = STATE.trades.slice()
    .sort((a,b)=> (b.date||"").localeCompare(a.date||"") || (b.createdAt||0)-(a.createdAt||0))
    .slice(0, 5);
  const today = todayISO(), yesterday = isoAddDays(today, -1);
  const rows = trades.map(t=>{
    const open = !isClosedTrade(t);
    const rc = open ? "open" : t.r>0 ? "pos" : t.r<0 ? "neg" : "be";
    const when = t.date===today ? "Heute" : t.date===yesterday ? "Gestern" : formatDateDE(t.date);
    const mk = (t.markt||"—").slice(0,3).toUpperCase();
    return `<div class="start-trade-row" data-starttrade="${escAttr(t.id)}" tabindex="0" role="button" aria-label="${escAttr((t.markt||"Trade")+" vom "+formatDateDE(t.date)+" öffnen")}">
      <div class="start-mk">${escHtml(mk)}</div>
      <div class="start-trade-main">
        <div class="start-trade-title">${escHtml(t.markt||"Trade")}${t.richtung?` · ${escHtml(t.richtung)}`:""}${t.art?` <span class="start-faint">${escHtml(t.art)}</span>`:""}</div>
        <div class="start-faint">${when} · <span class="start-area start-area-${t.area}">${AREA_LABEL[t.area]||t.area}</span>${t.area==="eod" && t.genommen===false ? " · nicht genommen" : ""}</div>
      </div>
      <span class="start-r ${rc}">${open ? "offen" : formatR(t.r)}</span>
    </div>`;
  }).join("");
  return `
    <div class="panel s4 start-o-recent">
      <div class="start-card-head">
        <div class="start-eyebrow">Letzte Einträge</div>
        <button type="button" class="linklike start-link" id="startAllTradesBtn">Alle Live-Trades →</button>
      </div>
      ${rows ? `<div class="start-trade-list">${rows}</div>` : `<div class="start-empty">Noch keine Trades erfasst.</div>`}
    </div>`;
}

function renderStartStatusbar(){
  const st = storageStats();
  const stColor = st.percent >= 85 ? "var(--red)" : st.percent >= 60 ? "var(--amber)" : "var(--green)";
  let sync;
  if(STATE.driveStatus === "syncing"){
    sync = `<span class="start-spill"><span class="start-dot" style="background:var(--text-faint)"></span>Synchronisiere …</span>`;
  }else if(STATE.driveStatus === "conflict" || STATE.driveStatus === "error"){
    sync = ""; // wird als eigene Karte oberhalb angezeigt
  }else{
    sync = `<button type="button" class="start-spill" id="gdriveSyncNowBtn" title="Jetzt synchronisieren"><span class="start-dot" style="background:var(--green)"></span><b>Drive synchronisiert</b> · ${formatBackupTimestamp(STATE.driveLastSyncAt)}</button>`;
  }
  const lastRange = STATE.news.ranges[STATE.news.ranges.length-1];
  const newsEnd = lastRange ? lastRange[1] : null;
  return `<div class="start-status">
      ${sync}
      <span class="start-spill" title="${st.percent} % des Browser-Speichers belegt">Speicher <span class="start-meter"><i style="width:${Math.max(2, st.percent)}%; background:${stColor};"></i></span> <b style="color:${stColor}">${formatBytes(st.usedBytes)}</b> von ca. ${formatBytes(LS_LIMIT_BYTES)}</span>
      ${newsEnd ? `<span class="start-spill">News-Daten bis <b>${formatDateDE(newsEnd).slice(0,6)}</b></span>` : ""}
      <span class="start-spill start-spill-end">Version ${APP_VERSION}</span>
    </div>`;
}

// Sync-Konflikt / -Fehler brauchen Entscheidungen — dafür bleibt die ausführliche Karte.
function renderStartSyncAlert(){
  if(STATE.driveStatus === "conflict"){
    return `<div class="panel start-alert s12">
      <div class="start-eyebrow" style="margin-bottom:8px;">☁ Google Drive Sync</div>
      <p style="color:var(--amber); font-size:13.5px; margin:0 0 6px;">⚠ Konflikt: In der Cloud liegt ein neuerer Stand von einem anderen Gerät (${formatBackupTimestamp(STATE.driveConflictRemote && STATE.driveConflictRemote.savedAt)}), hier gibt es aber ebenfalls ungesicherte Änderungen.</p>
      <p style="color:var(--text-dim); font-size:12.5px; margin:0 0 12px;">Cloud: ${STATE.driveConflictRemote && Array.isArray(STATE.driveConflictRemote.trades) ? STATE.driveConflictRemote.trades.length : "?"} Trades · Hier: ${STATE.trades.length} Trades. Nichts wurde überschrieben — bitte entscheiden:</p>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn btn-primary" id="gdriveUseRemoteBtn">Cloud-Stand übernehmen</button>
        <button class="btn btn-danger" id="gdriveUseLocalBtn">Lokalen Stand hochladen (Cloud überschreiben)</button>
      </div>
    </div>`;
  }
  if(STATE.driveStatus === "error"){
    return `<div class="panel start-alert s12">
      <div class="start-alert-row">
        <div>
          <p style="color:var(--red); font-size:13.5px; margin:0 0 4px;">⚠ Synchronisierung fehlgeschlagen${/fetch|network|load/i.test(STATE.driveError||"") ? " — keine Verbindung zum Sync-Dienst" : ""}.</p>
          <p style="color:var(--text-dim); font-size:12.5px; margin:0;">Deine Änderungen sind auf diesem Gerät gespeichert und gehen nicht verloren.${STATE.driveError ? ` <span style="color:var(--text-faint);">(Details: ${escHtml(STATE.driveError)})</span>` : ""}</p>
        </div>
        <button class="btn" id="gdriveRetryBtn">Erneut versuchen</button>
      </div>
    </div>`;
  }
  return "";
}

function renderStart(){
  const count = journaledTodayCount();
  const confirmed = isTodayConfirmed();
  const statusLine = count
    ? `<div class="start-journal ok">✓ Heute ${count} ${count===1?"Eintrag":"Einträge"} erfasst</div>`
    : confirmed
      ? `<div class="start-journal ok">✓ Heute journaliert — kein Trade, bewusst bestätigt <button type="button" class="linklike" id="dayConfirmToggleBtn">Rückgängig</button></div>`
      : `<div class="start-journal"><span>Heute noch nichts erfasst</span><button type="button" class="btn btn-sm" id="dayConfirmToggleBtn">Kein Trade heute — trotzdem bestätigen</button></div>`;

  return `
    <div class="start-hero start-hero-cockpit">
      <div class="start-hero-main">
        <div class="page-head">
          <div class="start-eyebrow">${escHtml(formatLiveDate())}</div>
          <h1>${startGreeting()}, Clemens.</h1>
          <p class="start-clock"><span class="start-live-dot" aria-hidden="true"></span><span id="liveClock">${formatLiveTime()}</span> · Wien</p>
        </div>
        ${statusLine}
        <div class="start-quick">
          <button type="button" class="btn btn-primary" id="quickAddLiveBtn">+ Live<span class="start-long">-Trade</span></button>
          <button type="button" class="btn btn-eod" id="quickAddEodBtn">+ EOD<span class="start-long">-Eintrag</span></button>
          <button type="button" class="btn" id="quickAddInsightBtn">+ Erkenntnis</button>
        </div>
      </div>
      ${renderStartSessionCard()}
    </div>

    <div class="start-bento">
      ${renderStartSyncAlert()}
      ${renderStartKpis()}
      ${renderStartEquityCard()}
      ${renderStartRoutineCard()}
      <div class="s8 start-news-slot start-o-news">${renderNewsPanel()}</div>
      ${renderStartRecentTrades()}
    </div>

    ${renderStartStatusbar()}
  `;
}

/* ---------- News-Kachel (Startseite) ---------- */
// loadNewsView/saveNewsView → news.js (werden schon beim Anlegen von STATE gebraucht)

// Flagge aus Währung (USD …) oder Länderkürzel (US, DE, EU …). Zweistellige Kürzel werden
// direkt in Flaggen-Emoji umgewandelt (Windows zeigt dafür nur die Buchstaben — passt trotzdem).
function newsFlag(c){
  if(NEWS_COUNTRY_FLAG[c]) return NEWS_COUNTRY_FLAG[c];
  const code = c === "UK" ? "GB" : c;
  if(/^[A-Z]{2}$/.test(code)) return String.fromCodePoint(...[...code].map(ch=> 0x1F1E6 + ch.charCodeAt(0) - 65));
  return "🌐";
}

// Eine Terminzeile. opts.compact = ohne Prognose/Vorher; opts.nextTs = Zeitstempel des nächsten Termins
function newsRowHtml(e, opts){
  opts = opts || {};
  const now = Date.now();
  const past = e.ts != null ? e.ts < now : e.d < newsTodayISO();
  const isNext = opts.nextTs != null && e.ts === opts.nextTs;
  const time = e.ts != null ? viennaTimeHM(e.ts) : "ganzt.";
  const meta = opts.compact ? "" : [e.f ? `Prognose ${escHtml(e.f)}` : "", e.p ? `Zuvor ${escHtml(e.p)}` : ""].filter(Boolean).join(" · ");
  let soon = "";
  if(isNext){
    const mins = Math.round((e.ts - now) / 60000);
    soon = `<span class="news-next">${mins <= 0 ? "jetzt" : mins < 60 ? `in ${mins} Min` : mins < 180 ? `in ${Math.floor(mins/60)} h ${String(mins%60).padStart(2,"0")} Min` : "als Nächstes"}</span>`;
  }
  return `
    <div class="news-row${past ? " news-row-past" : ""}${isNext ? " news-row-next" : ""}${opts.compact ? " news-row-compact" : ""}">
      <div class="news-time">${time}</div>
      <div class="news-flag">${newsFlag(e.c)}</div>
      <div class="news-body">
        <div class="news-title">${escHtml(e.n)}<span class="news-country">${escHtml(e.c)}</span>${soon}</div>
        ${meta ? `<div class="news-meta">${meta}</div>` : ""}
      </div>
    </div>`;
}

function newsNextTs(){
  const now = Date.now();
  const up = STATE.news.events.filter(e=> e.ts != null && e.ts >= now - 60000).sort((a,b)=> a.ts - b.ts)[0];
  return up ? up.ts : null;
}

// Tage, die die Wochen-Vorschau zeigt: Mo–Fr der aktuellen Woche (am Wochenende: nächste Woche),
// Samstag/Sonntag nur, wenn dort tatsächlich Termine liegen.
function newsWeekDays(){
  const today = newsTodayISO();
  const wd = isoWeekday(today);
  const monday = wd >= 5 ? isoAddDays(today, 7 - wd) : isoAddDays(today, -wd);
  const days = [];
  for(let i=0;i<7;i++){
    const iso = isoAddDays(monday, i);
    if(i >= 5 && !newsForDate(iso).length) continue;
    days.push(iso);
  }
  return days;
}

function newsPanelBodyHtml(){
  const store = STATE.news;
  const today = newsTodayISO();
  if(!store.events.length && !store.ranges.length){
    return `
      <p style="color:var(--text-dim); font-size:13.5px; margin:0 0 12px;">Noch keine Termine importiert. Screenshot vom Investing.com-Kalender machen, mit dem Prompt an Claude geben und die Antwort hier importieren.</p>
      <button type="button" class="btn btn-sm btn-primary" data-newsaction="import">News importieren</button>`;
  }
  const nextTs = newsNextTs();
  let body = "";
  if(STATE.newsView === "woche"){
    const days = newsWeekDays();
    body = `<div class="news-week">` + days.map(iso=>{
      const evs = newsForDate(iso);
      const isToday = iso === today;
      const past = iso < today;
      const content = evs.length
        ? evs.map(e=> newsRowHtml(e, { compact:true, nextTs })).join("")
        : `<div class="news-empty-day">${newsCovers(iso) ? "Keine 3-Sterne-Termine" : "Keine Daten importiert"}</div>`;
      return `
        <div class="news-day${isToday ? " news-day-today" : ""}${past ? " news-day-past" : ""}">
          <div class="news-day-head">${formatNewsDay(iso)}${isToday ? ` <span class="news-today-tag">Heute</span>` : ""}${evs.length ? `<span class="news-day-count">${evs.length}</span>` : ""}</div>
          <div class="news-list">${content}</div>
        </div>`;
    }).join("") + `</div>`;
  }else{
    const evs = newsForDate(today);
    const wd = isoWeekday(today);
    body = evs.length
      ? `<div class="news-list">${evs.map(e=> newsRowHtml(e, { nextTs })).join("")}</div>`
      : `<p style="color:var(--text-dim); font-size:13.5px; margin:0;">${
          wd >= 5 ? "Wochenende — keine High-Impact-Termine."
          : !newsCovers(today) ? "Für heute sind keine News-Daten importiert."
          : "Heute keine High-Impact-Termine."}</p>`;
  }
  // Hinweis, wenn die importierten Daten bald auslaufen
  // Am Wochenende zählt der kommende Montag — Sa/So sind im Kalender meist gar nicht abgedeckt.
  const wdRef = isoWeekday(today);
  const refDay = wdRef >= 5 ? isoAddDays(today, 7 - wdRef) : today;
  const end = newsCoverageEndFrom(refDay) || (wdRef >= 5 ? newsCoverageEndFrom(today) : null);
  const lastRange = store.ranges[store.ranges.length-1];
  const maxEnd = lastRange ? lastRange[1] : null;
  let hint = "";
  if(!end){
    hint = `<div class="news-hint">⚠ ${refDay === today ? "Für heute" : "Für die kommende Woche"} fehlen News-Daten — <button type="button" class="linklike" data-newsaction="import">jetzt importieren</button></div>`;
  }else if(end < isoAddDays(today, 2)){ // ab Donnerstag erinnern, wenn die Folgewoche fehlt
    hint = `<div class="news-hint">⏳ Daten nur bis ${formatNewsDay(end)} — <button type="button" class="linklike" data-newsaction="import">neue Termine importieren</button></div>`;
  }
  // GEÄNDERT: Termine in eigenem Scroll-Bereich — sichtbar sind die nächsten 10,
  // der Rest (auch Vergangenes darüber) ist im Feld selbst scrollbar (siehe fitNewsScroll).
  return `<div class="news-scroll" id="newsScroll">${body}</div>` + hint + `<div class="news-foot">Quelle: Investing.com (Import)${maxEnd ? ` · Daten bis ${formatDateDE(maxEnd)}` : ""} · Zeiten in Wiener Ortszeit</div>`;
}

function renderNewsPanel(){
  const v = STATE.newsView;
  return `
    <div class="panel panel-news" id="newsPanel" style="margin-top:14px;">
      <div class="row-between news-head">
        <div class="section-title" style="margin:0;">📰 High-Impact-News</div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <div class="subtab-row" role="group" aria-label="News-Ansicht">
            <button type="button" class="subtab ${v==="heute"?"active":""}" data-newsview="heute">Heute</button>
            <button type="button" class="subtab ${v==="woche"?"active":""}" data-newsview="woche">Woche</button>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" data-newsaction="import" title="Termine importieren / verwalten">Import</button>
        </div>
      </div>
      <div id="newsPanelBody">${newsPanelBodyHtml()}</div>
    </div>`;
}

function wireNewsPanel(){
  const panel = document.getElementById("newsPanel");
  if(!panel) return;
  panel.addEventListener("click", (e)=>{
    const vBtn = e.target.closest("[data-newsview]");
    if(vBtn){
      STATE.newsView = vBtn.dataset.newsview;
      saveNewsView(STATE.newsView);
      panel.querySelectorAll("[data-newsview]").forEach(b=> b.classList.toggle("active", b === vBtn));
      document.getElementById("newsPanelBody").innerHTML = newsPanelBodyHtml();
      fitNewsScroll();
      return;
    }
    if(e.target.closest("[data-newsaction='import']")) openNewsModal();
  });
  fitNewsScroll();
}

// Wird von der Startseiten-Uhr aufgerufen: vergangene Termine ausgrauen, Countdown aktualisieren.
let newsLastRefreshMinute = -1;
function refreshNewsPanelTick(){
  const m = Math.floor(Date.now() / 60000);
  if(m === newsLastRefreshMinute) return;
  newsLastRefreshMinute = m;
  const el = document.getElementById("newsPanelBody");
  if(!el) return;
  // Hat der Nutzer im Feld gescrollt, bleibt seine Position erhalten, solange sich
  // der "nächste" Termin nicht geändert hat.
  const old = document.getElementById("newsScroll");
  const keep = old && old.dataset.userScrolled === "1" ? { top: old.scrollTop, next: old.dataset.nextKey } : null;
  el.innerHTML = newsPanelBodyHtml();
  fitNewsScroll(keep);
}

// Höhe des News-Scrollbereichs so setzen, dass genau die nächsten NEWS_VISIBLE_ROWS
// Termine sichtbar sind, und dorthin scrollen (vergangene liegen darüber).
const NEWS_VISIBLE_ROWS = 10;
function fitNewsScroll(keep){
  const box = document.getElementById("newsScroll");
  if(!box) return;
  box.style.maxHeight = "";
  box.classList.remove("is-scrollable");
  const rows = Array.from(box.querySelectorAll(".news-row"));
  if(rows.length <= NEWS_VISIBLE_ROWS) return; // passt komplett, kein Scrollen nötig
  let start = rows.findIndex(r=> !r.classList.contains("news-row-past"));
  // Immer 10 Termine zeigen: gibt es weniger kommende, rücken vergangene von oben nach
  if(start < 0 || start > rows.length - NEWS_VISIBLE_ROWS) start = rows.length - NEWS_VISIBLE_ROWS;
  const end = Math.min(rows.length - 1, start + NEWS_VISIBLE_ROWS - 1);
  // Wochenansicht: Tageskopf (sticky) über dem ersten sichtbaren Termin mit einrechnen
  const dayHead = rows[start].closest(".news-day") ? rows[start].closest(".news-day").querySelector(".news-day-head") : null;
  const headH = dayHead ? dayHead.offsetHeight : 0;
  const top = Math.max(0, rows[start].offsetTop - headH);
  const bottom = rows[end].offsetTop + rows[end].offsetHeight;
  const needed = bottom - top;
  if(box.scrollHeight <= needed + 2){ return; } // passt ohnehin komplett
  box.style.maxHeight = needed + "px";
  box.classList.add("is-scrollable");
  const nextKey = rows[start].textContent.trim().slice(0, 60);
  box.dataset.nextKey = nextKey;
  box.scrollTop = keep && keep.next === nextKey ? keep.top : top;
  if(keep && keep.next === nextKey) box.dataset.userScrolled = "1";
  // Listener erst nach dem programmatischen Scrollen anhängen (sonst zählt das als Nutzer-Scroll)
  requestAnimationFrame(()=> requestAnimationFrame(()=>{
    box.addEventListener("scroll", ()=>{ box.dataset.userScrolled = "1"; }, { passive:true });
  }));
}
let newsFitResizeTimer = null;
window.addEventListener("resize", ()=>{
  clearTimeout(newsFitResizeTimer);
  newsFitResizeTimer = setTimeout(()=> fitNewsScroll(), 150);
});

/* ---------- News bei Trades (optional, Einstellung im News-Dialog) ---------- */
function tradeDayNewsHtml(dateIso, opts){
  opts = opts || {};
  if(!STATE.config.newsBeiTrades) return "";
  const evs = newsForDate(dateIso);
  if(!evs.length) return "";
  const rows = evs.map(e=> newsRowHtml(e, { compact: !!opts.compact })).join("");
  return `<div class="news-list news-list-trade">${rows}</div>`;
}

/* ---------- News-Dialog: Import & Verwaltung ---------- */
let newsImportText = "";
let newsImportTz = null; // manuelle Zeitzonen-Wahl in der Vorschau (null = aus Datei)

function openNewsModal(){
  newsImportText = "";
  newsImportTz = null;
  renderNewsModal();
}
function closeNewsModal(){
  document.getElementById("modalRoot").innerHTML = "";
  render();
}

function newsPreviewHtml(){
  if(!newsImportText.trim()) return "";
  const res = parseNewsImport(newsImportText, newsImportTz);
  if(!res.ok) return `<div class="news-preview news-preview-error">⚠ ${escHtml(res.error)}</div>`;
  const byDay = {};
  res.events.forEach(e=>{ (byDay[e.d] = byDay[e.d] || []).push(e); });
  const days = [];
  for(let d = res.from; d <= res.to; d = isoAddDays(d, 1)) days.push(d);
  const replaced = newsReplacedCount(res.from, res.to);
  const tzOptions = [res.fileTz, "+02:00", "+01:00", NEWS_TZ].filter((v,i,a)=> a.indexOf(v) === i);
  const warn = [];
  if(res.skipped) warn.push(`${res.skipped} Zeile${res.skipped===1?"":"n"} ohne gültiges Datum/Titel übersprungen`);
  if(res.unsure) warn.push(`${res.unsure} Termin${res.unsure===1?"":"e"} von Claude als unsicher markiert — bitte im Screenshot prüfen`);
  const oldPast = res.to < isoAddDays(newsTodayISO(), -NEWS_KEEP_PAST_DAYS);
  if(oldPast) warn.push(`Der Zeitraum liegt mehr als ${NEWS_KEEP_PAST_DAYS} Tage zurück und wird nicht gespeichert`);
  return `
    <div class="news-preview">
      <div class="news-preview-sum">
        <strong>${res.events.length} Termine</strong> · ${formatDateDE(res.from)} – ${formatDateDE(res.to)}
        ${replaced ? `<span style="color:var(--text-dim);"> · ersetzt ${replaced} vorhandene Termine in diesem Zeitraum</span>` : ""}
      </div>
      <div class="field-group" style="margin:10px 0 12px;">
        <label class="fg-label" for="newsTzSelect">Uhrzeiten im Screenshot sind in</label>
        <select id="newsTzSelect">${tzOptions.map(tz=>`<option value="${escAttr(tz)}" ${tz===res.tz?"selected":""}>${escHtml(newsTzLabel(tz))}${tz===res.fileTz?" — laut Datei":""}</option>`).join("")}</select>
        <div style="font-size:12px; color:var(--text-faint); margin-top:6px;">Unten stehen die Zeiten bereits umgerechnet in Wiener Ortszeit. Kontrolle: US-Daten wie NFP oder CPI kommen normalerweise um 14:30.</div>
      </div>
      ${warn.length ? `<div class="news-preview-warn">${warn.map(w=>`⚠ ${escHtml(w)}`).join("<br>")}</div>` : ""}
      <div class="news-preview-list">
        ${days.map(d=>`
          <div class="news-day">
            <div class="news-day-head">${formatNewsDay(d)}${byDay[d] ? `<span class="news-day-count">${byDay[d].length}</span>` : ""}</div>
            <div class="news-list">${byDay[d] ? byDay[d].map(e=> newsRowHtml(e, {})).join("") : `<div class="news-empty-day">Keine 3-Sterne-Termine</div>`}</div>
          </div>`).join("")}
      </div>
    </div>`;
}

function renderNewsModal(){
  const store = STATE.news;
  const hasData = store.events.length || store.ranges.length;
  const rangesTxt = store.ranges.map(r=> `${formatDateDE(r[0])} – ${formatDateDE(r[1])}`).join(", ");
  document.getElementById("modalRoot").innerHTML = `
  <div class="modal-backdrop" id="newsBackdrop">
    <div class="modal">
      <div class="modal-header-row">
        <div>
          <h2>High-Impact-News importieren</h2>
          <div class="modal-sub">3-Sterne-Termine aus dem Investing.com-Wirtschaftskalender — per Screenshot und Claude.</div>
        </div>
        <button type="button" class="icon-btn" id="newsCloseBtn" title="Schließen" aria-label="Schließen">✕</button>
      </div>

      <ol class="news-steps">
        <li>Im <a href="${NEWS_CALENDAR_URL}" target="_blank" rel="noopener">Investing.com-Kalender</a> Filter „Wichtigkeit: 3 Sterne“ setzen, gewünschten Zeitraum wählen und Screenshots machen.</li>
        <li><button type="button" class="btn btn-sm" id="newsCopyPromptBtn">Prompt kopieren</button> und zusammen mit den Screenshots an Claude schicken.</li>
        <li>Claudes komplette Antwort kopieren und unten einfügen — der JSON-Block wird automatisch erkannt.</li>
      </ol>

      <div class="field-group">
        <label class="fg-label" for="newsImportInput">Antwort von Claude</label>
        <textarea id="newsImportInput" rows="5" placeholder="Hier einfügen (Strg/Cmd + V) …" spellcheck="false">${escHtml(newsImportText)}</textarea>
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
          <button type="button" class="btn btn-sm" id="newsPasteBtn">Aus Zwischenablage einfügen</button>
          <button type="button" class="btn btn-sm btn-ghost" id="newsFileBtn">.json-Datei wählen</button>
          <input type="file" id="newsFileInput" accept="application/json,.json,.txt,.md" style="display:none;">
        </div>
      </div>

      <div id="newsPreview">${newsPreviewHtml()}</div>

      <div class="field-group" style="border-top:1px solid var(--separator); padding-top:16px; margin-top:6px;">
        <label class="dialog-check" style="display:flex; gap:10px; align-items:flex-start; cursor:pointer;">
          <input type="checkbox" id="newsBeiTradesCheck" ${STATE.config.newsBeiTrades ? "checked" : ""} style="margin-top:3px;">
          <span>News auch bei den Trades anzeigen<br><span style="font-size:12px; color:var(--text-faint);">In der Tagesansicht des Kalenders (Live/EOD) und auf der Trade-Detailseite — praktisch fürs Review.</span></span>
        </label>
      </div>

      <div style="font-size:12.5px; color:var(--text-dim);">
        ${hasData ? `Gespeichert: ${store.events.length} Termine · ${escHtml(rangesTxt)} · ${formatBytes(newsStoreBytes())}` : "Noch keine Termine gespeichert."}
        <br><span style="color:var(--text-faint);">Termine älter als ${NEWS_KEEP_PAST_DAYS} Tage werden automatisch entfernt. Die Daten werden mit Google Drive synchronisiert.</span>
      </div>

      <div class="modal-footer">
        ${hasData ? `<button type="button" class="btn btn-sm btn-danger" id="newsClearBtn">Alle News löschen</button>` : `<span></span>`}
        <div style="display:flex; gap:8px;">
          <button type="button" class="btn btn-ghost" id="newsCancelBtn">Schließen</button>
          <button type="button" class="btn btn-primary" id="newsApplyBtn" disabled>Übernehmen</button>
        </div>
      </div>
    </div>
  </div>`;
  wireNewsModal();
}

function updateNewsPreview(){
  const el = document.getElementById("newsPreview");
  if(!el) return;
  el.innerHTML = newsPreviewHtml();
  const res = newsImportText.trim() ? parseNewsImport(newsImportText, newsImportTz) : { ok:false };
  document.getElementById("newsApplyBtn").disabled = !res.ok;
  const sel = document.getElementById("newsTzSelect");
  if(sel) sel.addEventListener("change", ()=>{ newsImportTz = sel.value; updateNewsPreview(); });
}

function wireNewsModal(){
  const backdrop = document.getElementById("newsBackdrop");
  backdrop.addEventListener("click", (e)=>{ if(e.target === backdrop) closeNewsModal(); });
  document.getElementById("newsCloseBtn").addEventListener("click", closeNewsModal);
  document.getElementById("newsCancelBtn").addEventListener("click", closeNewsModal);

  const input = document.getElementById("newsImportInput");
  const setText = (txt)=>{ newsImportText = txt; newsImportTz = null; input.value = txt; updateNewsPreview(); };
  input.addEventListener("input", ()=>{ newsImportText = input.value; newsImportTz = null; updateNewsPreview(); });

  document.getElementById("newsCopyPromptBtn").addEventListener("click", async ()=>{
    let ok = false;
    try{ await navigator.clipboard.writeText(NEWS_PROMPT); ok = true; }
    catch(err){
      // Fallback (ältere Browser / fehlende Berechtigung): unsichtbares Textfeld + execCommand
      const ta = document.createElement("textarea");
      ta.value = NEWS_PROMPT; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try{ ok = document.execCommand("copy"); }catch(e){}
      ta.remove();
    }
    toast(ok ? "Prompt kopiert — jetzt mit den Screenshots an Claude schicken." : "Kopieren nicht möglich — der Prompt steht auch in der Projektdatei „News-Prompt“.");
  });
  document.getElementById("newsPasteBtn").addEventListener("click", async ()=>{
    try{
      const txt = await navigator.clipboard.readText();
      if(!txt || !txt.trim()){ toast("Die Zwischenablage ist leer."); return; }
      setText(txt);
    }catch(err){
      toast("Zugriff auf die Zwischenablage nicht erlaubt — bitte mit Strg/Cmd + V ins Feld einfügen.");
      input.focus();
    }
  });
  const fileInput = document.getElementById("newsFileInput");
  document.getElementById("newsFileBtn").addEventListener("click", ()=> fileInput.click());
  fileInput.addEventListener("change", ()=>{
    const file = fileInput.files[0];
    fileInput.value = "";
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=> setText(String(reader.result || ""));
    reader.readAsText(file);
  });

  document.getElementById("newsBeiTradesCheck").addEventListener("change", (e)=>{
    STATE.config.newsBeiTrades = e.target.checked;
    saveConfig();
  });

  document.getElementById("newsApplyBtn").addEventListener("click", ()=>{
    const res = parseNewsImport(newsImportText, newsImportTz);
    if(!res.ok) return;
    applyNewsImport(res);
    closeNewsModal();
    toast(`${res.events.length} Termine importiert (${formatDateDE(res.from)} – ${formatDateDE(res.to)}).`);
  });

  const clearBtn = document.getElementById("newsClearBtn");
  if(clearBtn) clearBtn.addEventListener("click", async ()=>{
    if(!await uiConfirm("Alle importierten Termine werden entfernt — auch auf den anderen Geräten (Sync).", { title:"Alle News löschen?", okText:"Löschen", danger:true })) return;
    STATE.news = emptyNewsStore();
    saveNews();
    renderNewsModal();
  });

  updateNewsPreview();
}

function wireStartSync(){
  const gdriveSyncNowBtn = document.getElementById("gdriveSyncNowBtn");
  if(gdriveSyncNowBtn) gdriveSyncNowBtn.addEventListener("click", gdrivePull);
  const gdriveRetryBtn = document.getElementById("gdriveRetryBtn");
  if(gdriveRetryBtn) gdriveRetryBtn.addEventListener("click", gdrivePull);
  const useRemoteBtn = document.getElementById("gdriveUseRemoteBtn");
  if(useRemoteBtn) useRemoteBtn.addEventListener("click", async ()=>{
    if(!await uiConfirm("Alle Änderungen, die nur auf diesem Gerät gemacht wurden, gehen verloren.", { title:"Cloud-Stand übernehmen?", okText:"Übernehmen" })) return;
    gdriveResolveConflict(true);
  });
  const useLocalBtn = document.getElementById("gdriveUseLocalBtn");
  if(useLocalBtn) useLocalBtn.addEventListener("click", async ()=>{
    if(!await uiConfirm("Der neuere Stand in der Cloud (vom anderen Gerät) wird mit dem Stand dieses Geräts überschrieben.", { title:"Cloud überschreiben?", okText:"Überschreiben", danger:true })) return;
    gdriveResolveConflict(false);
  });
}

function wireStart(){
  // Schnellzugriff: Formulare direkt von der Startseite aus öffnen (Eintragen ist die
  // tägliche Hauptaufgabe — vorher brauchte es dafür erst den Wechsel in einen Reiter).
  const qLive = document.getElementById("quickAddLiveBtn");
  if(qLive) qLive.addEventListener("click", ()=> openTradeModal("live", null));
  const qEod = document.getElementById("quickAddEodBtn");
  if(qEod) qEod.addEventListener("click", ()=> openTradeModal("eod", null));
  const qIns = document.getElementById("quickAddInsightBtn");
  if(qIns) qIns.addEventListener("click", ()=> openInsightModal(null));

  const dayConfirmBtn = document.getElementById("dayConfirmToggleBtn");
  if(dayConfirmBtn) dayConfirmBtn.addEventListener("click", toggleTodayConfirmed);

  wireStartSync();

  wireNewsPanel();

  // Bento: ein gemeinsamer Klick-Handler (Raster wird bei jedem render() neu erzeugt)
  const bento = document.querySelector(".start-bento");
  if(bento){
    const openStartTrade = (el)=>{
      const t = STATE.trades.find(x=> String(x.id) === el.dataset.starttrade);
      if(t) openTradeDetail(t);
    };
    const rerenderRoutine = (focusSel)=>{
      const card = document.getElementById("startRoutineCard");
      if(card) card.outerHTML = renderStartRoutineCard();
      if(focusSel){ const f = document.querySelector(focusSel); if(f) f.focus(); }
    };
    bento.addEventListener("click", (e)=>{
      const rangeBtn = e.target.closest("[data-eqrange]");
      if(rangeBtn){
        saveStartEquityRange(rangeBtn.dataset.eqrange);
        rangeBtn.parentNode.querySelectorAll("[data-eqrange]").forEach(b=> b.classList.toggle("active", b === rangeBtn));
        document.getElementById("startEquityBody").innerHTML = startEquityChart();
        return;
      }
      const tradeEl = e.target.closest("[data-starttrade]");
      if(tradeEl){ openStartTrade(tradeEl); return; }
      const chk = e.target.closest("[data-routine]");
      if(chk){
        const item = chk.dataset.routine;
        const done = routineDoneToday().filter(x=> routineItems().includes(x));
        const idx = done.indexOf(item);
        if(idx > -1) done.splice(idx, 1); else done.push(item);
        saveRoutineDone(done);
        rerenderRoutine(`[data-routine="${CSS.escape(item)}"]`);
        return;
      }
      if(e.target.closest("#startRoutineEdit")){ startRoutineEditing = true; rerenderRoutine("#startRoutineInput"); return; }
      if(e.target.closest("#startRoutineCancel")){ startRoutineEditing = false; rerenderRoutine("#startRoutineEdit"); return; }
      if(e.target.closest("#startRoutineSave")){
        const lines = document.getElementById("startRoutineInput").value.split("\n").map(x=>x.trim()).filter(Boolean);
        STATE.config.routine = [...new Set(lines)];
        saveConfig();
        startRoutineEditing = false;
        rerenderRoutine("#startRoutineEdit");
        return;
      }
      if(e.target.closest("#startAllTradesBtn")){ STATE.view = "live"; render(); window.scrollTo(0,0); }
    });
    bento.addEventListener("keydown", (e)=>{
      if(e.key !== "Enter" && e.key !== " ") return;
      const tradeEl = e.target.closest(".start-trade-row[data-starttrade]");
      if(tradeEl){ e.preventDefault(); openStartTrade(tradeEl); }
    });
  }
}

