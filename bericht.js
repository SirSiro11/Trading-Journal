/* bericht.js — Bericht: Filter, Kennzahlen, Wortwolke, Diagramm, Export/Import */
/* =========================================================================
   BERICHT
   ========================================================================= */
const FILTER_DIMENSIONS_BASE = [
  {key:"markt", label:"Markt", cfgKey:"markets", field:"markt"},
  {key:"richtung", label:"Richtung", cfgKey:"directions", field:"richtung"},
  {key:"session", label:"Session", cfgKey:"sessions", field:"session"},
  {key:"art", label:"Entry-Art", cfgKey:"entryTypes", field:"art"},
  {key:"level", label:"Level", cfgKey:"levels", field:"level"},
  {key:"trend", label:"Trend", cfgKey:"trend", field:"trend"},
  {key:"zeiteinheit", label:"Zeiteinheit", cfgKey:"timeframes", field:"zeiteinheit"},
  {key:"kriterien", label:"Kriterien", cfgKey:"kriterien", field:"kriterien", multi:true},
  {key:"invalidierung", label:"Invalidierung", cfgKey:"invalidierung", field:"invalidierung", multi:true},
  // Kein Eintrag in den Kategorien — feste Ja/Nein-Werte aus dem Feld "mentor"
  {key:"mentor", label:"Mentor-Trade", field:"mentor", options:["Ja","Nein"], getValue: t=> t.mentor ? "Ja" : "Nein"},
];
// Dynamische Filter-/Aufschlüsselungs-Dimensionen für den Bericht — berücksichtigt
// umbenannte Überschriften (categoryLabel) und hängt frei erstellte Kategorien
// automatisch an, genau wie tradeCategoryColumns() das für Übersicht/Detailseite tut.
function getFilterDimensions(){
  const base = FILTER_DIMENSIONS_BASE.map(d=>({ ...d, label: categoryLabel(d.field, d.label) }));
  const custom = (STATE.config.customCategories||[]).map(c=>({
    key: "custom_"+c.key, label:c.label, cfgKey:"custom_"+c.key, field:null, customKey:c.key, multi:!!c.multi, isCustom:true
  }));
  return [...base, ...custom];
}

// Zeitraum-Schnellwahl im Bericht. Setzt nur Von/Bis des bestehenden Zeitraum-Filters
// (berichtDateFrom/To) — dieselben Felder wie im Filterbereich, daher bleibt alles
// kompatibel und wird wie gehabt gemerkt.
function isoOfDate(d){
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
}
function berichtPeriodPresets(){
  const today = new Date(); today.setHours(0,0,0,0);
  const mon = startOfWeek(today);
  const sun = new Date(mon); sun.setDate(mon.getDate()+6);
  const lastMon = new Date(mon); lastMon.setDate(mon.getDate()-7);
  const lastSun = new Date(mon); lastSun.setDate(mon.getDate()-1);
  const m1 = new Date(today.getFullYear(), today.getMonth(), 1);
  const mEnd = new Date(today.getFullYear(), today.getMonth()+1, 0);
  const lm1 = new Date(today.getFullYear(), today.getMonth()-1, 1);
  const lmEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  return [
    { key:"alles", label:"Alles", from:"", to:"" },
    { key:"heute", label:"Heute", from:isoOfDate(today), to:isoOfDate(today) },
    { key:"woche", label:"Diese Woche", from:isoOfDate(mon), to:isoOfDate(sun) },
    { key:"vorwoche", label:"Letzte Woche", from:isoOfDate(lastMon), to:isoOfDate(lastSun) },
    { key:"monat", label:"Dieser Monat", from:isoOfDate(m1), to:isoOfDate(mEnd) },
    { key:"vormonat", label:"Letzter Monat", from:isoOfDate(lm1), to:isoOfDate(lmEnd) }
  ];
}
function berichtPeriodRowHtml(){
  const presets = berichtPeriodPresets();
  const active = presets.find(p=> p.from === (STATE.berichtDateFrom||"") && p.to === (STATE.berichtDateTo||""));
  const custom = !active;
  return `<div class="period-row">
    <span class="period-label">Zeitraum</span>
    <div class="subtab-row" id="periodPresetRow">
      ${presets.map(p=>`<button type="button" class="subtab ${active && active.key===p.key ? "active" : ""}" data-period="${p.key}">${p.label}</button>`).join("")}
      ${custom ? `<button type="button" class="subtab active" data-period="__custom__" title="Im Filterbereich eingestellt">${formatDateDE(STATE.berichtDateFrom)||"…"} – ${formatDateDE(STATE.berichtDateTo)||"…"}</button>` : ""}
    </div>
  </div>`;
}

function activeFilterCountLabel(){
  let count = 0;
  if(STATE.berichtDateFrom || STATE.berichtDateTo) count++;
  getFilterDimensions().forEach(dim=>{
    const sel = STATE.berichtFilters[dim.key];
    if(sel && sel.length) count++;
  });
  return count ? ` · ${count} aktiv` : "";
}

function compareRingHtml(label, color, stats){
  const pct = stats.winrate===null ? 0 : Math.round(stats.winrate*100);
  return `<div class="compare-ring-item">
    <div class="gauge" style="background:${donutBg(pct)}; margin:0 auto;">${stats.winrate===null?"—":pct+"%"}</div>
    <div class="compare-ring-label"><span class="dot" style="background:${color}"></span>${label}</div>
    <div class="compare-ring-sub">${formatR(stats.totalR)} · ${stats.be}× BE</div>
  </div>`;
}

function compareSectionHtml(){
  const liveTrades = getBerichtFilteredTradesForArea("live");
  const eodTrades = getBerichtFilteredTradesForArea("eod");
  const liveStats = computeStats(liveTrades);
  const eodStats = computeStats(eodTrades);

  const fmt = (v, kind, suffix)=>{
    if(v===null || v===undefined) return `<span style="color:var(--text-faint);">—</span>`;
    if(kind==="r") return `<span class="${v>0?"pos":(v<0?"neg":"")}">${formatR(v)}</span>`;
    if(kind==="pct") return `${Math.round(v*100)} %`;
    if(kind==="factor") return (v===Infinity ? "∞" : formatNumberDE(v, 2));
    return `${v}${suffix||""}`;
  };

  const rows = [
    { label:"Trades", live: liveStats.count, eod: eodStats.count, kind:"n" },
    { label:"Erwartungswert je Trade", live: liveStats.avgR, eod: eodStats.avgR, kind:"r" },
    { label:"Summe", live: liveStats.totalR, eod: eodStats.totalR, kind:"r" },
    { label:"Trefferquote", live: liveStats.winrate, eod: eodStats.winrate, kind:"pct" },
    { label:"Profit-Faktor", live: liveStats.profitFactor, eod: eodStats.profitFactor, kind:"factor" },
    { label:"Ø Gewinn", live: liveStats.avgWin, eod: eodStats.avgWin, kind:"r" },
    { label:"Ø Verlust", live: liveStats.avgLoss!==null?-liveStats.avgLoss:null, eod: eodStats.avgLoss!==null?-eodStats.avgLoss:null, kind:"r" },
    { label:"Größter Gewinner", live: liveStats.best, eod: eodStats.best, kind:"r" },
    { label:"Größter Verlierer", live: liveStats.worst, eod: eodStats.worst, kind:"r" },
    { label:"Größter Rückgang", live: liveStats.maxDrawdown!==null?-Math.abs(liveStats.maxDrawdown):null, eod: eodStats.maxDrawdown!==null?-Math.abs(eodStats.maxDrawdown):null, kind:"r" },
    { label:"Längste Verlustserie", live: liveStats.longestSlStreak, eod: eodStats.longestSlStreak, kind:"n", suffix:" in Folge" }
  ];

  const rowsHtml = rows.map(r=>{
    const liveVal = r.label==="Trades" ? `${liveStats.count} <span style="color:var(--text-faint); font-size:11.5px;">(${liveStats.open} offen)</span>` : fmt(r.live, r.kind, r.suffix);
    const eodVal = r.label==="Trades" ? `${eodStats.count} <span style="color:var(--text-faint); font-size:11.5px;">(${eodStats.open} offen)</span>` : fmt(r.eod, r.kind, r.suffix);
    return `<tr><td>${r.label}</td><td>${liveVal}</td><td>${eodVal}</td></tr>`;
  }).join("");

  return `
    <div class="compare-wrap">
      <table class="compare-table">
        <thead><tr>
          <th></th>
          <th><span style="display:inline-flex; align-items:center; gap:6px;"><span class="dot" style="background:${AREA_COLOR.live}"></span>Live</span></th>
          <th><span style="display:inline-flex; align-items:center; gap:6px;"><span class="dot" style="background:${AREA_COLOR.eod}"></span>EOD</span></th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div class="compare-rings">
        ${compareRingHtml("Live", AREA_COLOR.live, liveStats)}
        ${compareRingHtml("EOD", AREA_COLOR.eod, eodStats)}
      </div>
    </div>
    <div style="color:var(--text-faint); font-size:12px; margin:10px 0 20px;">
      Alles in R. Ein Break-Even-Trade (0R) zählt in die Anzahl, nicht in die Trefferquote. Beide Spalten berücksichtigen die aktuellen Filter oben, aber jeweils nur ihre eigenen Trades.
    </div>
  `;
}

function renderBericht(){
  const cfg = STATE.config;
  const filteredTrades = getBerichtFilteredTrades();
  const stats = computeStats(filteredTrades);

  const areaBtns = ["live","eod"].map(a=>{
    const on = STATE.berichtAreas[a];
    return `<button data-area="${a}" class="${on?"on":""}">${AREA_LABEL[a]}</button>`;
  }).join("");

  const filterRows = getFilterDimensions().map(dim=>{
    const opts = dim.options || cfg[dim.cfgKey];
    const sel = STATE.berichtFilters[dim.key] || [];
    return `<div class="filter-row">
      <div class="filter-label">${dim.label}</div>
      <div>${chipGroupHtml("f_"+dim.key, opts, sel, {multi:true})}</div>
    </div>`;
  }).join("");

  const canCompare = STATE.berichtAreas.live && STATE.berichtAreas.eod;
  const compareActive = canCompare && STATE.berichtCompareMode === "vergleich";

  return `
    <div class="page-head">
      <h1>Bericht</h1>
      <p>Statistik & Performance über Live und EOD.</p>
    </div>

    <div class="row-between" style="align-items:flex-start;">
      <div class="area-toggle" id="areaToggle">${areaBtns}</div>
      ${canCompare ? `
      <div class="subtab-row" id="compareToggle">
        <button type="button" data-mode="gesamt" class="subtab ${!compareActive?"active":""}">Gesamt</button>
        <button type="button" data-mode="vergleich" class="subtab ${compareActive?"active":""}">Gegenüberstellung</button>
      </div>` : ""}
    </div>

    ${berichtPeriodRowHtml()}

    <div class="panel filter-panel${STATE.berichtFiltersExpanded ? "" : " is-collapsed"}">
      <div class="filter-panel-title-row">
        <div class="filter-panel-title">FILTER${!STATE.berichtFiltersExpanded ? activeFilterCountLabel() : ""}</div>
        <button type="button" class="btn btn-sm btn-ghost" id="toggleFiltersBtn">${STATE.berichtFiltersExpanded ? "Filter ausblenden" : "Filter einblenden"}</button>
      </div>
      ${STATE.berichtFiltersExpanded ? `
      <div class="filter-row">
        <div class="filter-label">Zeitraum</div>
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <input type="date" id="f_dateFrom" class="filter-date" value="${STATE.berichtDateFrom}" aria-label="Von">
          <span style="color:var(--text-dim);">bis</span>
          <input type="date" id="f_dateTo" class="filter-date" value="${STATE.berichtDateTo}" aria-label="Bis">
          <button class="btn btn-sm btn-ghost" id="clearFiltersBtn">Filter zurücksetzen</button>
        </div>
      </div>
      ${filterRows}` : ""}
    </div>

    ${compareActive ? compareSectionHtml() : `
    <div style="color:var(--text-dim); font-size:13.5px; margin-bottom:16px;">
      Alle Zahlen unten rechnen über <strong style="color:var(--text)">${filteredTrades.length} Trade${filteredTrades.length===1?"":"s"}</strong>.${(()=>{ const n = countExcludedEodCopies(); return n ? ` <span style="color:var(--text-faint);">${n} EOD-Kopie${n===1?"":"n"} von Live-Trades ${n===1?"wird":"werden"} nur einmal gezählt.</span>` : ""; })()}
    </div>

    <div class="stat-grid">
      ${nettoCardHtml(stats)}
      ${winrateCardHtml(stats)}
      ${profitFactorCardHtml(stats)}
      ${daysPlusCardHtml(stats)}
      ${avgRatioCardHtml(stats)}
    </div>
    <div style="color:var(--text-faint); font-size:12px; margin:-14px 0 20px;">
      Alles in R. Ein Break-Even-Trade (0R) zählt in die Anzahl, nicht in die Trefferquote. <strong style="color:var(--text-dim)">Tage im Plus</strong> zählt Kalendertage, nicht Trades — nur Tage mit mindestens einem Ergebnis.
    </div>

    <div class="mini-stat-row">
      <div><span class="mini-stat-label">Trades gesamt</span><span class="mini-stat-value">${stats.count}</span><span class="mini-stat-sub">${stats.open} offen</span></div>
      <div><span class="mini-stat-label">Max. Drawdown</span><span class="mini-stat-value is-key ${stats.maxDrawdown ? "neg" : ""}">${stats.maxDrawdown===null?"—":formatR(-Math.abs(stats.maxDrawdown))}</span><span class="mini-stat-sub">größter Rückgang vom Hoch</span></div>
      <div><span class="mini-stat-label">Größter Gewinner</span><span class="mini-stat-value ${stats.best>0?"pos":""}">${stats.best===null?"—":formatR(stats.best)}</span></div>
      <div><span class="mini-stat-label">Größter Verlierer</span><span class="mini-stat-value ${stats.worst<0?"neg":""}">${stats.worst===null?"—":formatR(stats.worst)}</span></div>
      <div><span class="mini-stat-label">Längste Verlustserie</span><span class="mini-stat-value ${stats.longestSlStreak?"neg":""}">${stats.longestSlStreak}</span><span class="mini-stat-sub">SL in Folge</span></div>
    </div>
    `}

    <div class="section-title">Equity-Kurve</div>
    <div class="panel equity-card">
      <div class="chart-wrap" style="height:260px;"><canvas id="chart_equity"></canvas></div>
    </div>

    <div class="section-title">Auswertung nach Kategorie</div>

    <div class="panel">
      <div style="margin-bottom:14px; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
        <span style="color:var(--text-dim); font-size:13px;">Gruppieren nach:</span>
        <div class="chip-group" id="breakdownDimSelector">
          ${getFilterDimensions().filter(d=>!d.multi).map(d=>`<button type="button" class="chip ${STATE.breakdownDim===d.key?"selected":""}" data-dim="${d.key}">${d.label}</button>`).join("")}
        </div>
      </div>
      ${breakdownTableHtml(filteredTrades)}
    </div>

    ${notesSectionHtml(filteredTrades)}

    <div class="export-bar">
      <button class="btn" id="exportCsvBtn">CSV exportieren</button>
      <button class="btn" id="exportXlsxBtn">Excel (.xlsx) exportieren</button>
      <button class="btn" id="exportJsonBtn">Backup exportieren (JSON)</button>
      <button type="button" class="btn" id="importJsonBtn">Backup importieren</button>
      <input type="file" id="importJsonInput" accept="application/json,.json" style="display:none;">
    </div>
    <div style="margin-top:8px; font-size:12.5px; color:${hasUnbackedChanges() ? "var(--amber)" : "var(--text-faint)"};">
      ${hasUnbackedChanges() ? "⚠ " : "✓ "}Zuletzt gesichert: ${formatBackupTimestamp(getLastBackupAt())}${(hasUnbackedChanges() && getLastBackupAt()) ? " — es gibt Änderungen seitdem" : ""}
    </div>
  `;
}

function donutBg(pct){
  return `radial-gradient(closest-side, var(--bg-panel) 68%, transparent 69% 100%), conic-gradient(var(--green) ${pct*3.6}deg, var(--border) 0deg)`;
}

function statCardHtml(label, cls, value, sub){
  return `<div class="stat-card">
    <div class="label">${label}</div>
    <div class="value ${cls}">${value}</div>
    ${sub?`<div class="sub">${sub}</div>`:""}
  </div>`;
}

function nettoCardHtml(stats){
  const maxMag = Math.max(stats.sumPos, Math.abs(stats.sumNeg), 0.0001);
  const posPct = Math.round((stats.sumPos/maxMag)*100);
  const negPct = Math.round((Math.abs(stats.sumNeg)/maxMag)*100);
  return `<div class="stat-card">
    <div class="label">Netto-Ergebnis in R</div>
    <div class="value ${stats.totalR>0?"pos":(stats.totalR<0?"neg":"")}">${stats.closed ? formatR(stats.totalR) : "—"}</div>
    <div class="sub">${formatR(stats.avgR)} je Trade · ${stats.closed} Trade${stats.closed===1?"":"s"}</div>
    <div class="ratio-bars">
      <div class="ratio-bar-row"><span class="ratio-label pos">${formatR(stats.sumPos)}</span><div class="ratio-track"><div class="ratio-fill seg-pos" style="width:${posPct}%"></div></div></div>
      <div class="ratio-bar-row"><span class="ratio-label neg">${formatR(stats.sumNeg)}</span><div class="ratio-track"><div class="ratio-fill seg-neg" style="width:${negPct}%"></div></div></div>
    </div>
    <div class="sub" style="margin-top:12px;">Max. Drawdown ${stats.maxDrawdown===null?"—":formatR(-Math.abs(stats.maxDrawdown))}</div>
  </div>`;
}

function winrateCardHtml(stats){
  const pct = stats.winrate===null ? 0 : Math.round(stats.winrate*100);
  return `<div class="stat-card">
    <div class="label">Trefferquote ohne Break-Even</div>
    <div class="gauge-wrap">
      <div class="gauge" style="background:${donutBg(pct)};">${stats.winrate===null?"—":pct+"%"}</div>
      <div class="sub" style="margin-top:0;">
        ${stats.winners} Gewinner<br>${stats.be} Break-Even<br>${stats.losers} Verlierer
      </div>
    </div>
  </div>`;
}

function profitFactorCardHtml(stats){
  const pf = stats.profitFactor;
  const display = pf===null ? "—" : (pf===Infinity ? "∞" : formatNumberDE(pf, 2));
  return `<div class="stat-card">
    <div class="label">Profit-Faktor <span class="label-sub">Gewinne ÷ Verluste</span></div>
    <div class="gauge-wrap">
      <div class="gauge gauge-outline">${display}</div>
      <div class="sub" style="margin-top:0;">
        <span class="pos">${formatR(stats.sumPos)}</span> gewonnen<br>
        <span class="neg">${formatR(stats.sumNeg)}</span> verloren
      </div>
    </div>
    <div class="sub" style="margin-top:12px;">1,0 = die Gewinne decken die Verluste</div>
  </div>`;
}

function daysPlusCardHtml(stats){
  const d = stats.days;
  const pct = d.pct===null ? 0 : d.pct;
  return `<div class="stat-card">
    <div class="label">Tage im Plus <span class="label-sub">Tag = Summe R &gt; 0</span></div>
    <div class="gauge-wrap">
      <div class="gauge" style="background:${donutBg(pct)};">${d.pct===null?"—":d.pct+"%"}</div>
      <div class="sub" style="margin-top:0;">
        ${d.greenDays} Gewinntage<br>${d.redDays} Verlusttage
      </div>
    </div>
    <div class="sub" style="margin-top:12px;">bester ${d.bestDay===null?"—":formatR(d.bestDay)} · schlechtester ${d.worstDay===null?"—":formatR(d.worstDay)}</div>
  </div>`;
}

function avgRatioCardHtml(stats){
  const hasBoth = stats.winners>0 && stats.losers>0;
  const maxMag = Math.max(stats.avgWin||0, stats.avgLoss||0, 0.0001);
  const winPct = stats.avgWin ? Math.round((stats.avgWin/maxMag)*100) : 0;
  const lossPct = stats.avgLoss ? Math.round((stats.avgLoss/maxMag)*100) : 0;
  return `<div class="stat-card">
    <div class="label">Ø Gewinn / Ø Verlust <span class="label-sub">Verhältnis in R</span></div>
    <div class="ratio-bars" style="margin-top:16px;">
      <div class="ratio-bar-row"><span class="ratio-label pos">${stats.avgWin===null?"—":formatR(stats.avgWin)}</span><div class="ratio-track"><div class="ratio-fill seg-pos" style="width:${winPct}%"></div></div></div>
      <div class="ratio-bar-row"><span class="ratio-label neg">${stats.avgLoss===null?"—":formatR(-stats.avgLoss)}</span><div class="ratio-track"><div class="ratio-fill seg-neg" style="width:${lossPct}%"></div></div></div>
    </div>
    ${!hasBoth ? `<div class="sub" style="margin-top:12px;">erst mit Gewinnen und Verlusten</div>` : ""}
  </div>`;
}

const NOTE_STOPWORDS = new Set([
  "und","der","die","das","den","dem","des","ein","eine","einen","einem","einer","ich","habe","hab",
  "war","bin","ist","sind","nicht","mit","auf","für","von","bei","als","aber","auch","noch","nur",
  "sehr","mal","wie","was","wenn","dann","hier","da","zu","im","in","am","an","es","sie","er","wir",
  "mein","meine","meinen","zum","zur","so","aus","nach","vor","über","unter","schon","doch","mehr",
  "kein","keine","gut","gute","guter","hat","hatte","wurde","werden","wird","gewesen","sein","seine",
  "seiner","the","and","was","for","with","this","that"
]);

function tokenizeNotes(text){
  return (text||"").toLowerCase().replace(/[.,!?;:()"'„"]/g," ").split(/\s+/).filter(w=>w.length>=3);
}

// Generische Stichwort-Häufigkeit: je Item nur einmal gezählt, damit ein langer Text
// die Statistik nicht verzerrt. Reine Text-Häufigkeit, keine KI-Analyse.
function wordFrequency(items, getText){
  const freq = {};
  items.forEach(item=>{
    const text = getText(item);
    if(!text) return;
    const seen = new Set();
    tokenizeNotes(text).forEach(w=>{
      if(NOTE_STOPWORDS.has(w) || /^\d+$/.test(w)) return;
      seen.add(w);
    });
    seen.forEach(w=> freq[w] = (freq[w]||0)+1);
  });
  return Object.entries(freq).filter(([,c])=>c>=2).sort((a,b)=>b[1]-a[1]).slice(0,24);
}

function noteWordFrequency(trades){
  return wordFrequency(trades, t=>t.notizen);
}

// Wie wordFrequency, berücksichtigt aber zusammengeführte Begriffsgruppen: alle Wörter
// einer Gruppe zählen als ein gemeinsamer Eintrag (einmal pro Item, wie gehabt).
function groupedWordFrequency(items, getText, groups){
  const wordToGroupId = {};
  (groups||[]).forEach(g=> g.words.forEach(w=> wordToGroupId[w]=g.id));

  const freq = {};
  items.forEach(item=>{
    const text = getText(item);
    if(!text) return;
    const seenKeys = new Set();
    tokenizeNotes(text).forEach(w=>{
      if(NOTE_STOPWORDS.has(w) || /^\d+$/.test(w)) return;
      const gid = wordToGroupId[w];
      seenKeys.add(gid ? ("g:"+gid) : w);
    });
    seenKeys.forEach(k=> freq[k] = (freq[k]||0)+1);
  });

  return Object.entries(freq).filter(([,c])=>c>=2).map(([key,count])=>{
    if(key.startsWith("g:")){
      const gid = key.slice(2);
      const g = (groups||[]).find(x=>x.id===gid);
      return { key, count, label: (g && g.label) || (g ? g.words.join(" / ") : key), words: g ? g.words : [key], isGroup:true, groupId: gid };
    }
    return { key, count, label: key, words: [key], isGroup:false };
  }).sort((a,b)=>b.count-a.count).slice(0,24);
}

// Baut die Stichwort-Wolke: Chips mit "✕" (ausblenden / Gruppe auflösen), "+" zum
// Wiederherstellen ausgeblendeter Begriffe, und einen Merge-Modus zum Zusammenführen
// mehrerer Begriffe (z.B. "71er" + "fibo") zu einem gemeinsam gezählten Eintrag.
function wordCloudBlockHtml(opts){
  const {
    items, getText, hidden, groups,
    chipAttr, hideAttr, restoreAttr, dissolveAttr,
    mergeToggleAttr, mergeSelectAttr, mergeConfirmAttr, mergeCancelAttr,
    scope, expanded, mergeMode, mergeSelection, wordMenuOpen, emptyMsg
  } = opts;

  const entries = groupedWordFrequency(items, getText, groups).filter(e=> !hidden.includes(e.key));

  const chips = entries.map(e=>{
    const prefix = e.isGroup ? "🔗 " : "";
    if(mergeMode){
      const selected = mergeSelection.includes(e.key);
      return `<button type="button" class="chip word-chip${selected?" selected":""}" data-${mergeSelectAttr}="${escAttr(e.key)}">${prefix}${escHtml(e.label)}<span class="word-count">${e.count}</span></button>`;
    }
    const removeAttr = e.isGroup ? dissolveAttr : hideAttr;
    const removeVal = e.isGroup ? e.groupId : e.key;
    const removeTitle = e.isGroup ? "Gruppe auflösen" : "Begriff ausblenden";
    return `
      <span class="market-chip-wrap">
        <button type="button" class="chip market-chip-label word-chip-label" data-${chipAttr}="${escAttr(e.words.join(" / "))}">${prefix}${escHtml(e.label)}<span class="word-count">${e.count}</span></button>
        <button type="button" class="market-chip-remove" data-${removeAttr}="${escAttr(removeVal)}" title="${removeTitle}">✕</button>
      </span>`;
  }).join("");

  // "+" am Zeilenende öffnet ein kleines Menü statt fest sichtbarer Zeilen darüber
  const plusMenu = !mergeMode ? `
    <span class="word-menu-wrap">
      <button type="button" class="chip chip-add" data-togglewordmenu="${scope}" title="Weitere Optionen">+</button>
      ${wordMenuOpen ? `
      <div class="word-menu-dropdown">
        <button type="button" class="word-menu-item" data-${mergeToggleAttr}="1">🔗 Begriffe zusammenführen</button>
        ${hidden.length
          ? `<button type="button" class="word-menu-item" data-togglehiddenwords="${scope}">${expanded ? "Ausgeblendete Begriffe verbergen" : `Ausgeblendete Begriffe anzeigen (${hidden.length})`}</button>`
          : `<div class="word-menu-empty">Keine ausgeblendeten Begriffe</div>`}
      </div>` : ""}
    </span>` : "";

  const cloudHtml = (entries.length || plusMenu)
    ? `<div class="chip-group" style="margin-bottom:10px;">${chips}${plusMenu}</div>`
    : `<div style="color:var(--text-faint); font-size:12.5px; margin-bottom:10px;">${emptyMsg}</div>`;

  const restoreRowHtml = (expanded && hidden.length && !mergeMode) ? `
    <div style="color:var(--text-faint); font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; margin:2px 0 8px;">Ausgeblendete Begriffe</div>
    <div class="chip-group" style="margin-bottom:14px;">
      ${hidden.map(w=>`<button type="button" class="chip" style="opacity:.75;" data-${restoreAttr}="${escAttr(w)}" title="Wiederherstellen">↺ ${escHtml(w)}</button>`).join("")}
    </div>` : "";

  const mergeBarHtml = mergeMode ? `
    <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px; flex-wrap:wrap;">
      <span style="color:var(--text-dim); font-size:12.5px;">${mergeSelection.length} ausgewählt — Begriffe anklicken, die zusammengehören</span>
      <button type="button" class="btn btn-sm btn-primary" data-${mergeConfirmAttr}="1" ${mergeSelection.length<2?"disabled":""}>Zusammenführen</button>
      <button type="button" class="btn btn-sm btn-ghost" data-${mergeCancelAttr}="1">Abbrechen</button>
    </div>` : "";

  return mergeBarHtml + cloudHtml + restoreRowHtml;
}

function wireWordCloudEvents(opts){
  const {
    hideAttr, restoreAttr, dissolveAttr,
    mergeToggleAttr, mergeSelectAttr, mergeConfirmAttr, mergeCancelAttr,
    scope, hiddenArrayKey, groupsArrayKey, onChange
  } = opts;
  const isNotes = scope === "notes";

  document.querySelectorAll(`[data-${hideAttr}]`).forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const w = btn.dataset[hideAttr];
      if(!STATE.config[hiddenArrayKey].includes(w)) STATE.config[hiddenArrayKey].push(w);
      saveConfig();
      onChange();
    });
  });
  document.querySelectorAll(`[data-${restoreAttr}]`).forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const w = btn.dataset[restoreAttr];
      STATE.config[hiddenArrayKey] = STATE.config[hiddenArrayKey].filter(x=>x!==w);
      saveConfig();
      onChange();
    });
  });
  document.querySelectorAll(`[data-${dissolveAttr}]`).forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const gid = btn.dataset[dissolveAttr];
      const removed = STATE.config[groupsArrayKey].find(g=>g.id===gid);
      if(!removed) return;
      STATE.config[groupsArrayKey] = STATE.config[groupsArrayKey].filter(g=>g.id!==gid);
      saveConfig();
      onChange();
      toast(`Gruppe „${removed.label}“ aufgelöst.`, "Rückgängig", ()=>{
        STATE.config[groupsArrayKey].push(removed);
        saveConfig();
        onChange();
      });
    });
  });
  document.querySelectorAll(`[data-togglehiddenwords="${scope}"]`).forEach(btn=>{
    btn.addEventListener("click", ()=>{
      if(isNotes){ STATE.hiddenNoteWordsExpanded = !STATE.hiddenNoteWordsExpanded; STATE.noteWordMenuOpen = false; }
      else{ STATE.hiddenInsightWordsExpanded = !STATE.hiddenInsightWordsExpanded; STATE.insightWordMenuOpen = false; }
      onChange();
    });
  });
  document.querySelectorAll(`[data-togglewordmenu="${scope}"]`).forEach(btn=>{
    btn.addEventListener("click", ()=>{
      if(isNotes) STATE.noteWordMenuOpen = !STATE.noteWordMenuOpen;
      else STATE.insightWordMenuOpen = !STATE.insightWordMenuOpen;
      onChange();
    });
  });
  document.querySelectorAll(`[data-${mergeToggleAttr}]`).forEach(btn=>{
    btn.addEventListener("click", ()=>{
      if(isNotes){ STATE.noteMergeMode = true; STATE.noteMergeSelection = []; STATE.noteWordMenuOpen = false; }
      else{ STATE.insightMergeMode = true; STATE.insightMergeSelection = []; STATE.insightWordMenuOpen = false; }
      onChange();
    });
  });
  document.querySelectorAll(`[data-${mergeSelectAttr}]`).forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const key = btn.dataset[mergeSelectAttr];
      const sel = isNotes ? STATE.noteMergeSelection : STATE.insightMergeSelection;
      const i = sel.indexOf(key);
      if(i>-1) sel.splice(i,1); else sel.push(key);
      onChange();
    });
  });
  document.querySelectorAll(`[data-${mergeConfirmAttr}]`).forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const sel = isNotes ? STATE.noteMergeSelection : STATE.insightMergeSelection;
      if(sel.length<2) return;
      let words = [];
      sel.forEach(key=>{
        if(key.startsWith("g:")){
          const gid = key.slice(2);
          const g = STATE.config[groupsArrayKey].find(x=>x.id===gid);
          if(g) words.push(...g.words);
          STATE.config[groupsArrayKey] = STATE.config[groupsArrayKey].filter(x=>x.id!==gid);
        }else{
          words.push(key);
        }
      });
      words = [...new Set(words)];
      const defaultLabel = words.join(" / ");
      const entered = await uiPrompt("Name für die zusammengeführten Begriffe:", defaultLabel, { title:"Begriffe zusammenführen", okText:"Zusammenführen" });
      if(entered === null) return;
      const label = entered.trim() || defaultLabel;
      STATE.config[groupsArrayKey].push({ id: uid(), label, words });
      saveConfig();
      if(isNotes){ STATE.noteMergeMode=false; STATE.noteMergeSelection=[]; }
      else{ STATE.insightMergeMode=false; STATE.insightMergeSelection=[]; }
      onChange();
    });
  });
  document.querySelectorAll(`[data-${mergeCancelAttr}]`).forEach(btn=>{
    btn.addEventListener("click", ()=>{
      if(isNotes){ STATE.noteMergeMode=false; STATE.noteMergeSelection=[]; }
      else{ STATE.insightMergeMode=false; STATE.insightMergeSelection=[]; }
      onChange();
    });
  });
}

function highlightQuery(text, q){
  const esc = escHtml(text);
  if(!q) return esc;
  const parts = q.split(" / ").map(s=>s.trim()).filter(Boolean);
  let result = esc;
  parts.forEach(p=>{
    const escP = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp("("+escP+")","ig"), "<mark>$1</mark>");
  });
  return result;
}


// Prüft, ob text mindestens einen der (per " / " getrennten) Suchbegriffe enthält —
// so treffen auch zusammengeführte Begriffsgruppen alle ihre Synonyme.
function matchesQuery(text, q){
  if(!q) return true;
  const t = (text||"").toLowerCase();
  const parts = q.split(" / ").map(s=>s.trim()).filter(Boolean);
  return parts.some(p=> t.includes(p));
}

function notesListHtml(trades, query){
  const q = (query||"").trim().toLowerCase();
  if(!q){
    return `<div style="color:var(--text-faint); padding:14px 0; font-size:13.5px;">
      Klicke oben auf einen Begriff oder tippe ins Suchfeld, um passende Notizen anzuzeigen.
    </div>`;
  }
  const withNotes = trades.filter(t=>t.notizen && t.notizen.trim());
  const filtered = withNotes.filter(t=> matchesQuery(t.notizen, q));
  const sorted = filtered.slice().sort((a,b)=> (b.date||"").localeCompare(a.date||""));
  if(!sorted.length){
    return `<div style="color:var(--text-dim); padding:14px 0; font-size:13.5px;">
      Keine Notizen gefunden für „${escHtml(query)}“.
    </div>`;
  }
  return `<div class="notes-list">${sorted.map(t=>`
    <div class="note-item" data-noteedit="${t.id}" tabindex="0" role="button">
      <div class="note-item-head">
        <span class="tag">${AREA_LABEL[t.area]}</span>
        <span class="tag">${formatDateDE(t.date)}</span>
        <span class="tag">${escHtml(t.markt||"—")}</span>
        ${t.ergebnis ? `<span class="badge ${resultBadgeClass(t.ergebnis)}">${t.ergebnis}</span>` : `<span class="badge badge-open">offen</span>`}
        ${t.r!==null && t.r!==undefined ? `<span class="trade-r ${t.r>0?"pos":(t.r<0?"neg":"")}" style="margin-left:auto;">${formatR(t.r)}</span>` : ""}
      </div>
      <div class="note-item-text">${highlightQuery(t.notizen, q)}</div>
    </div>
  `).join("")}</div>`;
}

function notesSectionHtml(trades){
  const cloudBlock = wordCloudBlockHtml({
    items: trades,
    getText: t=>t.notizen,
    hidden: STATE.config.hiddenNoteWords || [],
    groups: STATE.config.noteWordGroups || [],
    chipAttr: "noteword",
    hideAttr: "hidenoteword",
    restoreAttr: "restorenoteword",
    dissolveAttr: "dissolvenotegroup",
    mergeToggleAttr: "togglenotemerge",
    mergeSelectAttr: "selectnoteword",
    mergeConfirmAttr: "confirmnotemerge",
    mergeCancelAttr: "cancelnotemerge",
    scope: "notes",
    expanded: STATE.hiddenNoteWordsExpanded,
    mergeMode: STATE.noteMergeMode,
    mergeSelection: STATE.noteMergeSelection,
    wordMenuOpen: STATE.noteWordMenuOpen,
    emptyMsg: "Noch nicht genug Notizen für häufige Begriffe (ein Begriff muss in mind. 2 Trades vorkommen)."
  });

  return `
    <div class="section-title">Notizen durchsuchen</div>
    <div class="panel">
      <input type="search" id="notesSearchInput" aria-label="Notizen durchsuchen" placeholder="Notizen durchsuchen… (z.B. „FOMO“, „zu früh“, „News“)" value="${escAttr(STATE.notesSearchQuery||"")}">
      <div style="color:var(--text-faint); font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; margin:14px 0 8px;">Häufige Begriffe</div>
      ${cloudBlock}
      <div id="notesResultsContainer">${notesListHtml(trades, STATE.notesSearchQuery)}</div>
    </div>
  `;
}

// Liest den Wert einer Filter-/Aufschlüsselungs-Dimension aus einem Trade — bei frei
// erstellten Kategorien liegt der Wert in t.customCategories[customKey] statt direkt
// in t[field].
// GEÄNDERT (Fehlerbehebung): hieß vorher "valueOf" — diese Methode besitzt aber JEDES
// JavaScript-Objekt (Object.prototype.valueOf). Dadurch lieferte die Abfrage für alle
// Kategorien das Dimensions-Objekt selbst statt des Trade-Werts: Filter im Bericht fanden
// keine Trades mehr (bei Mehrfach-Kategorien sogar ein Fehler) und die Auswertung nach
// Kategorie zeigte nur eine Zeile "[object Object]".
function filterDimValue(t, dimDef){
  if(typeof dimDef.getValue === "function") return dimDef.getValue(t);
  return dimDef.isCustom ? (t.customCategories||{})[dimDef.customKey] : t[dimDef.field];
}

function breakdownTableHtml(trades){
  const dims = getFilterDimensions();
  const dimDef = dims.find(d=>d.key===STATE.breakdownDim) || dims[0];
  const groups = {};
  trades.forEach(t=>{
    const val = filterDimValue(t, dimDef);
    if(val===null || val===undefined || val==="") return;
    if(t.r===null || t.r===undefined) return; // nur geschlossene Trades fließen in R-Auswertung ein
    // Mehrfach-Kategorien (z. B. Kriterien): Trade zählt bei jedem gewählten Wert einzeln
    (Array.isArray(val) ? val : [val]).forEach(v=>{ (groups[v] = groups[v] || []).push(t.r); });
  });
  const rows = Object.keys(groups).map(k=>{
    const arr = groups[k];
    const n = arr.length;
    const sum = arr.reduce((a,b)=>a+b,0);
    const avg = sum/n;
    const wins = arr.filter(r=>r>0).length;
    const losses = arr.filter(r=>r<0).length;
    const winrate = (wins+losses)>0 ? wins/(wins+losses) : null;
    return {k, n, sum, avg, winrate};
  }).sort((a,b)=>b.avg-a.avg);

  if(!rows.length) return `<div style="color:var(--text-dim); padding:20px 0;">Noch keine geschlossenen Trades mit Ergebnis in diesem Filter.</div>`;

  return `<div class="table-scroll"><table class="breakdown">
    <thead><tr><th>${escHtml(dimDef.label)}</th><th class="num">Trades</th><th class="num">Trefferquote</th><th class="num">Ø R</th><th class="num">Summe R</th></tr></thead>
    <tbody>
      ${rows.map(r=>`<tr>
        <td>${escHtml(r.k)}</td>
        <td class="num">${r.n}</td>
        <td class="num">${r.winrate===null?"—":Math.round(r.winrate*100)+" %"}</td>
        <td class="num ${r.avg>0?"pos":(r.avg<0?"neg":"")}">${formatR(r.avg)}</td>
        <td class="num ${r.sum>0?"pos":(r.sum<0?"neg":"")}">${formatR(r.sum)}</td>
      </tr>`).join("")}
    </tbody>
  </table></div>`;
}

function matchesBerichtFilters(t){
  if(STATE.berichtDateFrom && t.date && t.date < STATE.berichtDateFrom) return false;
  if(STATE.berichtDateTo && t.date && t.date > STATE.berichtDateTo) return false;
  for(const dim of getFilterDimensions()){
    const sel = STATE.berichtFilters[dim.key];
    if(!sel || !sel.length) continue;
    if(dim.multi){
      const val = filterDimValue(t, dim) || [];
      if(!sel.some(s=>val.includes(s))) return false;
    }else{
      if(!sel.includes(filterDimValue(t, dim))) return false;
    }
  }
  return true;
}

// Sind Live und EOD gleichzeitig aktiv, existiert jeder nach EOD kopierte Live-Trade
// zweimal (Original + Kopie) und würde in Netto-R, Trefferquote, Equity usw. doppelt
// zählen. Die EOD-Kopie wird deshalb im Gesamt-Modus ausgelassen, solange ihr
// Live-Original noch existiert (verwaiste Kopien bleiben drin, sonst ginge ein Trade verloren).
function isDuplicateEodCopy(t){
  if(t.area !== "eod" || !t.copiedFromLiveId) return false;
  return STATE.trades.some(x=> x.id === t.copiedFromLiveId && x.area === "live");
}
function getBerichtFilteredTrades(){
  const activeAreas = Object.keys(STATE.berichtAreas).filter(a=>STATE.berichtAreas[a]);
  const dedupe = STATE.berichtAreas.live && STATE.berichtAreas.eod;
  return STATE.trades.filter(t=> activeAreas.includes(t.area) && matchesBerichtFilters(t) && !(dedupe && isDuplicateEodCopy(t)));
}
// Anzahl der im Gesamt-Modus ausgelassenen EOD-Kopien (für den Hinweistext im Bericht).
function countExcludedEodCopies(){
  if(!(STATE.berichtAreas.live && STATE.berichtAreas.eod)) return 0;
  return STATE.trades.filter(t=> isDuplicateEodCopy(t) && matchesBerichtFilters(t)).length;
}

// Wie getBerichtFilteredTrades, aber auf genau einen Bereich beschränkt — unabhängig vom
// Live/EOD-Umschalter. Wird für die Gegenüberstellung und die mehrfarbige
// Equity-Kurve gebraucht, damit jede Linie/Spalte nur "ihre eigenen" Trades zeigt.
function getBerichtFilteredTradesForArea(area){
  return STATE.trades.filter(t=> t.area===area && matchesBerichtFilters(t));
}

function computeStats(trades){
  const closed = trades.filter(t=>t.r!==null && t.r!==undefined);
  const open = trades.length - closed.length;
  const winners = closed.filter(t=>t.r>0).length;
  const losers = closed.filter(t=>t.r<0).length;
  const be = closed.filter(t=>t.r===0).length;
  const totalR = closed.reduce((a,t)=>a+t.r,0);
  const avgR = closed.length ? totalR/closed.length : 0;
  const sumPos = closed.filter(t=>t.r>0).reduce((a,t)=>a+t.r,0);
  const sumNeg = closed.filter(t=>t.r<0).reduce((a,t)=>a+t.r,0);
  const profitFactor = sumNeg!==0 ? (sumPos/Math.abs(sumNeg)) : (sumPos>0 ? Infinity : null);
  const winrate = (winners+losers)>0 ? winners/(winners+losers) : null;
  const rVals = closed.map(t=>t.r);
  const best = rVals.length ? Math.max(...rVals) : null;
  const worst = rVals.length ? Math.min(...rVals) : null;
  const avgWin = winners>0 ? sumPos/winners : null;
  const avgLoss = losers>0 ? Math.abs(sumNeg)/losers : null;

  // max drawdown on equity curve (sorted by date/createdAt)
  const sorted = closed.slice().sort((a,b)=> (a.date||"").localeCompare(b.date||"") || (a.createdAt||0)-(b.createdAt||0));
  let equity = 0, peak = 0, maxDD = 0;
  sorted.forEach(t=>{
    equity += t.r;
    if(equity>peak) peak = equity;
    const dd = peak - equity;
    if(dd>maxDD) maxDD = dd;
  });

  // Tages-Auswertung: Kalendertage mit mindestens einem Ergebnis, gruppiert nach Trade-Datum
  const byDate = {};
  closed.filter(t=>t.date).forEach(t=>{ byDate[t.date] = (byDate[t.date]||0) + t.r; });
  const daySums = Object.values(byDate);
  const greenDays = daySums.filter(s=>s>0).length;
  const redDays = daySums.filter(s=>s<0).length;
  const flatDays = daySums.filter(s=>s===0).length;
  const totalDays = daySums.length;
  const days = {
    totalDays, greenDays, redDays, flatDays,
    pct: totalDays ? Math.round((greenDays/totalDays)*100) : null,
    bestDay: daySums.length ? Math.max(...daySums) : null,
    worstDay: daySums.length ? Math.min(...daySums) : null
  };

  // Längste Verlustserie: meiste SL-Trades in Folge (chronologisch, jeder TP/BE unterbricht die Serie)
  let longestSlStreak = 0, currentSlStreak = 0;
  sorted.forEach(t=>{
    if(t.r < 0){ currentSlStreak++; longestSlStreak = Math.max(longestSlStreak, currentSlStreak); }
    else currentSlStreak = 0;
  });

  return {
    count: trades.length, open, closed: closed.length,
    winners, losers, be, totalR, avgR, sumPos, sumNeg,
    profitFactor, winrate, best, worst, avgWin, avgLoss,
    maxDrawdown: closed.length?maxDD:null, days, longestSlStreak
  };
}

// Fortlaufende Kalendertage-Liste (inklusive) über die min./max. Datums aller übergebenen
// Datums-Arrays hinweg — bildet die gemeinsame X-Achse für alle Linien im Equity-Chart.
function calendarDayRange(dateArrays){
  let all = [];
  dateArrays.forEach(arr=> all.push(...arr));
  all = all.filter(Boolean);
  if(!all.length) return [];
  const min = all.reduce((a,b)=> a<b?a:b);
  const max = all.reduce((a,b)=> a>b?a:b);
  const days = [];
  let d = new Date(min+"T00:00:00");
  const end = new Date(max+"T00:00:00");
  while(d<=end){
    days.push(d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"));
    d.setDate(d.getDate()+1);
  }
  return days;
}

// Kumulierter R-Verlauf entlang der übergebenen Kalendertage — an Tagen ohne Ergebnis
// bleibt die Linie auf dem letzten Stand stehen (waagerecht), statt zu springen.
function equityCalendarData(trades, days){
  const byDate = {};
  trades.forEach(t=>{
    if(t.r===null || t.r===undefined || !t.date) return;
    byDate[t.date] = (byDate[t.date]||0) + t.r;
  });
  let running = 0;
  return days.map(d=>{
    if(byDate[d]!==undefined) running += byDate[d];
    return running;
  });
}

function wireBericht(){
  document.getElementById("areaToggle").addEventListener("click",(e)=>{
    const btn = e.target.closest("button[data-area]");
    if(!btn) return;
    const a = btn.dataset.area;
    STATE.berichtAreas[a] = !STATE.berichtAreas[a];
    render();
  });

  const compareToggle = document.getElementById("compareToggle");
  if(compareToggle) compareToggle.addEventListener("click",(e)=>{
    const btn = e.target.closest("button[data-mode]");
    if(!btn) return;
    STATE.berichtCompareMode = btn.dataset.mode;
    render();
  });

  document.querySelectorAll('[data-chipgroup^="f_"]').forEach(group=>{
    group.addEventListener("click",(e)=>{
      const btn = e.target.closest("button[data-group]");
      if(!btn) return;
      const key = btn.dataset.group.replace(/^f_/,"");
      const val = btn.dataset.value;
      const arr = STATE.berichtFilters[key] || (STATE.berichtFilters[key]=[]);
      const i = arr.indexOf(val);
      if(i>-1) arr.splice(i,1); else arr.push(val);
      render();
    });
  });

  const periodRow = document.getElementById("periodPresetRow");
  if(periodRow) periodRow.addEventListener("click",(e)=>{
    const btn = e.target.closest("button[data-period]");
    if(!btn) return;
    if(btn.dataset.period === "__custom__"){ STATE.berichtFiltersExpanded = true; render(); return; }
    const p = berichtPeriodPresets().find(x=>x.key===btn.dataset.period);
    if(!p) return;
    STATE.berichtDateFrom = p.from; STATE.berichtDateTo = p.to;
    render();
  });

  const dateFromInput = document.getElementById("f_dateFrom");
  if(dateFromInput) dateFromInput.addEventListener("change",(e)=>{ STATE.berichtDateFrom = e.target.value; render(); });
  const dateToInput = document.getElementById("f_dateTo");
  if(dateToInput) dateToInput.addEventListener("change",(e)=>{ STATE.berichtDateTo = e.target.value; render(); });
  const clearFiltersBtn = document.getElementById("clearFiltersBtn");
  if(clearFiltersBtn) clearFiltersBtn.addEventListener("click",()=>{
    STATE.berichtFilters = {}; STATE.berichtDateFrom=""; STATE.berichtDateTo=""; render();
  });
  document.getElementById("toggleFiltersBtn").addEventListener("click",()=>{
    STATE.berichtFiltersExpanded = !STATE.berichtFiltersExpanded;
    render();
  });

  const dimSel = document.getElementById("breakdownDimSelector");
  if(dimSel) dimSel.addEventListener("click",(e)=>{
    const btn = e.target.closest("button[data-dim]");
    if(!btn) return;
    STATE.breakdownDim = btn.dataset.dim;
    render();
  });

  // Notizen-Suche: nur die Ergebnisliste live aktualisieren, damit der Suchfokus beim Tippen erhalten bleibt
  const notesInput = document.getElementById("notesSearchInput");
  if(notesInput){
    notesInput.addEventListener("input",(e)=>{
      STATE.notesSearchQuery = e.target.value;
      const container = document.getElementById("notesResultsContainer");
      if(container) container.innerHTML = notesListHtml(getBerichtFilteredTrades(), STATE.notesSearchQuery);
      wireNoteItemClicks();
    });
  }
  document.querySelectorAll("[data-noteword]").forEach(chip=>{
    chip.addEventListener("click", ()=>{
      STATE.notesSearchQuery = chip.dataset.noteword;
      render();
    });
  });
  wireWordCloudEvents({
    hideAttr: "hidenoteword", restoreAttr: "restorenoteword", dissolveAttr: "dissolvenotegroup",
    mergeToggleAttr: "togglenotemerge", mergeSelectAttr: "selectnoteword",
    mergeConfirmAttr: "confirmnotemerge", mergeCancelAttr: "cancelnotemerge",
    scope: "notes", hiddenArrayKey: "hiddenNoteWords", groupsArrayKey: "noteWordGroups", onChange: render
  });
  wireNoteItemClicks();

  const csvBtn = document.getElementById("exportCsvBtn");
  if(csvBtn) csvBtn.addEventListener("click", exportCsv);
  const xlsxBtn = document.getElementById("exportXlsxBtn");
  if(xlsxBtn){
    xlsxBtn.addEventListener("click", exportXlsx);
    loadXlsx().catch(()=>{}); // GEÄNDERT: im Hintergrund vorladen, sobald der Bericht offen ist
  }
  const jsonBtn = document.getElementById("exportJsonBtn");
  if(jsonBtn) jsonBtn.addEventListener("click", exportJson);
  const importInput = document.getElementById("importJsonInput");
  if(importInput) importInput.addEventListener("change", importJson);
  const importBtn = document.getElementById("importJsonBtn");
  if(importBtn && importInput) importBtn.addEventListener("click", ()=> importInput.click());
}

function wireNoteItemClicks(){
  document.querySelectorAll("[data-noteedit]").forEach(el=>{
    el.addEventListener("click", ()=>{
      const t = STATE.trades.find(x=>x.id===el.dataset.noteedit);
      if(t) openTradeModal(t.area, t);
    });
  });
}

// Zeichnet die Equity-Kurve direkt per Canvas 2D — bewusst ohne externe Bibliothek
// (Chart.js kam vorher live von cdnjs.cloudflare.com und funktionierte deshalb nicht
// ohne Internetzugriff auf diese eine Domain). Für den überschaubaren Anwendungsfall
// hier (1-3 Linien, kumulierter R-Verlauf über Kalendertage) reicht das völlig aus
// und macht die App an dieser Stelle komplett eigenständig.
// Zeichnet einen sanft geglätteten Linienzug durch die übergebenen Punkte (in ctx bereits
// per beginPath() vorbereitet) — mittels Quadratic-Bezier-Kurven durch die Mittelpunkte
// benachbarter Punkte. Trifft dabei weiterhin exakt jeden Datenpunkt (kein Überschwingen
// über den Wertebereich hinaus wie bei manchen Spline-Verfahren), wirkt aber deutlich
// runder als reine Geraden-Segmente.
function drawSmoothPath(ctx, pts){
  if(!pts.length) return;
  ctx.moveTo(pts[0].x, pts[0].y);
  if(pts.length === 1){ ctx.lineTo(pts[0].x, pts[0].y); return; }
  if(pts.length === 2){ ctx.lineTo(pts[1].x, pts[1].y); return; }
  let i;
  for(i = 1; i < pts.length - 2; i++){
    const xc = (pts[i].x + pts[i+1].x) / 2;
    const yc = (pts[i].y + pts[i+1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
  }
  ctx.quadraticCurveTo(pts[i].x, pts[i].y, pts[i+1].x, pts[i+1].y);
}

// GEÄNDERT (Design): löst "var(--token)" zur echten Farbe auf — Canvas versteht keine CSS-Variablen.
function cssColor(value, fallback){
  const m = /^var\((--[\w-]+)\)$/.exec(String(value || "").trim());
  if(!m) return value || fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim();
  return v || fallback;
}

function drawEquityChart(canvas, labels, datasets){
  const dpr = window.devicePixelRatio || 1;
  const wrap = canvas.closest(".chart-wrap");
  const cssW = Math.max(200, (wrap ? wrap.clientWidth : canvas.clientWidth) || 600);
  const cssH = Math.max(150, (wrap ? wrap.clientHeight : canvas.clientHeight) || 260);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = cssW + "px";
  canvas.style.height = cssH + "px";
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  ctx.font = "11px -apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, 'Helvetica Neue', Arial, sans-serif";
  const colGrid = cssColor("var(--separator)", "#e3e3e8");
  const colAxis = cssColor("var(--text-dim)", "#6e6e73");
  const colZero = cssColor("var(--border-light)", "#d2d2d7");

  const legendH = 26, padL = 46, padR = 14, padT = 10 + legendH, padB = 24;
  const plotW = Math.max(10, cssW - padL - padR);
  const plotH = Math.max(10, cssH - padT - padB);

  let allVals = [];
  datasets.forEach(ds => allVals.push(...ds.data));
  if(!allVals.length) allVals = [0];
  let yMin = Math.min(0, ...allVals), yMax = Math.max(0, ...allVals);
  if(yMin === yMax){ yMin -= 1; yMax += 1; }
  // "Runde" Achsenschritte (0,5 / 1 / 2 / 5 R …) statt krummer Werte wie 6,8R oder -0,6R.
  const rawStep = (yMax - yMin) / 5;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const yStep = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  yMin = Math.floor(yMin / yStep) * yStep;
  yMax = Math.ceil(yMax / yStep) * yStep;
  if(yMax - yMin < yStep * 2){ yMax += yStep; }
  const yDecimals = yStep < 1 ? 1 : 0;

  const xForIndex = i => padL + (labels.length <= 1 ? plotW / 2 : (i / (labels.length - 1)) * plotW);
  const yForVal = v => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  // Horizontale Gitterlinien + Y-Achsenbeschriftung (R-Werte)
  ctx.strokeStyle = colGrid;
  ctx.fillStyle = colAxis;
  ctx.textBaseline = "middle";
  ctx.textAlign = "right";
  ctx.lineWidth = 1;
  for(let v = yMin; v <= yMax + yStep/2; v += yStep){
    const y = yForVal(v);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + plotW, y);
    ctx.stroke();
    const vv = Math.abs(v) < yStep/1000 ? 0 : v;
    ctx.fillText((vv>0?"+":"") + vv.toFixed(yDecimals).replace(".", ",") + "R", padL - 8, y);
  }

  // X-Achsenbeschriftung, höchstens ~8 Labels über die volle Breite verteilt
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const maxXLabels = Math.max(3, Math.min(8, Math.floor(plotW / 70)));
  const step = Math.max(1, Math.ceil(labels.length / maxXLabels));
  for(let i = 0; i < labels.length; i += step){
    ctx.fillText(labels[i], xForIndex(i), padT + plotH + 8);
  }

  // Nulllinie hervorheben
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = colZero;
  ctx.beginPath();
  ctx.moveTo(padL, yForVal(0));
  ctx.lineTo(padL + plotW, yForVal(0));
  ctx.stroke();
  ctx.setLineDash([]);

  // Eine Linie pro aktivem Bereich — sanft interpoliert statt scharfer Ecken (über
  // Quadratic-Bezier-Kurven durch die Mittelpunkte benachbarter Punkte; die Linie
  // trifft dabei weiterhin exakt jeden Datenpunkt, wirkt aber deutlich runder).
  datasets.forEach(ds => {
    if(!ds.data.length) return;
    const pts = ds.data.map((v, i) => ({ x: xForIndex(i), y: yForVal(v) }));
    ctx.beginPath();
    drawSmoothPath(ctx, pts);
    ctx.strokeStyle = cssColor(ds.color, "#0071e3");
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  });

  // Legende oben links
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = "500 12px -apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, 'Helvetica Neue', Arial, sans-serif";
  let lx = padL;
  const ly = 14;
  datasets.forEach(ds => {
    ctx.fillStyle = cssColor(ds.color, "#0071e3");
    ctx.beginPath();
    ctx.arc(lx + 5, ly, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colAxis;
    ctx.fillText(ds.label, lx + 15, ly);
    lx += 15 + ctx.measureText(ds.label).width + 18;
  });
}

function renderCharts(){
  const canvas = document.getElementById("chart_equity");
  if(!canvas) return;
  const wrap = canvas.closest(".chart-wrap");
  const activeAreas = ["live","eod"].filter(a=>STATE.berichtAreas[a]);

  if(!activeAreas.length){
    if(wrap) wrap.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; color:var(--text-faint); font-size:12.5px;">Wähle mindestens einen Bereich oben aus.</div>`;
    return;
  }

  // Jede Linie nutzt ihre eigenen Trades (respektiert die aktuellen Bericht-Filter), aber
  // alle Linien teilen sich dieselbe Kalendertage-Achse, damit sie direkt vergleichbar sind.
  const tradesByArea = {};
  activeAreas.forEach(a=> tradesByArea[a] = getBerichtFilteredTradesForArea(a).filter(t=>t.r!==null && t.r!==undefined));

  const days = calendarDayRange(activeAreas.map(a=> tradesByArea[a].map(t=>t.date)));

  if(!days.length){
    if(wrap) wrap.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; color:var(--text-faint); font-size:12.5px;">Noch keine geschlossenen Trades in der aktuellen Auswahl.</div>`;
    return;
  }

  const labels = days.map(d=> d.slice(8,10)+"."+d.slice(5,7)+".");
  const datasets = activeAreas.map(a=>({
    label: AREA_LABEL[a],
    data: equityCalendarData(tradesByArea[a], days),
    color: AREA_COLOR[a]
  }));

  drawEquityChart(canvas, labels, datasets);
}

/* =========================================================================
   EXPORT / IMPORT
   ========================================================================= */
function tradesToRows(trades){
  return trades.map(t=>({
    Bereich: AREA_LABEL[t.area] || t.area,
    Datum: t.date || "",
    Markt: t.markt || "",
    Richtung: t.richtung || "",
    Session: t.session || "",
    "Entry-Art": t.art || "",
    Level: t.level || "",
    Trend: t.trend || "",
    Kriterien: (t.kriterien||[]).join(" | "),
    Invalidierung: (t.invalidierung||[]).join(" | "),
    Zeiteinheit: t.zeiteinheit || "",
    Ergebnis: t.ergebnis || "",
    R: t.r===null||t.r===undefined ? "" : t.r,
    Status: t.ergebnis ? "geschlossen" : "offen",
    "Setup genommen": t.genommen===true ? "Ja" : (t.genommen===false ? "Nein" : ""),
    "Warum nicht genommen": t.grundNichtGenommen || "",
    "Mentor-Trade": t.mentor ? "Ja" : "Nein",
    Notizen: t.notizen || ""
  }));
}

function exportCsv(){
  const rows = tradesToRows(getBerichtFilteredTrades());
  if(!rows.length){ toast("Keine Daten zum Exportieren."); return; }
  const headers = Object.keys(rows[0]);
  const csvLines = [headers.join(";")].concat(
    rows.map(r=>headers.map(h=>`"${String(r[h]).replace(/"/g,'""')}"`).join(";"))
  );
  downloadBlob(csvLines.join("\n"), "trading-journal-export.csv", "text/csv;charset=utf-8;");
  toast("CSV exportiert.");
}

// GEÄNDERT: SheetJS wird bei Bedarf nachgeladen statt beim Seitenstart (render-blockierend, ~900 KB)
let xlsxLoading = null;
function loadXlsx(){
  if(typeof XLSX !== "undefined") return Promise.resolve();
  if(!xlsxLoading){
    xlsxLoading = new Promise((resolve, reject)=>{
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      s.async = true;
      s.onload = ()=> resolve();
      s.onerror = ()=>{ s.remove(); xlsxLoading = null; reject(new Error("xlsx")); };
      document.head.appendChild(s);
    });
  }
  return xlsxLoading;
}

async function exportXlsx(){
  const rows = tradesToRows(getBerichtFilteredTrades());
  if(!rows.length){ toast("Keine Daten zum Exportieren."); return; }
  try{ await loadXlsx(); }catch(_){ toast("Excel-Export nicht verfügbar (kein Internet)."); return; }
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Trades");
  XLSX.writeFile(wb, "trading-journal-export.xlsx");
  toast("Excel-Datei exportiert.");
}

function exportJson(){
  // GEÄNDERT (Stufe 2): gleiches kompaktes Format wie der Cloud-Sync (Bilder nur einmal).
  const payload = buildBackupPayload();
  delete payload.savedAt;
  downloadBlob(JSON.stringify(payload), "trading-journal-backup.json", "application/json");
  markBackedUp();
  render();
  toast("Backup exportiert.");
}

function importJson(e){
  const file = e.target.files[0];
  e.target.value = ""; // dieselbe Datei später erneut auswählbar
  if(!file) return;
  const reader = new FileReader();
  reader.onload = async (ev)=>{
    try{
      const data = expandPayloadShots(JSON.parse(ev.target.result)); // GEÄNDERT: altes + kompaktes Format
      if(!Array.isArray(data.trades)) throw new Error("Ungültiges Format");
      const insightCount = Array.isArray(data.insights) ? data.insights.length : 0;
      if(!await uiConfirm(`${data.trades.length} Trades${insightCount?` und ${insightCount} Erkenntnisse`:""} importieren? Das ersetzt deine aktuellen Daten.`, { title:"Backup importieren", okText:"Importieren" })) return;
      STATE.trades = migrateTrades(data.trades);
      if(data.config) STATE.config = Object.assign(JSON.parse(JSON.stringify(DEFAULT_CONFIG)), data.config);
      if(Array.isArray(data.insights)) STATE.insights = data.insights;
      STATE.dayConfirmations = Array.isArray(data.dayConfirmations) ? data.dayConfirmations : [];
      if(data.news && Array.isArray(data.news.events)){ STATE.news = pruneNewsStore(sanitizeNewsStore(data.news)); saveNews(); }
      saveTrades(); saveConfig(); saveInsights(); saveDayConfirmations();
      markBackedUp();
      render();
      toast("Backup importiert.");
    }catch(err){
      uiAlert("Die Datei ist kein gültiges Backup.", { title:"Import fehlgeschlagen" });
    }
  };
  reader.readAsText(file);
}

function downloadBlob(content, filename, mime){
  const blob = new Blob([content], {type: mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

