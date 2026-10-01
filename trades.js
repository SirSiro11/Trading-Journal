/* trades.js — Live/EOD-Listen, Kalender, Trade-Detail, Trade-Formular, Screenshots */
/* =========================================================================
   LIVE / EOD VIEW
   ========================================================================= */
const AREA_INTRO = {
  live: "Deine tatsächlich gehandelten Live-Trades.",
  eod: "Alle Setups, die du im Markt gesehen hast — genommen oder nicht."
};

function getAreaFilteredTrades(area){
  let trades = STATE.trades.filter(t=>t.area===area);
  const filter = STATE.areaDateFilter[area] || "alles";
  trades = trades.filter(t=> dateMatchesFilter(t.date, filter));
  const q = ((STATE.areaSearch && STATE.areaSearch[area]) || "").trim().toLowerCase();
  if(q) trades = trades.filter(t=> tradeSearchText(t).includes(q));
  if(STATE.areaMentorOnly && STATE.areaMentorOnly[area]) trades = trades.filter(t=> t.mentor);
  return trades.sort((a,b)=> (b.date||"").localeCompare(a.date||"") || (b.createdAt||0)-(a.createdAt||0));
}

// Durchsuchbarer Text eines Trades für die Schnellsuche in Live/EOD: Markt, Datum,
// alle Kategorien-Werte (inkl. eigener Kategorien), Ergebnis, Notizen und der Grund
// für "nicht genommen". Reine Anzeige-Filterung, am Trade selbst ändert sich nichts.
function tradeSearchText(t){
  const parts = [t.markt, formatDateDE(t.date), t.date, t.ergebnis || "offen", t.notizen, t.grundNichtGenommen, t.mentor ? "mentor-trade mentor" : ""];
  tradeCategoryColumns(t.area).forEach(col=> tradeCategoryCellValues(t, col).forEach(v=> parts.push(v.text)));
  return parts.filter(Boolean).join(" \u0001 ").toLowerCase();
}

// Kurzbilanz der gerade sichtbaren Trades (Zeitraum + Suche) — damit sich ein Tag oder
// eine Woche direkt in der Liste auswerten lässt, ohne in den Bericht zu wechseln.
function areaSummaryHtml(trades){
  if(!trades.length) return `<span class="list-summary">0 Trades</span>`;
  const st = startPeriodStatsFromList(trades);
  const rCls = st.sum>0?"pos":(st.sum<0?"neg":"");
  return `<span class="list-summary">${trades.length} Trade${trades.length===1?"":"s"}${st.open?` · ${st.open} offen`:""}${st.closed?` · Summe <b class="${rCls}">${formatR(st.sum)}</b>`:""}${st.winrate!==null?` · Trefferquote <b>${st.winrate} %</b>`:""}</span>`;
}
function startPeriodStatsFromList(trades){
  const closed = trades.filter(t=> t.r!==null && t.r!==undefined);
  const sum = closed.reduce((a,t)=>a+t.r, 0);
  const wins = closed.filter(t=>t.r>0).length, losses = closed.filter(t=>t.r<0).length;
  return { closed:closed.length, open:trades.length-closed.length, sum, winrate:(wins+losses)?Math.round(wins/(wins+losses)*100):null };
}

function tradeListInnerHtml(area, trades){
  return trades.length ? tradeListHeaderHtml(area) + trades.map(t=>tradeListRowHtml(t)).join("") : emptyStateHtml(area);
}

function renderAreaView(area){
  const trades = getAreaFilteredTrades(area);
  const list = tradeListInnerHtml(area, trades);
  const filterVal = STATE.areaDateFilter[area] || "alles";

  const subtabs = ["alles","monat","woche","heute"].map(f=>{
    const lbl = {alles:"Alles", monat:"Dieser Monat", woche:"Diese Woche", heute:"Heute"}[f];
    return `<button data-datefilter="${f}" class="subtab ${filterVal===f?"active":""}">${lbl}</button>`;
  }).join("");

  return `
    <div class="page-head">
      <h1>${AREA_LABEL[area]}</h1>
      <p>${AREA_INTRO[area]}</p>
    </div>
    <div class="row-between" style="align-items:flex-start;">
      <div class="subtab-row" id="subtabRow">${subtabs}</div>
      <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end;">
        <button class="btn" id="btnJumpCalendar">Kalender</button>
        <button class="btn btn-primary" id="btnAddTrade">+ Trade hinzufügen</button>
      </div>
    </div>
    <div class="list-toolbar">
      <input type="search" class="search-input" id="areaSearchInput" placeholder="Suchen: Markt, Tag, Notiz …" value="${escAttr((STATE.areaSearch && STATE.areaSearch[area]) || "")}" aria-label="Trades durchsuchen">
      <button type="button" class="mentor-toggle${STATE.areaMentorOnly[area] ? " on" : ""}" id="areaMentorToggle" aria-pressed="${STATE.areaMentorOnly[area] ? "true" : "false"}" title="Nur Mentor-Trades anzeigen"><span class="mentor-ico" aria-hidden="true">★</span> Mentor-Trades</button>
      <span id="areaSummary">${areaSummaryHtml(trades)}</span>
    </div>
    <div class="trade-list-scroll" id="tradeListScroll"><div class="trade-list" id="tradeListContainer" style="--list-min:${tradeListMinWidth(area)}px">${list}</div></div>
    ${area==="eod" ? eodReasonsSectionHtml() : ""}
    ${calendarHtml(area)}
    ${dayDetailHtml(area)}
  `;
}

function emptyStateHtml(area){
  const q = ((STATE.areaSearch && STATE.areaSearch[area]) || "").trim();
  const filtered = q || (STATE.areaDateFilter[area] && STATE.areaDateFilter[area] !== "alles") || STATE.areaMentorOnly[area];
  return `<div class="empty-state panel">
    <div class="big">◇</div>
    <div>${q ? `Keine Trades gefunden für „${escHtml(q)}“.` : STATE.areaMentorOnly[area] ? `Keine Mentor-Trades für diesen Zeitraum in ${AREA_LABEL[area]}.` : `Keine Einträge für diesen Zeitraum in ${AREA_LABEL[area]}.`}</div>
    ${filtered
      ? `<button type="button" class="btn btn-sm btn-ghost" data-resetareafilter="1">Suche &amp; Zeitraum zurücksetzen</button>`
      : `<button type="button" class="btn btn-primary" data-emptyadd="1">+ Ersten Trade erfassen</button>`}
  </div>`;
}

// Reine Ansicht (nicht bearbeitbar) der Trades eines per Kalender ausgewählten Tages
function dayDetailHtml(area){
  const date = STATE.areaSelectedDay[area];
  if(!date) return "";
  const trades = STATE.trades.filter(t=>t.area===area && t.date===date && tradeMatchesCalendarMarkets(area, t))
    .sort((a,b)=> (b.createdAt||0)-(a.createdAt||0));
  return `
    <div class="row-between" style="margin-top:26px; margin-bottom:0;">
      <div class="section-title" style="margin:0;">Trades am ${formatDateDE(date)}</div>
      <button type="button" class="btn btn-sm btn-ghost" id="closeDayDetail">✕ schließen</button>
    </div>
    <div class="panel">
      ${trades.length ? `<div class="day-detail-list">${trades.map(t=>dayDetailItemHtml(t)).join("")}</div>` : `<div style="color:var(--text-dim); font-size:13.5px;">Keine Trades an diesem Tag.</div>`}
      ${(()=>{ const n = tradeDayNewsHtml(date, { compact:true }); return n ? `<div class="trade-news-block"><div class="view-label">📰 High-Impact-News an diesem Tag</div>${n}</div>` : ""; })()}
    </div>
  `;
}

function dayDetailItemHtml(t){
  const rDisplay = (t.r===null || t.r===undefined) ? "—" : formatR(t.r);
  const rClass = (t.r>0) ? "pos" : (t.r<0 ? "neg" : "");

  if(t.area==="eod"){
    const genommenTag = t.genommen===true ? `<span class="tag" style="color:var(--green);">genommen</span>`
      : t.genommen===false ? `<span class="tag" style="color:var(--red);">nicht genommen</span>`
      : `<span class="tag">—</span>`;
    return `<div class="day-detail-item" data-viewtrade="${t.id}" tabindex="0" role="button">
      <span class="trade-market" style="min-width:76px;">${escHtml(t.markt||"—")}</span>
      <div class="trade-tags" style="flex:1;">${genommenTag}</div>
      <span class="badge ${t.ergebnis?resultBadgeClass(t.ergebnis):"badge-open"}">${t.ergebnis?t.ergebnis:"offen"}</span>
      <span class="trade-r ${rClass}">${rDisplay}</span>
    </div>`;
  }

  const subtags = [t.richtung, t.session, t.art].filter(Boolean);
  return `<div class="day-detail-item" data-viewtrade="${t.id}" tabindex="0" role="button">
    <span class="trade-market" style="min-width:76px;">${escHtml(t.markt||"—")}</span>
    <div class="trade-tags" style="flex:1;">${subtags.map(x=>`<span class="tag">${escHtml(x)}</span>`).join("")}</div>
    <span class="badge ${t.ergebnis?resultBadgeClass(t.ergebnis):"badge-open"}">${t.ergebnis?t.ergebnis:"offen"}</span>
    <span class="trade-r ${rClass}">${rDisplay}</span>
  </div>`;
}

/* ---------- Gründe für "nicht genommen" (nur EOD) — Sammelübersicht mit Stichwort-Wolke,
   damit sich wiederkehrende Zögerlichkeits-Muster erkennen lassen. Zeigt zu jedem Grund
   auch das (falls eingetragene) Ergebnis, um zu sehen ob die Zurückhaltung im Nachhinein
   gut oder schlecht war. ---------- */
function eodReasonsSectionHtml(){
  const items = STATE.trades.filter(t=>t.area==="eod" && t.genommen===false && t.grundNichtGenommen && t.grundNichtGenommen.trim());
  const count = items.length;
  const expanded = STATE.eodReasonsExpanded;

  const header = `
    <div class="row-between" style="margin-top:26px; margin-bottom:${expanded?"14px":"0"};">
      <div class="section-title" style="margin:0;">Gründe für „nicht genommen“${count?` (${count})`:""}</div>
      <button type="button" class="btn btn-sm btn-ghost" id="toggleEodReasons">${expanded?"✕ ausblenden":"anzeigen"}</button>
    </div>
  `;

  if(!expanded) return header;

  if(!count){
    return header + `<div class="panel" style="color:var(--text-dim); font-size:13.5px;">Noch keine „nicht genommen“-Trades mit eingetragenem Grund.</div>`;
  }

  const cloud = wordFrequency(items, t=>t.grundNichtGenommen);
  const cloudHtml = cloud.length
    ? `<div class="chip-group" style="margin-bottom:14px;">${cloud.map(([w,c])=>`<button type="button" class="chip word-chip" data-eodreasonword="${escAttr(w)}">${escHtml(w)}<span class="word-count">${c}</span></button>`).join("")}</div>`
    : `<div style="color:var(--text-faint); font-size:12.5px; margin-bottom:14px;">Noch nicht genug Einträge für wiederkehrende Themen (ein Begriff muss in mind. 2 Gründen vorkommen).</div>`;

  return header + `
    <div class="panel">
      <input type="search" id="eodReasonsSearchInput" aria-label="Gründe durchsuchen" placeholder="Gründe durchsuchen…" value="${escAttr(STATE.eodReasonsQuery||"")}">
      <div style="color:var(--text-faint); font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; margin:14px 0 8px;">Häufige Themen</div>
      ${cloudHtml}
      <div id="eodReasonsListContainer">${eodReasonsListHtml(items, STATE.eodReasonsQuery)}</div>
    </div>
  `;
}

function eodReasonsListHtml(items, query){
  const q = (query||"").trim().toLowerCase();
  const filtered = q ? items.filter(t=> t.grundNichtGenommen.toLowerCase().includes(q)) : items;
  const sorted = filtered.slice().sort((a,b)=> (b.date||"").localeCompare(a.date||"") || (b.createdAt||0)-(a.createdAt||0));
  if(!sorted.length){
    return `<div style="color:var(--text-dim); padding:14px 0; font-size:13.5px;">Keine Einträge gefunden${q?` für „${escHtml(query)}“`:""}.</div>`;
  }
  return `<div class="notes-list">${sorted.map(t=>{
    const rDisplay = (t.r===null || t.r===undefined) ? "" : formatR(t.r);
    const rClass = (t.r>0) ? "pos" : (t.r<0 ? "neg" : "");
    return `<div class="note-item" data-viewtrade="${t.id}" tabindex="0" role="button">
      <div class="note-item-head">
        <span class="tag">${formatDateDE(t.date)}</span>
        <span class="tag">${escHtml(t.markt||"—")}</span>
        ${t.ergebnis ? `<span class="badge ${resultBadgeClass(t.ergebnis)}">${t.ergebnis}</span>` : `<span class="badge badge-open">kein Ergebnis</span>`}
        ${rDisplay ? `<span class="trade-r ${rClass}" style="margin-left:auto;">${rDisplay}</span>` : ""}
      </div>
      <div class="note-item-text">${highlightQuery(t.grundNichtGenommen, q)}</div>
    </div>`;
  }).join("")}</div>`;
}

/* ---------- Kalender (à la FXReplay) ---------- */
// Auswahlliste für den Markt-Filter des Kalenders: die konfigurierten Märkte in ihrer
// Reihenfolge, aber nur die, zu denen es im jeweiligen Bereich auch Trades gibt —
// plus eventuelle Altbestände, die nicht mehr in der Konfiguration stehen.
function calendarMarketOptions(area){
  const used = new Set(STATE.trades.filter(t=>t.area===area && t.markt).map(t=>t.markt));
  const opts = (STATE.config.markets||[]).filter(m=>used.has(m));
  used.forEach(m=>{ if(!opts.includes(m)) opts.push(m); });
  return opts;
}

// Leere Auswahl = alle Märkte. Bereinigt nebenbei Märkte, die es nicht mehr gibt.
function calendarMarketFilter(area){
  const sel = STATE.areaCalendarMarkets[area] || [];
  const opts = calendarMarketOptions(area);
  return sel.filter(m=>opts.includes(m));
}

function tradeMatchesCalendarMarkets(area, t){
  const sel = calendarMarketFilter(area);
  return !sel.length || sel.includes(t.markt);
}

function calendarMarketChipsHtml(area){
  const opts = calendarMarketOptions(area);
  if(!opts.length) return "";
  const sel = calendarMarketFilter(area);
  const chips = [`<button type="button" class="chip ${sel.length?"":"selected"}" data-calmarket="__alle__">Alle</button>`]
    .concat(opts.map(m=>`<button type="button" class="chip ${sel.includes(m)?"selected":""}" data-calmarket="${escAttr(m)}">${escHtml(m)}</button>`));
  return `
    <div class="cal-market-filter">
      <div style="color:var(--text-faint); font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; margin-bottom:8px;">${categoryLabel("markt","Markt")}</div>
      <div class="chip-group">${chips.join("")}</div>
    </div>
  `;
}

function calendarHtml(area){
  const cal = STATE.areaCalendarMonth[area];
  const year = cal.year, month = cal.month;
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = (firstOfMonth.getDay()+6)%7; // Mo=0
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const monthLabel = firstOfMonth.toLocaleDateString("de-DE", {month:"long", year:"numeric"});

  const byDate = {};
  STATE.trades.filter(t=>t.area===area && t.r!==null && t.r!==undefined && tradeMatchesCalendarMarkets(area, t)).forEach(t=>{
    (byDate[t.date] = byDate[t.date] || []).push(t.r);
  });

  // Zellen als flache Liste aufbauen (null = leere Füllzelle), dann in 7er-Wochenzeilen aufteilen
  const cellDefs = [];
  for(let i=0;i<startWeekday;i++) cellDefs.push(null);
  for(let day=1; day<=daysInMonth; day++) cellDefs.push(day);
  while(cellDefs.length % 7 !== 0) cellDefs.push(null);

  let rowsHtml = "";
  let monthTotal = 0;
  let monthHasData = false;

  for(let r=0; r<cellDefs.length; r+=7){
    const rowDefs = cellDefs.slice(r, r+7);
    let rowCells = "";
    let weekSum = 0;
    let weekHasData = false;

    rowDefs.forEach(day=>{
      if(day===null){
        rowCells += `<div class="cal-cell cal-empty"></div>`;
        return;
      }
      const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
      const rs = byDate[dateStr];
      let cls = "cal-cell";
      let inner = `<div class="cal-daynum">${day}</div>`;
      if(rs && rs.length){
        const sum = rs.reduce((a,b)=>a+b,0);
        cls += sum>0 ? " cal-pos" : (sum<0 ? " cal-neg" : " cal-neutral");
        inner += `<div class="cal-r">${formatR(sum)}</div><div class="cal-count">${rs.length} Trade${rs.length===1?"":"s"}</div>`;
        weekSum += sum; weekHasData = true;
        monthTotal += sum; monthHasData = true;
      }
      if(dateStr === todayISO()) cls += " cal-today";
      if(STATE.areaSelectedDay[area] === dateStr) cls += " cal-selected";
      rowCells += `<div class="${cls}" data-caldate="${dateStr}" tabindex="0" role="button" aria-label="${formatDateDE(dateStr)}${rs&&rs.length?": "+formatR(rs.reduce((a,b)=>a+b,0)):""}">${inner}</div>`;
    });

    const weekCls = "cal-week-total" + (weekHasData ? (weekSum>0?" cal-pos":(weekSum<0?" cal-neg":" cal-neutral")) : "");
    rowCells += `<div class="${weekCls}">${weekHasData ? formatR(weekSum) : "—"}</div>`;
    rowsHtml += rowCells;
  }

  const monthCls = monthHasData ? (monthTotal>0?"pos":(monthTotal<0?"neg":"")) : "";

  return `
    <div class="section-title" id="calendarAnchor">Kalender</div>
    <div class="panel cal-panel">
      ${calendarMarketChipsHtml(area)}
      <div class="cal-header">
        <button type="button" class="btn btn-sm btn-ghost" data-calnav="-1" aria-label="Vorheriger Monat" title="Vorheriger Monat">‹</button>
        <div class="cal-month-label">${monthLabel}</div>
        <button type="button" class="btn btn-sm btn-ghost" data-calnav="1" aria-label="Nächster Monat" title="Nächster Monat">›</button>
      </div>
      <div class="cal-weekdays"><div>Mo</div><div>Di</div><div>Mi</div><div>Do</div><div>Fr</div><div>Sa</div><div>So</div><div>Σ<span class="cal-wk-word"> Woche</span></div></div>
      <div class="cal-grid">${rowsHtml}</div>
      <div class="cal-month-total">
        <span>Monat gesamt</span>
        <span class="${monthCls}">${monthHasData ? formatR(monthTotal) : "—"}</span>
      </div>
    </div>
  `;
}

// CSS-Klasse für das Ergebnis-Badge (TP grün, SL rot, BE amber, sonst neutral).
function resultBadgeClass(ergebnis){
  return (ergebnis==="TP"||ergebnis==="SL"||ergebnis==="BE") ? "badge-closed badge-result-"+ergebnis : "badge-closed";
}

function formatR(r){
  const n = Number(r);
  const s = n.toFixed(2).replace(".", ",");
  return (n>0?"+":"") + s + "R";
}

// Zahl mit deutschem Dezimalkomma (z. B. Profit-Faktor 3,67 statt 3.67).
function formatNumberDE(n, digits){
  return Number(n).toFixed(digits).replace(".", ",");
}

// ISO-Datum (JJJJ-MM-TT, so wird intern gespeichert) -> deutsche Anzeige TT.MM.JJJJ.
// Einheitlich in Listen, Detailseite, Notizen und Erkenntnissen — vorher stand dort das
// rohe ISO-Format neben deutsch formatierten Zeitstempeln.
function formatDateDE(iso){
  if(!iso || typeof iso !== "string" || iso.length < 10) return iso || "";
  return iso.slice(8,10) + "." + iso.slice(5,7) + "." + iso.slice(0,4);
}

function formatBackupTimestamp(ts){
  if(!ts) return "noch nie";
  const d = new Date(ts);
  const pad = n => String(n).padStart(2,"0");
  return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())} Uhr`;
}

function wireAreaView(area){
  document.getElementById("btnAddTrade").addEventListener("click", ()=> openTradeModal(area, null));

  // Springt direkt zum Kalender weiter unten auf derselben Seite (Live bzw. EOD).
  const jumpCalBtn = document.getElementById("btnJumpCalendar");
  if(jumpCalBtn) jumpCalBtn.addEventListener("click", ()=>{
    const anchor = document.getElementById("calendarAnchor");
    if(anchor) anchor.scrollIntoView({ behavior:"smooth", block:"start" });
  });

  // Markt-Filter des Kalenders: Mehrfachauswahl, "Alle" setzt zurück.
  document.querySelectorAll("[data-calmarket]").forEach(b=>{
    b.addEventListener("click", ()=>{
      const m = b.dataset.calmarket;
      if(m === "__alle__"){
        STATE.areaCalendarMarkets[area] = [];
      } else {
        const cur = calendarMarketFilter(area);
        STATE.areaCalendarMarkets[area] = cur.includes(m) ? cur.filter(x=>x!==m) : cur.concat([m]);
      }
      render();
      const anchor = document.getElementById("calendarAnchor");
      if(anchor) anchor.scrollIntoView({ block:"start" });
    });
  });
  wireTradeListRows(document.getElementById("tradeListContainer"), area);

  // Schnellsuche: nur Liste + Kurzbilanz neu zeichnen, damit der Fokus im Feld bleibt.
  const searchInput = document.getElementById("areaSearchInput");
  if(searchInput) searchInput.addEventListener("input", (e)=>{
    STATE.areaSearch[area] = e.target.value;
    refreshAreaList(area);
  });
  wireEmptyStateButtons(area);

  const mentorToggle = document.getElementById("areaMentorToggle");
  if(mentorToggle) mentorToggle.addEventListener("click", ()=>{
    STATE.areaMentorOnly[area] = !STATE.areaMentorOnly[area];
    mentorToggle.classList.toggle("on", STATE.areaMentorOnly[area]);
    mentorToggle.setAttribute("aria-pressed", STATE.areaMentorOnly[area] ? "true" : "false");
    refreshAreaList(area);
  });

  const subtabRow = document.getElementById("subtabRow");
  if(subtabRow) subtabRow.addEventListener("click",(e)=>{
    const btn = e.target.closest("[data-datefilter]");
    if(!btn) return;
    STATE.areaDateFilter[area] = btn.dataset.datefilter;
    render();
  });

  document.querySelectorAll("[data-calnav]").forEach(b=>{
    b.addEventListener("click", ()=>{
      const delta = parseInt(b.dataset.calnav,10);
      let {year, month} = STATE.areaCalendarMonth[area];
      month += delta;
      if(month<0){ month=11; year--; }
      if(month>11){ month=0; year++; }
      STATE.areaCalendarMonth[area] = {year, month};
      render();
    });
  });

  document.querySelectorAll("[data-caldate]").forEach(b=>{
    b.addEventListener("click", ()=>{
      const date = b.dataset.caldate;
      STATE.areaSelectedDay[area] = (STATE.areaSelectedDay[area]===date) ? null : date;
      render();
    });
  });

  const closeDayBtn = document.getElementById("closeDayDetail");
  if(closeDayBtn) closeDayBtn.addEventListener("click", ()=>{
    STATE.areaSelectedDay[area] = null;
    render();
  });

  // Öffnet die Trade-Detailseite bei Klick — gilt sowohl für die Kalender-Tageseinträge
  // und die "Gründe nicht genommen"-Suche als auch für die Trade-Karten selbst (dort
  // aber NICHT, wenn auf einen der Buttons wie "Bearbeiten"/"Löschen" geklickt wurde).
  document.querySelectorAll("[data-viewtrade]").forEach(el=>{
    if(el.closest("#tradeListContainer")) return; // Listenzeilen: siehe wireTradeListRows
    el.addEventListener("click", (e)=>{
      if(e.target.closest("button")) return;
      const t = STATE.trades.find(x=>x.id===el.dataset.viewtrade);
      if(t) openTradeDetail(t);
    });
  });

  const toggleReasonsBtn = document.getElementById("toggleEodReasons");
  if(toggleReasonsBtn) toggleReasonsBtn.addEventListener("click", ()=>{
    STATE.eodReasonsExpanded = !STATE.eodReasonsExpanded;
    render();
  });

  const reasonsSearch = document.getElementById("eodReasonsSearchInput");
  if(reasonsSearch){
    reasonsSearch.addEventListener("input",(e)=>{
      STATE.eodReasonsQuery = e.target.value;
      const items = STATE.trades.filter(t=>t.area==="eod" && t.genommen===false && t.grundNichtGenommen && t.grundNichtGenommen.trim());
      const container = document.getElementById("eodReasonsListContainer");
      if(!container) return;
      container.innerHTML = eodReasonsListHtml(items, STATE.eodReasonsQuery);
      // Nur die neu gerenderten Einträge verdrahten — ein seitenweites querySelectorAll
      // würde den Trade-Karten oben bei jedem Tastendruck einen weiteren Listener anhängen.
      container.querySelectorAll("[data-viewtrade]").forEach(el=>{
        el.addEventListener("click", (e)=>{
          if(e.target.closest("button")) return;
          const t = STATE.trades.find(x=>x.id===el.dataset.viewtrade);
          if(t) openTradeDetail(t);
        });
      });
    });
  }
  document.querySelectorAll("[data-eodreasonword]").forEach(chip=>{
    chip.addEventListener("click", ()=>{
      STATE.eodReasonsQuery = chip.dataset.eodreasonword;
      render();
    });
  });
}

// Verdrahtet Bearbeiten/Löschen/→EOD und den Klick auf die Zeile (Detailseite) für alle
// Trade-Zeilen innerhalb von root — getrennt ausgelagert, damit die Schnellsuche nur die
// Liste neu zeichnen kann, ohne der restlichen Seite doppelte Listener anzuhängen.
/* GEÄNDERT (Stufe 4): Event-Delegation — EIN Klick-Listener pro Listen-Container statt
   je fünf Listener pro Trade-Zeile. Bei hunderten Trades spart das bei jedem Neuzeichnen
   viele hundert addEventListener-Aufrufe. Der Container wird nur einmal verdrahtet
   (refreshAreaList ersetzt nur seinen Inhalt), der Bereich steht in data-list-area. */
function wireTradeListRows(root, area){
  if(!root) return;
  root.dataset.listArea = area;
  if(root.dataset.rowsWired) return;
  root.dataset.rowsWired = "1";
  root.addEventListener("click", (e)=>{
    const area = root.dataset.listArea;
    const shotBtn = e.target.closest("[data-listshot]");
    if(shotBtn && root.contains(shotBtn)){
      e.stopPropagation();
      if(shotBtn.classList.contains("is-broken")) return;
      const t = STATE.trades.find(x=>x.id===shotBtn.dataset.listshot);
      const shots = t ? tradeScreenshotList(t) : [];
      if(shots.length) openLightbox(shots[0]);
      return;
    }
    const editBtn = e.target.closest("[data-edit]");
    if(editBtn && root.contains(editBtn)){
      const t = STATE.trades.find(x=>x.id===editBtn.dataset.edit);
      openTradeModal(area, t);
      return;
    }
    const delBtn = e.target.closest("[data-del]");
    if(delBtn && root.contains(delBtn)){ deleteTradeFromList(delBtn.dataset.del); return; }
    const copyBtn = e.target.closest("[data-copy-eod]");
    if(copyBtn && root.contains(copyBtn)){
      const t = STATE.trades.find(x=>x.id===copyBtn.dataset.copyEod);
      if(!t) return;
      const copy = copyTradeToEod(t);
      render();
      toast("In EOD kopiert.");
      openTradeModal("eod", copy);
      return;
    }
    const row = e.target.closest("[data-viewtrade]");
    if(row && root.contains(row)){
      if(e.target.closest("button")) return;
      const t = STATE.trades.find(x=>x.id===row.dataset.viewtrade);
      if(t) openTradeDetail(t);
    }
  });
}

// Löschen aus der Liste (mit Rückfrage, EOD-Kopie optional, Rückgängig per Toast).
async function deleteTradeFromList(delId){
    if(!await uiConfirm("Direkt danach kannst du das Löschen noch einige Sekunden rückgängig machen.", { title:"Diesen Trade löschen?", okText:"Löschen", danger:true })) return;
    const deleted = STATE.trades.find(x=>x.id===delId);
    if(!deleted) return;
    // GEÄNDERT: Wurde ein Live-Trade nach EOD übernommen, wird gefragt, ob die
    // EOD-Kopie mitgelöscht werden soll. Standard (Abbrechen/Esc) = EOD behalten.
    const eodCopies = deleted.area === "live"
      ? STATE.trades.filter(x=> x.area === "eod" && x.copiedFromLiveId === deleted.id)
      : [];
    let alsoEod = false;
    if(eodCopies.length){
      alsoEod = await uiConfirm(
        `Dieser Trade wurde ins EOD übernommen (${formatDateDE(eodCopies[0].date)}${eodCopies[0].markt ? " · " + eodCopies[0].markt : ""}). Soll der Eintrag im EOD ebenfalls gelöscht werden?`,
        { title:"Auch aus dem EOD löschen?", okText:"Auch im EOD löschen", cancelText:"Nur Live löschen", danger:true });
    }
    // Alle zu löschenden Trades samt Position merken (für "Rückgängig")
    const toDelete = [deleted].concat(alsoEod ? eodCopies : []);
    const removed = toDelete.map(t=> ({ t, idx: STATE.trades.indexOf(t) })).sort((a,b)=> a.idx - b.idx);
    removed.slice().reverse().forEach(r=> STATE.trades.splice(r.idx, 1));
    // War das ein EOD-Trade, der aus einem Live-Trade kopiert wurde? Dann den
    // Live-Trade wieder freigeben, damit "→ EOD kopieren" dort erneut möglich ist.
    let source = null, sourceWasCopied = false;
    if(deleted.copiedFromLiveId){
      source = STATE.trades.find(x=>x.id===deleted.copiedFromLiveId);
      if(source){ sourceWasCopied = !!source.copiedToEod; source.copiedToEod = false; }
    }
    saveTrades();
    render();
    toast(removed.length > 1 ? "Trade in Live und EOD gelöscht." : "Trade gelöscht.", "Rückgängig", ()=>{
      removed.forEach(r=>{
        if(STATE.trades.some(x=>x.id===r.t.id)) return;
        STATE.trades.splice(Math.min(r.idx, STATE.trades.length), 0, r.t);
      });
      if(source) source.copiedToEod = sourceWasCopied;
      saveTrades();
      render();
      toast(removed.length > 1 ? "Trades wiederhergestellt." : "Trade wiederhergestellt.");
    }, 7000);
}

function refreshAreaList(area){
  const container = document.getElementById("tradeListContainer");
  if(!container) return;
  const trades = getAreaFilteredTrades(area);
  container.innerHTML = tradeListInnerHtml(area, trades);
  const sum = document.getElementById("areaSummary");
  if(sum) sum.innerHTML = areaSummaryHtml(trades);
  wireTradeListRows(container, area);
  wireEmptyStateButtons(area);
}

function wireEmptyStateButtons(area){
  const c = document.getElementById("tradeListContainer");
  if(!c) return;
  const add = c.querySelector("[data-emptyadd]");
  if(add) add.addEventListener("click", ()=> openTradeModal(area, null));
  const reset = c.querySelector("[data-resetareafilter]");
  if(reset) reset.addEventListener("click", ()=>{
    STATE.areaSearch[area] = "";
    STATE.areaDateFilter[area] = "alles";
    STATE.areaMentorOnly[area] = false;
    render();
  });
}

/* =========================================================================
   TRADE MODAL (Add / Edit)
   ========================================================================= */
// Screenshot-Kategorien pro Trade. "key" ist der Feldname in t.screenshots,
// "label" der Anzeigetext in Formular und Detailansicht.
// Feste Kategorien-Spalten für die Trade-Tabellen-Darstellung — bewusst eine einzige,
// gemeinsame Quelle für Übersicht (Live/EOD) UND Detailansicht, damit beide
// garantiert gleich aussehen. "multi" = mehrere Tags möglich (Kriterien/Invalidierung).
const TRADE_CATEGORY_COLUMNS = [
  { key:"richtung", label:"Richtung" },
  { key:"session", label:"Session" },
  { key:"art", label:"Entry-Art" },
  { key:"level", label:"Level" },
  { key:"trend", label:"Trend" },
  { key:"zeiteinheit", label:"Zeiteinheit" },
  { key:"kriterien", label:"Kriterien", multi:true },
  { key:"invalidierung", label:"Invalidierung", multi:true }
];
// Alle Kategorien-Spalten bewusst exakt gleich breit — nur so sind die Abstände
// zwischen den Labels wirklich identisch (unterschiedlich breite Spalten hätten
// unterschiedlich große Lücken zur Folge, selbst wenn jede Spalte für sich korrekt
// berechnet ist). Lange Einzelwerte (z. B. "Out of Session") brechen bei Bedarf
// innerhalb ihrer Zelle auf zwei Zeilen um, statt zu überlaufen (siehe .tag CSS).
// Die Anzahl Spalten ist nicht mehr fix — frei erstellte Kategorien (siehe
// STATE.config.customCategories) werden automatisch angehängt, das Raster wird
// entsprechend dynamisch neu berechnet statt einer festen Werteliste.
const TRADE_CATEGORY_COL_WIDTH = 96; // px, Listen-Ansicht (Platz für Werte wie "BOS/ChoCh")
const TRADE_CATEGORY_COL_WIDTH_DETAIL = 140; // px, Detailseite (mehr Platz verfügbar)

// Liefert die aktuell gültige Überschrift für ein Kategorie-Feld — vom Nutzer
// umbenannte Kategorien überschreiben den Standardnamen (siehe "Kategorie
// umbenennen" im Verwalten-Bereich).
function categoryLabel(field, defaultLabel){
  return (STATE.config.categoryLabelOverrides && STATE.config.categoryLabelOverrides[field]) || defaultLabel;
}

// EOD-Trades bekommen zusätzlich die "Genommen"-Spalte — bei Live gibt es
// dieses Feld gar nicht, dort bleibt die Spalte entsprechend komplett weg (nicht nur
// leer). Frei erstellte Kategorien werden danach angehängt, gelten für alle Bereiche.
function tradeCategoryColumns(area){
  const cols = TRADE_CATEGORY_COLUMNS.map(c=>({ ...c, label: categoryLabel(c.key, c.label) }));
  if(area === "eod") cols.push({key:"genommen", label:categoryLabel("genommen","Genommen")});
  (STATE.config.customCategories||[]).forEach(c=>{
    cols.push({ key:c.key, label:c.label, multi:!!c.multi, custom:true });
  });
  return cols;
}
// Listen-Ansicht: alle Kategorien-Spalten weiterhin exakt gleich breit (Kopfzeile und
// Zeilen nutzen dieselbe Vorlage, die Ausrichtung bleibt also identisch) — sie dürfen
// aber bei schmaleren Fenstern gemeinsam bis auf TRADE_CATEGORY_COL_MIN schrumpfen.
// Vorher waren sie starr 96 px breit, wodurch auf Laptop-Breite (1280–1440 px) die
// Bearbeiten-/Löschen-Buttons und teils das Ergebnis aus dem sichtbaren Bereich ragten.
const TRADE_CATEGORY_COL_MIN = 70;
function tradeCategoryGrid(area){
  return Array(tradeCategoryColumns(area).length).fill(`minmax(${TRADE_CATEGORY_COL_MIN}px, ${TRADE_CATEGORY_COL_WIDTH}px)`).join(" ");
}
// Mindestbreite der Liste, ab der horizontal gescrollt wird (Summe aller Mindestspalten).
const TRADE_LIST_ACTIONS_MIN = 76;
// Live: "→ EOD" sitzt jetzt mit in der Aktionsspalte (vor Bearbeiten/Löschen) → breiter.
const TRADE_LIST_ACTIONS_MIN_LIVE = 146;
// Vorschau 100 px + 24 px Luft zum R-Ergebnis davor (Bild sitzt rechtsbündig in der Spalte).
const TRADE_LIST_THUMB_COL = 124;
function tradeListActionsMin(area){ return area === "eod" ? TRADE_LIST_ACTIONS_MIN : TRADE_LIST_ACTIONS_MIN_LIVE; }
function tradeListMinWidth(area){
  const n = tradeCategoryColumns(area).length;
  const colCount = 2 + n + 3;
  const fixed = 78 + 76 + 56 + TRADE_LIST_THUMB_COL + tradeListActionsMin(area);
  return fixed + n * TRADE_CATEGORY_COL_MIN + (colCount - 1) * 10 + 32 + 2;
}
function tradeCategoryGridDetail(area){
  return Array(tradeCategoryColumns(area).length).fill(TRADE_CATEGORY_COL_WIDTH_DETAIL+"px").join(" ");
}
function tradeCategoryCellValues(t, col){
  if(col.custom){
    const raw = (t.customCategories||{})[col.key];
    if(col.multi) return (raw||[]).map(v=>({text:v}));
    return raw ? [{text:raw}] : [];
  }
  if(col.key === "level") return t.level ? [{text:"Lvl "+t.level}] : [];
  if(col.key === "richtung"){
    if(!t.richtung) return [];
    const v = String(t.richtung).toLowerCase();
    return [{ text:t.richtung, cls: v.includes("long") ? "tag-long" : (v.includes("short") ? "tag-short" : "") }];
  }
  if(col.key === "genommen"){
    if(t.genommen==null) return [];
    return [{ text: t.genommen?"genommen":"nicht genommen", cls: t.genommen?"tag-taken":"tag-nottaken" }];
  }
  if(col.multi) return (t[col.key]||[]).map(v=>({text:v}));
  return t[col.key] ? [{text:t[col.key]}] : [];
}
// Eine Zeile mit den ausgewählten Werten eines einzelnen Trades, spaltengenau zur
// Kopfzeile ausgerichtet. Nicht gesetzte Kategorien bleiben als leere Spalte stehen,
// statt komplett zu verschwinden — dadurch bleibt die Ausrichtung über alle Trades hinweg
// konsistent. Enthält zusätzlich ein Mini-Label pro Zelle, das nur auf schmalen
// Bildschirmen sichtbar wird (siehe CSS), wenn die Kopfzeile dort ausgeblendet ist.
// Wird nur noch von der Detailseite genutzt (die Listen-Übersicht hat ihr eigenes,
// enger gepacktes Raster, siehe tradeListRowHtml/tradeListHeaderHtml weiter unten).
function tradeCategoryRowHtml(t){
  const cols = tradeCategoryColumns(t.area);
  const cells = cols.map(col=>{
    const values = tradeCategoryCellValues(t, col);
    const chips = values.map(v=>`<span class="tag ${v.cls||""}">${escHtml(v.text)}</span>`).join("");
    return `<div class="cat-col-value${values.length?"":" cat-col-empty"}">${values.length?`<span class="cat-col-mobile-label">${col.label}</span>`:""}${chips}</div>`;
  }).join("");
  return `<div class="cat-table-row" style="grid-template-columns:${tradeCategoryGridDetail(t.area)}">${cells}</div>`;
}
// Kopfzeile mit den fixen Kategorienamen — nur für die Detailseite (feste, nicht
// dehnbare Breiten, siehe TRADE_CATEGORY_GRID_DETAIL).
function tradeCategoryHeaderHtml(area){
  return `<div class="cat-table-header-bar"><div class="cat-table-header" style="grid-template-columns:${tradeCategoryGridDetail(area)}">
    ${tradeCategoryColumns(area).map(c=>`<div class="cat-col-label">${c.label}</div>`).join("")}
  </div></div>`;
}

// Für die Listen-Übersicht (Live/EOD): EIN einziges Zeilenraster, das Markt,
// Datum, EOD-Bezug, alle Kategorien, Status, Ergebnis und Buttons in einer einzigen
// Zeile pro Trade unterbringt — nutzt dieselbe Kategorien-Spaltenbreite wie oben, ergänzt
// um feste Spalten links (Markt/Datum/EOD) und rechts (Status/Ergebnis/Buttons).
function tradeListGrid(area){
  // Die "→ EOD"-Spalte (Button/Badge) ist bei EOD-Trades selbst nie relevant — dort
  // komplett weglassen statt nur leer zu lassen, damit der Freiraum den Kategorien
  // und Buttons zugutekommt statt ungenutzt zu bleiben.
  // Die frühere "→ EOD"-Spalte ist in die Aktionsspalte gewandert; an ihrer Stelle
  // steht jetzt die Screenshot-Vorschau (in Live und EOD).
  // Reihenfolge: Markt | Datum | Kategorien (teilen sich die Restbreite gleichmäßig) |
  // R-Ergebnis | Screenshot-Vorschau | Aktionen. Die frühere Status-Spalte (TP/SL/BE/offen)
  // entfällt — das Ergebnis steckt schon in der farbigen R-Zahl.
  const cats = Array(tradeCategoryColumns(area).length).fill(`minmax(${TRADE_CATEGORY_COL_MIN}px,1fr)`).join(" ");
  return `78px 76px ${cats} 56px ${TRADE_LIST_THUMB_COL}px ${tradeListActionsMin(area)}px`;
}
function tradeListHeaderHtml(area){
  const catLabels = tradeCategoryColumns(area).map(c=>`<div class="cat-col-label">${c.label}</div>`).join("");
  return `<div class="cat-table-header-bar"><div class="cat-table-header" style="grid-template-columns:${tradeListGrid(area)}">
    <div></div><div></div>${catLabels}<div></div><div></div><div></div>
  </div></div>`;
}
function tradeListRowHtml(t){
  const isOpen = !t.ergebnis;
  const rDisplay = (t.r===null || t.r===undefined || t.r==="") ? "—" : formatR(t.r);
  const rClass = (t.r>0) ? "pos" : (t.r<0 ? "neg" : "");
  const eodExtra = (t.area==="live" && !t.copiedToEod) ? `<button type="button" class="btn btn-sm eod-inline-btn" data-copy-eod="${t.id}" title="In EOD kopieren">→ EOD</button>`
    : t.copiedToEod ? `<span class="badge badge-eod-copied">✓ EOD</span>` : "";
  const shots = tradeScreenshotList(t);
  const thumbCell = shots.length
    ? `<button type="button" class="trade-thumb" data-listshot="${t.id}" title="Screenshot ansehen" aria-label="Screenshot ansehen${shots.length>1?` (1 von ${shots.length})`:""}"><img src="${escAttr(shots[0])}" alt="" loading="lazy" decoding="async">${shots.length>1?`<span class="trade-thumb-count">${shots.length}</span>`:""}</button>`
    : `<div class="trade-thumb-empty" aria-hidden="true"></div>`;
  const cols = tradeCategoryColumns(t.area);
  const catCells = cols.map(col=>{
    const values = tradeCategoryCellValues(t, col);
    // Kriterien in der Übersicht nur als Anzahl (die einzelnen Werte stehen im Tooltip
    // und auf der Detailseite) — sonst wird die Zeile bei vielen Kriterien sehr hoch.
    const chips = (col.key === "kriterien" && !col.custom)
      ? (values.length ? `<span class="tag" title="${escAttr(values.map(v=>v.text).join(", "))}">${values.length}</span>` : "")
      : values.map(v=>`<span class="tag ${v.cls||""}">${escHtml(v.text)}</span>`).join("");
    return `<div class="cat-col-value${values.length?"":" cat-col-empty"}">${values.length?`<span class="cat-col-mobile-label">${col.label}</span>`:""}${chips}</div>`;
  }).join("");

  return `<div class="trade-card" data-id="${t.id}" data-viewtrade="${t.id}" tabindex="0" role="button" aria-label="${escAttr((t.markt||"Trade")+" vom "+formatDateDE(t.date)+" öffnen")}" style="grid-template-columns:${tradeListGrid(t.area)}">
    <div class="trade-market" title="${escAttr(t.markt||"")}">${escHtml(t.markt||"—")}</div>
    <div class="trade-date-badge">${formatDateDE(t.date)}</div>
    ${catCells}
    <div class="trade-r ${rClass}" title="${isOpen?"offen":escAttr(t.ergebnis)}">${rDisplay}</div>
    ${thumbCell}
    <div class="trade-actions">
      ${eodExtra}
      <button type="button" class="icon-action" data-edit="${t.id}" title="Bearbeiten" aria-label="Bearbeiten">${ICON_EDIT}</button>
      <button type="button" class="icon-action is-danger" data-del="${t.id}" title="Löschen" aria-label="Löschen">${ICON_DELETE}</button>
    </div>
  </div>`;
}

// Alle Screenshots eines Trades in fester Reihenfolge HTF → LTF → Zusätzlich
// (das erste davon ist die Vorschau in der Liste).
function tradeScreenshotList(t){
  const s = t.screenshots || {};
  return SHOT_CATEGORIES.reduce((all, c)=> all.concat(s[c.key] || []), []);
}

// Kleine Strich-Symbole (erben die Textfarbe) für die kompakten Aktions-Buttons.
const ICON_EDIT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
const ICON_DELETE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>`;

const SHOT_CATEGORIES = [
  { key:"htf",      label:"HTF (Higher Time Frame)" },
  { key:"ltf",      label:"LTF (Lower Time Frame)" },
  { key:"sonstige", label:"Zusätzlich" }
];

function emptyTrade(area){
  return {
    id: uid(),
    area,
    date: todayISO(),
    richtung: null,
    markt: null,
    session: null,
    art: null,
    level: null,
    trend: null,
    kriterien: [],
    invalidierung: [],
    zeiteinheit: null,
    ergebnis: null,
    r: null,
    genommen: area==="eod" ? null : undefined,
    grundNichtGenommen: "",
    mentor: false, // von einem Mentor bestätigt / selbst genommen (nur Formular, Detail & Filter)
    notizen: "",
    customCategories: {},
    screenshots: { htf: [], ltf: [], sonstige: [] },
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

// Kopiert einen Live-Trade 1:1 als eigenständigen neuen Eintrag nach EOD (unabhängiger
// Schnappschuss — spätere Änderungen an einem der beiden Trades wirken sich nicht auf
// den anderen aus). Das Datum bleibt das des ursprünglichen Trades, damit EOD ihn
// automatisch dem richtigen Tag zuordnet.
function copyTradeToEod(liveTrade){
  const copy = {
    id: uid(),
    area: "eod",
    date: liveTrade.date,
    richtung: liveTrade.richtung,
    markt: liveTrade.markt,
    session: liveTrade.session,
    art: liveTrade.art,
    level: liveTrade.level,
    trend: liveTrade.trend,
    kriterien: [...(liveTrade.kriterien||[])],
    invalidierung: [...(liveTrade.invalidierung||[])],
    zeiteinheit: liveTrade.zeiteinheit,
    ergebnis: liveTrade.ergebnis,
    r: liveTrade.r,
    genommen: true, // war ein echter Live-Trade, wurde also genommen
    mentor: !!liveTrade.mentor,
    notizen: liveTrade.notizen || "",
    customCategories: JSON.parse(JSON.stringify(liveTrade.customCategories||{})),
    screenshots: {
      htf: [...((liveTrade.screenshots&&liveTrade.screenshots.htf)||[])],
      ltf: [...((liveTrade.screenshots&&liveTrade.screenshots.ltf)||[])],
      sonstige: [...((liveTrade.screenshots&&liveTrade.screenshots.sonstige)||[])]
    },
    copiedFromLiveId: liveTrade.id,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  STATE.trades.push(copy);
  liveTrade.copiedToEod = true;
  saveTrades();
  return copy;
}

/* NEU (2026.10.01): Versehentlich im EOD erfassten Live-Trade ins Live übernehmen.
   Erreichbar über die Detailansicht eines EOD-Trades ("→ Ins Live"). Zwei Varianten:
   - "EOD-Eintrag behalten" (Standard): Es entsteht ein neuer Live-Trade, der EOD-Eintrag
     bleibt als genommene, verknüpfte Kopie stehen — genau der Zustand, als wäre der Trade
     im Live erfasst und dann per "→ EOD" kopiert worden (copiedToEod / copiedFromLiveId).
   - ohne Haken: Der Eintrag wird ins Live verschoben und verschwindet aus dem EOD.
   Nicht angeboten für EOD-Kopien, deren Live-Original noch existiert (die sind ja schon im Live).
   Rückgängig per Toast stellt den vorherigen Zustand exakt wieder her. */
function canMoveEodToLive(t){
  if(!t || t.area !== "eod") return false;
  if(t.copiedFromLiveId && STATE.trades.some(x=> x.id === t.copiedFromLiveId)) return false;
  return true;
}
async function moveEodTradeToLive(t){
  if(!canMoveEodToLive(t)) return;
  const wasNotTaken = t.genommen === false;
  const r = await uiDialog({
    title: "Ins Live übernehmen?",
    text: "Der Trade wird mit allen Kategorien, Ergebnis, Notizen und Screenshots ins Live übernommen."
      + (wasNotTaken ? " Er war im EOD als „nicht genommen“ markiert — im Live gilt er als genommen." : ""),
    checkbox: "EOD-Eintrag zusätzlich behalten (als verknüpfte Kopie, wie bei „→ EOD“)",
    checkboxDefault: true,
    okText: "Ins Live übernehmen"
  });
  if(!r) return;
  const idx = STATE.trades.indexOf(t);
  if(idx < 0) return;
  const before = JSON.parse(JSON.stringify(t));
  let liveTrade;
  if(r.checked){
    liveTrade = JSON.parse(JSON.stringify(t));
    liveTrade.id = uid();
    liveTrade.area = "live";
    delete liveTrade.genommen;
    delete liveTrade.copiedFromLiveId;
    liveTrade.grundNichtGenommen = "";
    liveTrade.copiedToEod = true;
    liveTrade.createdAt = Date.now();
    liveTrade.updatedAt = Date.now();
    STATE.trades.push(liveTrade);
    t.copiedFromLiveId = liveTrade.id;
    t.genommen = true;
    t.grundNichtGenommen = "";
    t.updatedAt = Date.now();
  }else{
    liveTrade = t;
    t.area = "live";
    delete t.genommen;
    delete t.copiedFromLiveId;
    t.copiedToEod = false;
    t.grundNichtGenommen = "";
    t.updatedAt = Date.now();
  }
  saveTrades();
  STATE.view = "live";
  STATE.viewingTrade = liveTrade;
  render();
  toast(r.checked ? "Ins Live übernommen — EOD-Eintrag bleibt verknüpft." : "Ins Live verschoben.", "Rückgängig", ()=>{
    if(r.checked){
      const li = STATE.trades.indexOf(liveTrade);
      if(li > -1) STATE.trades.splice(li, 1);
    }
    const cur = STATE.trades.findIndex(x=> x.id === before.id);
    if(cur > -1) STATE.trades[cur] = before; else STATE.trades.splice(Math.min(idx, STATE.trades.length), 0, before);
    saveTrades();
    STATE.view = "eod";
    STATE.viewingTrade = before;
    render();
    toast("Rückgängig gemacht.");
  }, 7000);
}

function openTradeModal(area, existing){
  STATE.editingArea = area;
  STATE.editingId = existing ? existing.id : null;
  STATE.draft = existing ? JSON.parse(JSON.stringify(existing)) : emptyTrade(area);
  STATE.modalFreshOpen = true;
  const d = STATE.draft;
  d._rMagnitudeInput = (d.r !== null && d.r !== undefined) ? String(Math.abs(d.r)).replace(".", ",") : "";
  STATE.draftSnapshot = draftFingerprint(d);
  renderModal();
}

// Vergleichswert für "wurde im Formular etwas geändert?" — UI-Hilfsfelder (_…) zählen nicht,
// der eingetippte R-Betrag aber schon.
function draftFingerprint(d){
  if(!d) return "";
  return JSON.stringify(d, (k, v)=> (k && k.charAt(0) === "_" && k !== "_rMagnitudeInput") ? undefined : v);
}

// Schließen über ✕, Abbrechen, Klick daneben oder Escape: bei ungespeicherten Eingaben
// erst nachfragen — vorher genügte ein versehentlicher Klick neben das Formular, und
// alle Eingaben inkl. eingefügter Screenshots waren weg.
async function requestCloseTradeModal(){
  if(!STATE.draft){ closeModal(); return; }
  if(draftFingerprint(STATE.draft) !== STATE.draftSnapshot){
    const ok = await uiConfirm("Deine Eingaben in diesem Formular wurden noch nicht gespeichert.", { title:"Änderungen verwerfen?", okText:"Verwerfen", cancelText:"Weiter bearbeiten", danger:true });
    if(!ok) return;
  }
  closeModal();
}

function closeModal(){
  document.removeEventListener("paste", handlePasteEvent);
  document.getElementById("modalRoot").innerHTML = "";
  STATE.draft = null;
  STATE.draftSnapshot = null;
  STATE.editingId = null;
}

/* =========================================================================
   SCHREIBGESCHÜTZTE TRADE-ANSICHT (z.B. aus dem Kalender-Tagesdetail)
   Zeigt alle Felder + Screenshots an, ohne jede Bearbeitungsmöglichkeit.
   ========================================================================= */
// Öffnet die Trade-Detailansicht als eigene, vollbreite Seite (statt eines kleinen
// Modals) — überschreibt in render() vorübergehend die normale Ansicht, ohne
// STATE.view selbst zu ändern. Dadurch bleibt beim Zurückgehen (closeTradeDetail)
// automatisch genau die vorherige Ansicht (Live/EOD/Bericht) erhalten,
// inklusive markiertem Nav-Tab — ganz ohne eigene "return view"-Verwaltung.
function openTradeDetail(t){
  STATE.viewingTrade = t;
  render();
}

function closeTradeDetail(){
  STATE.viewingTrade = null;
  render();
}

function renderTradeDetail(t){
  const rDisplay = (t.r===null || t.r===undefined) ? "" : formatR(t.r);
  const rClass = (t.r>0) ? "pos" : (t.r<0 ? "neg" : "");

  // Screenshots (HTF / LTF / Zusätzlich) nebeneinander als eigene Spalten anordnen,
  // statt sie wie zuvor in vollen Reihen untereinander zu stapeln.
  const shotCols = SHOT_CATEGORIES.map(c=>{
    const arr = (t.screenshots && t.screenshots[c.key]) || [];
    if(!arr.length) return "";
    return `<div class="trade-detail-shot-col">
      <div class="view-label">${c.label}</div>
      <div class="shot-gallery-col">
        ${arr.map((src,i)=>`<div class="shot-thumb lg" data-viewshotref="${c.key}:${i}" role="button" tabindex="0" aria-label="${escAttr(c.label)}-Screenshot ${i+1} vergrößern"><img src="${escAttr(src)}" alt=""></div>`).join("")}
      </div>
    </div>`;
  }).join("");

  // Kategorien + zugehörige Tags tabellenartig, Zeile pro Kategorie (statt Spalte pro
  // Kategorie) — dadurch bleibt es übersichtlich, egal wie viele Kategorien es gibt.
  const catCols = tradeCategoryColumns(t.area);
  const catRows = catCols.map(col=>{
    const values = tradeCategoryCellValues(t, col);
    if(!values.length) return "";
    const chips = values.map(v=>`<span class="tag ${v.cls||""}">${escHtml(v.text)}</span>`).join("");
    // GEÄNDERT (Mobil): Tags in einem Flex-Container mit Abstand — vorher lagen sie als
    // Inline-Elemente direkt aneinander und wurden am iPhone mitten im Wort umbrochen.
    return `<tr><td class="trade-detail-cat-label">${escHtml(col.label)}</td><td><div class="trade-detail-tags">${chips}</div></td></tr>`;
  }).join("");

  return `
    <div class="row-between">
      <button class="btn btn-ghost btn-sm" id="tradeDetailBackBtn">← Zurück</button>
      <div class="trade-detail-actions">
        ${canMoveEodToLive(t) ? `<button class="btn" id="tradeDetailToLiveBtn" title="Versehentlich im EOD erfasst? Ins Live übernehmen">→ Ins Live</button>` : ""}
        <button class="btn" id="tradeDetailEditBtn">Bearbeiten</button>
      </div>
    </div>

    <div class="page-head" style="margin-top:18px;">
      <h1>${escHtml(t.markt||"Trade")}</h1>
      <p>${AREA_LABEL[t.area]} · ${formatDateDE(t.date)} · Nur Ansicht</p>
      ${t.mentor ? `<div style="margin-top:10px;"><span class="mentor-badge">★ Mentor-Trade</span></div>` : ""}
    </div>

    <div class="panel">
      <div class="view-row">
        <div class="view-label">Ergebnis</div>
        <div class="view-value">
          ${t.ergebnis ? `<span class="badge ${resultBadgeClass(t.ergebnis)}">${t.ergebnis}</span>` : `<span class="badge badge-open">offen</span>`}
          ${rDisplay ? `<span class="trade-r ${rClass}" style="margin-left:10px;">${rDisplay}</span>` : ""}
        </div>
      </div>

      ${(()=>{ const n = tradeDayNewsHtml(t.date); return n ? `<div class="view-row"><div class="view-label">📰 High-Impact-News an diesem Tag</div>${n}</div>` : ""; })()}
      ${t.grundNichtGenommen ? `<div class="view-row"><div class="view-label">Warum nicht genommen?</div><div class="view-value" style="white-space:pre-wrap;">${escHtml(t.grundNichtGenommen)}</div></div>` : ""}
      ${t.notizen ? `<div class="view-row"><div class="view-label">Notizen</div><div class="view-value" style="white-space:pre-wrap;">${escHtml(t.notizen)}</div></div>` : ""}

      ${shotCols ? `<div class="view-row"><div class="trade-detail-shots">${shotCols}</div></div>` : `<div style="color:var(--text-faint); font-size:13px; margin-bottom:16px;">Keine Screenshots hinterlegt.</div>`}

      ${catRows ? `<div class="view-row"><div class="view-label">Kategorien</div>
        <table class="breakdown trade-detail-cat-table"><tbody>${catRows}</tbody></table>
      </div>` : ""}
    </div>
  `;
}

function wireTradeDetail(){
  const t = STATE.viewingTrade;
  document.getElementById("tradeDetailBackBtn").addEventListener("click", closeTradeDetail);
  document.getElementById("tradeDetailEditBtn").addEventListener("click", ()=>{
    closeTradeDetail();
    openTradeModal(t.area, t);
  });
  const toLiveBtn = document.getElementById("tradeDetailToLiveBtn");
  if(toLiveBtn) toLiveBtn.addEventListener("click", ()=> moveEodTradeToLive(t));
  document.querySelectorAll("[data-viewshotref]").forEach(el=>{
    el.addEventListener("click", ()=>{
      const [cat, idxStr] = el.dataset.viewshotref.split(":");
      const arr = (STATE.viewingTrade.screenshots && STATE.viewingTrade.screenshots[cat]) || [];
      openLightbox(arr[parseInt(idxStr, 10)]);
    });
  });
}

function openLightbox(src){
  const lb = document.createElement("div");
  lb.className = "lightbox-backdrop";
  // GEÄNDERT: als Dialog ausgezeichnet, Bild mit Alternativtext, src escaped, Fokus rein/zurück
  lb.setAttribute("role", "dialog");
  lb.setAttribute("aria-modal", "true");
  lb.setAttribute("aria-label", "Bildansicht");
  lb._returnFocus = document.activeElement;
  lb.innerHTML = `
    <button type="button" class="lightbox-close" title="Schließen (Esc)" aria-label="Schließen">✕</button>
    <img src="${escAttr(src)}" alt="Screenshot, vergrößert">
  `;
  document.body.appendChild(lb);
  lb.querySelector(".lightbox-close").focus({preventScroll:true});

  const img = lb.querySelector("img");

  // Klick auf den dunklen Hintergrund schließt; Klick aufs Bild selbst nicht (sonst würde
  // die erste Hälfte eines Doppelklicks das Fenster schon wieder zumachen).
  lb.addEventListener("click", (e)=>{ if(e.target === lb) closeLightbox(lb); });
  lb.querySelector(".lightbox-close").addEventListener("click", ()=> closeLightbox(lb));
  img.addEventListener("click", (e)=> e.stopPropagation());

  // Doppelklick aufs Bild schaltet auf echtes Vollbild um (nochmal doppelklicken schaltet zurück)
  img.addEventListener("dblclick", (e)=>{
    e.stopPropagation();
    lb.classList.toggle("lb-fullscreen");
    if(lb.classList.contains("lb-fullscreen")){
      if(lb.requestFullscreen) lb.requestFullscreen().catch(()=>{});
    }else if(document.fullscreenElement){
      document.exitFullscreen().catch(()=>{});
    }
  });
}

// GEÄNDERT: gemeinsames Schließen der Bildansicht inkl. Fokus-Rückgabe
function closeLightbox(lb){
  const back = lb._returnFocus;
  lb.remove();
  if(document.fullscreenElement) document.exitFullscreen().catch(()=>{});
  if(back && back.isConnected && back.focus) back.focus({preventScroll:true});
}

function renderModal(){
  const cfg = STATE.config;
  const d = STATE.draft;
  const isEdit = !!STATE.editingId;
  const root = document.getElementById("modalRoot");
  const prevBackdrop = document.getElementById("modalBackdrop");
  const prevScroll = prevBackdrop ? prevBackdrop.scrollTop : 0;
  root.innerHTML = `
  <div class="modal-backdrop" id="modalBackdrop">
    <div class="modal trade-modal" role="dialog" aria-modal="true" aria-label="${isEdit?"Trade bearbeiten":"Trade hinzufügen"}">
      <div class="modal-header-row">
        <div>
          <h2>${isEdit?"Trade bearbeiten":"Trade hinzufügen"}</h2>
          <div class="modal-sub">${AREA_LABEL[d.area]}</div>
        </div>
        <button class="icon-btn" id="modalCloseBtn" title="Schließen" aria-label="Schließen">✕</button>
      </div>

      <!-- Formular links (Karten), Screenshot-Links rechts daneben (auf schmalen Bildschirmen darunter) -->
      <div class="tm-layout">
      <div class="tm-main">

        <section class="tm-card tm-card-accent" aria-label="Trade">
          <div class="tm-card-top">
            <div class="tm-pill">Trade</div>
            <button type="button" class="mentor-toggle${d.mentor ? " on" : ""}" id="f_mentor" aria-pressed="${d.mentor ? "true" : "false"}" title="Von einem Mentor bestätigt oder selbst genommen">
              <span class="mentor-ico" aria-hidden="true">★</span> Mentor-Trade
            </button>
          </div>
          <div class="tm-row3">
            <div class="field-group">
              <label class="fg-label">Datum</label>
              <input type="date" id="f_date" value="${d.date||""}">
            </div>
            <div class="field-group">
              <label class="fg-label">${categoryLabel("session","Session")}</label>
              ${chipGroupHtml("session", cfg.sessions, d.session)}
            </div>
            <div class="field-group">
              <label class="fg-label">${categoryLabel("richtung","Richtung")}</label>
              ${chipGroupHtml("richtung", cfg.directions, d.richtung)}
            </div>
          </div>
          <div class="field-group">
            <label class="fg-label">${categoryLabel("markt","Markt")}</label>
            <div id="marktChipWrap">${chipGroupHtml("markt", cfg.markets, d.markt)}</div>
          </div>
          <div class="field-group">
            <label class="fg-label">${categoryLabel("art","Entry-Art")}</label>
            ${chipGroupHtml("art", cfg.entryTypes, d.art)}
          </div>
        </section>

        <section class="tm-card" aria-label="Setup">
          <div class="tm-grid2">
            <div class="field-group">
              <label class="fg-label">${categoryLabel("level","Level")}</label>
              ${chipGroupHtml("level", cfg.levels, d.level)}
            </div>
            <div class="field-group">
              <label class="fg-label">${categoryLabel("trend","Trend")}</label>
              ${chipGroupHtml("trend", cfg.trend, d.trend)}
            </div>
            <div class="field-group">
              <label class="fg-label">${categoryLabel("zeiteinheit","Zeiteinheit")}</label>
              ${chipGroupHtml("zeiteinheit", cfg.timeframes, d.zeiteinheit)}
            </div>
            ${(cfg.customCategories||[]).map(c=>`
            <div class="field-group">
              <label class="fg-label">${escHtml(c.label)}</label>
              ${chipGroupHtml("custom_"+c.key, cfg["custom_"+c.key]||[], (d.customCategories||{})[c.key], {multi:!!c.multi})}
            </div>`).join("")}
          </div>
          <div class="field-group">
            <label class="fg-label">${categoryLabel("kriterien","Kriterien")}</label>
            ${chipGroupHtml("kriterien", cfg.kriterien, d.kriterien, {multi:true})}
          </div>
          <div class="field-group">
            <label class="fg-label">${categoryLabel("invalidierung","Invalidierungskriterien")}</label>
            ${chipGroupHtml("invalidierung", cfg.invalidierung, d.invalidierung, {multi:true})}
          </div>
        </section>

        <section class="tm-card tm-card-accent" aria-label="Ergebnis">
          <div class="tm-card-title">Ergebnis <span>optional — kann offen bleiben</span></div>
          ${d.area==="eod" ? `
          <div class="tm-grid2">
            <div class="field-group">
              <label class="fg-label">Setup genommen?</label>
              ${chipGroupHtml("genommen", ["Ja","Nein"], d.genommen===true?"Ja":(d.genommen===false?"Nein":null))}
            </div>
            ${d.genommen===false ? `
            <div class="field-group">
              <label class="fg-label">Warum nicht genommen?</label>
              <textarea id="f_grundNichtGenommen" placeholder="z.B. zu spät gesehen, kein sauberes B/C, News im Weg…">${escHtml(d.grundNichtGenommen||"")}</textarea>
            </div>` : ""}
          </div>` : ""}
          <div class="tm-result">
            <div class="field-group">
              <label class="fg-label">SL / TP / BE</label>
              ${chipGroupHtml("ergebnis", cfg.results, d.ergebnis, {resultStyle:true})}
            </div>
            ${d.ergebnis === "BE" ? `
            <div class="field-group">
              <label class="fg-label">R-Ergebnis</label>
              <div class="tm-note">Break-Even wird automatisch als <strong style="color:var(--amber)">0R</strong> gewertet — keine Eingabe nötig.</div>
            </div>` : (d.ergebnis === "TP" || d.ergebnis === "SL") ? `
            <div class="field-group">
              <label class="fg-label">R-Ergebnis (Betrag, z.B. 2 oder 1,5)</label>
              <input type="text" id="f_r" inputmode="decimal" placeholder="z.B. 2,3" value="${escAttr(d._rMagnitudeInput||"")}" class="${d._rError?"has-error":""}">
              ${d._rError ? `<div class="field-error">Bitte eine Zahl eingeben, z. B. 2 oder 1,5.</div>` : ""}
              <div style="color:var(--text-dim); font-size:12px; margin-top:6px;">
                Wird automatisch als ${d.ergebnis==="TP" ? '<span class="pos">+R</span>' : '<span class="neg">-R</span>'} verbucht — Vorzeichen musst du nicht eintippen.
              </div>
            </div>` : `
            <div class="field-group">
              <label class="fg-label">R-Ergebnis</label>
              <div class="tm-note tm-note-faint">Wähle SL, TP oder BE, um das R-Ergebnis einzutragen.</div>
            </div>`}
          </div>
        </section>

        <section class="tm-card" aria-label="Notizen">
          <div class="field-group">
            <label class="fg-label">Notizen</label>
            <textarea id="f_notes" placeholder="Beobachtungen, Kontext, Lessons Learned…">${escHtml(d.notizen||"")}</textarea>
          </div>
        </section>

      </div>

      <aside class="tm-side">
        <section class="tm-card tm-shots-card" aria-label="Screenshots">
          <div class="tm-card-title tm-card-title-lg">Screenshots &amp; TradingView</div>
          ${SHOT_CATEGORIES.map(c=>{
            const arr = (d.screenshots && d.screenshots[c.key]) || [];
            const shortLabel = c.key === "sonstige" ? "Zusätzlich" : c.key.toUpperCase();
            return `
          <div class="field-group tm-shot-group">
            <label class="fg-label">${shortLabel}${arr.length?` <span class="tm-count">${arr.length}</span>`:""}</label>
            <div class="shot-url-row">
              <input type="url" class="shot-url-input" id="f_shoturl_${c.key}" placeholder="TradingView-Link …" title="${escAttr(c.label)}: Link einfügen und Enter drücken">
              <button type="button" class="btn btn-sm" data-add-shot-url="${c.key}">Hinzufügen</button>
            </div>
            ${arr.length ? `
            <div class="tm-shots">
              ${arr.map((src,i)=>`
                <div class="shot-thumb">
                  <img src="${escAttr(src)}" data-editshotref="${c.key}:${i}" title="Zum Vergrößern klicken" alt="${escAttr(shortLabel)}-Screenshot ${i+1} vergrößern" role="button" tabindex="0">
                  <button type="button" class="shot-remove" data-remove-shot-cat="${c.key}" data-remove-shot="${i}" title="Entfernen" aria-label="${escAttr(shortLabel)}-Screenshot ${i+1} entfernen">✕</button>
                </div>
              `).join("")}
            </div>` : ""}
          </div>`;
          }).join("")}
          <div class="shot-url-hint">TradingView-Links (…/x/ID/) werden automatisch in die direkte Bildadresse umgewandelt. Strg+V mit einem Bild in der Zwischenablage funktioniert weiterhin (landet bei HTF).</div>
        </section>
      </aside>
      </div>

      <div class="modal-footer is-sticky">
        <button class="btn btn-ghost" id="modalCancelBtn">Abbrechen</button>
        <button class="btn btn-primary" id="modalSaveBtn">${isEdit?"Speichern":"Trade speichern"}</button>
      </div>
    </div>
  </div>`;

  const newBackdrop = document.getElementById("modalBackdrop");
  if(newBackdrop) newBackdrop.scrollTop = prevScroll;

  wireModal();
}

function wireModal(){
  const backdrop = document.getElementById("modalBackdrop");
  backdrop.addEventListener("click", (e)=>{ if(e.target===backdrop) requestCloseTradeModal(); });
  document.getElementById("modalCloseBtn").addEventListener("click", requestCloseTradeModal);
  document.getElementById("modalCancelBtn").addEventListener("click", requestCloseTradeModal);

  // Mentor-Trade an/aus (nur Klasse umschalten, kein Neuzeichnen des Formulars)
  const mentorBtn = document.getElementById("f_mentor");
  if(mentorBtn) mentorBtn.addEventListener("click", ()=>{
    STATE.draft.mentor = !STATE.draft.mentor;
    mentorBtn.classList.toggle("on", STATE.draft.mentor);
    mentorBtn.setAttribute("aria-pressed", STATE.draft.mentor ? "true" : "false");
  });

  // chip clicks (single + multi select)
  document.querySelectorAll("[data-chipgroup]").forEach(group=>{
    group.addEventListener("click", (e)=>{
      const btn = e.target.closest("button[data-group]");
      if(!btn) return;
      const g = btn.dataset.group;
      const val = btn.dataset.value;
      const multi = btn.dataset.multi === "true";
      const d = STATE.draft;
      if(g==="genommen"){
        d.genommen = (val==="Ja");
        renderModal();
        return;
      }
      // Frei erstellte Kategorien nutzen das Präfix "custom_" im Gruppennamen und werden
      // in d.customCategories[key] statt direkt in d[key] gespeichert.
      const isCustom = g.startsWith("custom_");
      const customKey = isCustom ? g.slice(7) : null;
      if(isCustom && !d.customCategories) d.customCategories = {};
      const target = isCustom ? d.customCategories : d;
      const targetKey = isCustom ? customKey : g;
      if(multi){
        const arr = target[targetKey] || (target[targetKey]=[]);
        const i = arr.indexOf(val);
        if(i>-1) arr.splice(i,1); else arr.push(val);
      }else{
        target[targetKey] = (target[targetKey]===val) ? null : val;
      }
      if(g === "ergebnis"){
        if(d.ergebnis === "BE"){
          d.r = 0;
          d._rMagnitudeInput = "";
        }else if(d.ergebnis === "TP" || d.ergebnis === "SL"){
          // Vorzeichen an neues Ergebnis anpassen, falls bereits ein Betrag eingetragen war
          if(d.r !== null && d.r !== undefined){
            const mag = Math.abs(d.r);
            d.r = d.ergebnis === "TP" ? mag : -mag;
            d._rMagnitudeInput = String(mag).replace(".", ",");
          }
        }else{
          // Ergebnis abgewählt -> R zurücksetzen (Trade gilt wieder als offen)
          d.r = null;
          d._rMagnitudeInput = "";
        }
        renderModal(); // Ergebnis ändert den Formularaufbau (R-Feld) → komplett neu
        return;
      }
      // GEÄNDERT (Stufe 4): Alle anderen Gruppen ändern nur ihre eigene Auswahl — statt das
      // ganze Formular (inkl. aller Screenshot-Vorschauen) neu aufzubauen, werden nur die
      // Buttons dieser Gruppe umgeschaltet. Fokus und Scrollposition bleiben dadurch erhalten.
      syncChipGroup(group, target[targetKey], multi);
    });
  });

  // Drei Dropzones (HTF/LTF/Zusätzlich). Bei Klick/Fokus/Dragover einer Zone merkt sich
  // das Draft, welche Kategorie gerade "aktiv" ist — dahin geht dann auch ein Strg+V-Paste,
  // weil das Paste-Event global auf document hängt und sonst nicht wüsste, welche Zone gemeint ist.
  let firstDropzoneEl = null;
  SHOT_CATEGORIES.forEach(c=>{
    const input = document.getElementById("f_shot_"+c.key);
    if(input){
      input.addEventListener("change", (e)=>{
        const files = Array.from(e.target.files || []);
        if(files.length) handleImageFiles(files, c.key);
        input.value = ""; // erlaubt erneutes Auswählen derselben Datei später
      });
    }

    // Link-Felder zuerst verdrahten — die Einfüge-Zonen gibt es im Formular nicht mehr,
    // der Rest der Schleife bricht deshalb unten ab.
    // Bild per URL hinzufügen (z.B. TradingView-Snapshot-Link) — direkt als Vorschau
    // in die Galerie übernehmen, ganz ohne Datei-Upload.
    const urlInput = document.getElementById("f_shoturl_"+c.key);
    const urlBtn = document.querySelector('[data-add-shot-url="'+c.key+'"]');
    const addShotUrl = ()=>{
      const url = (urlInput.value||"").trim();
      if(!url) return;
      STATE.draft._activeShotCategory = c.key;
      addShotFromUrl(url, c.key);
    };
    if(urlBtn) urlBtn.addEventListener("click", addShotUrl);
    if(urlInput) urlInput.addEventListener("keydown", (e)=>{
      if(e.key === "Enter"){ e.preventDefault(); addShotUrl(); }
    });

    const dropzone = document.getElementById("shotDropzone_"+c.key);
    if(!dropzone) return;
    if(!firstDropzoneEl) firstDropzoneEl = dropzone;
    dropzone.addEventListener("click", (e)=>{
      if(e.target.closest(".shot-filelabel")) return;
      STATE.draft._activeShotCategory = c.key;
      dropzone.focus({preventScroll:true});
    });
    dropzone.addEventListener("focus", ()=>{ STATE.draft._activeShotCategory = c.key; });
    dropzone.addEventListener("dragover", (e)=>{ e.preventDefault(); dropzone.classList.add("dragover"); STATE.draft._activeShotCategory = c.key; });
    dropzone.addEventListener("dragleave", ()=> dropzone.classList.remove("dragover"));
    dropzone.addEventListener("drop", (e)=>{
      e.preventDefault();
      dropzone.classList.remove("dragover");
      const files = Array.from(e.dataTransfer.files || []).filter(f=>f.type.startsWith("image/"));
      if(files.length) handleImageFiles(files, c.key);
    });

  });
  // Nur beim allerersten Öffnen des Formulars die erste Dropzone (HTF) fokussieren
  // (nicht bei jedem Re-Render durch Chip-Klicks — das verursachte den Sprung ans Formularende).
  if(STATE.modalFreshOpen){
    STATE.draft._activeShotCategory = STATE.draft._activeShotCategory || SHOT_CATEGORIES[0].key;
    if(firstDropzoneEl) setTimeout(()=> firstDropzoneEl.focus({preventScroll:true}), 50);
    STATE.modalFreshOpen = false;
  }

  // Einfügen per Strg+V funktioniert überall im Modal (das Paste-Event bubbelt zu document),
  // landet in der zuletzt aktiven Kategorie (siehe oben).
  document.addEventListener("paste", handlePasteEvent);

  document.querySelectorAll("[data-remove-shot]").forEach(btn=>{
    btn.addEventListener("click", (e)=>{
      e.stopPropagation();
      const cat = btn.dataset.removeShotCat;
      const i = parseInt(btn.dataset.removeShot, 10);
      STATE.draft.screenshots[cat].splice(i, 1);
      renderModal();
    });
  });

  // Klick auf ein Vorschaubild vergrößert es (gleiche Lightbox wie in der Ansicht),
  // unabhängig vom "Entfernen"-Button daneben.
  document.querySelectorAll("[data-editshotref]").forEach(img=>{
    img.addEventListener("click", ()=>{
      const [cat, idxStr] = img.dataset.editshotref.split(":");
      const arr = (STATE.draft.screenshots && STATE.draft.screenshots[cat]) || [];
      openLightbox(arr[parseInt(idxStr, 10)]);
    });
  });

  // Datum, Notizen und R-Betrag sofort ins Draft-Objekt übernehmen, statt erst beim
  // Speichern zu lesen — sonst gingen Eingaben beim nächsten Chip-Klick (voller Re-Render) verloren.
  const dateInput = document.getElementById("f_date");
  if(dateInput) dateInput.addEventListener("input", (e)=>{ STATE.draft.date = e.target.value; });

  const notesInput = document.getElementById("f_notes");
  if(notesInput) notesInput.addEventListener("input", (e)=>{ STATE.draft.notizen = e.target.value; });

  const grundInput = document.getElementById("f_grundNichtGenommen");
  if(grundInput) grundInput.addEventListener("input", (e)=>{ STATE.draft.grundNichtGenommen = e.target.value; });

  const rInput = document.getElementById("f_r");
  if(rInput) rInput.addEventListener("input", (e)=>{
    STATE.draft._rMagnitudeInput = e.target.value;
    if(STATE.draft._rError){
      STATE.draft._rError = false;
      rInput.classList.remove("has-error");
      const err = rInput.parentElement.querySelector(".field-error");
      if(err) err.remove();
    }
  });
  if(rInput) rInput.addEventListener("keydown", (e)=>{ if(e.key === "Enter"){ e.preventDefault(); saveDraft(); } });

  document.getElementById("modalSaveBtn").addEventListener("click", saveDraft);
}

function handlePasteEvent(e){
  if(!STATE.draft) return;
  const items = (e.clipboardData && e.clipboardData.items) || [];
  const files = [];
  for(const item of items){
    if(item.type && item.type.startsWith("image/")){
      const file = item.getAsFile();
      if(file) files.push(file);
    }
  }
  if(files.length){
    e.preventDefault();
    handleImageFiles(files, STATE.draft._activeShotCategory || SHOT_CATEGORIES[0].key);
  }
}

/* Bereinigt eine eingefügte Bild-Adresse.
   Wichtigster Fall: Ein TradingView-Snapshot-Link der Form
   https://www.tradingview.com/x/KJFFRVLL/ ist KEINE Bilddatei, sondern eine
   Webseite mit dem Bild darauf — als <img src> eingetragen bliebe die Kachel leer.
   Die direkte Bildadresse lautet
   https://s3.tradingview.com/snapshots/<erster Buchstabe der ID, klein>/<ID>.png
   Genau das wird hier automatisch umgeschrieben, damit man einfach den Link
   einfügen kann, den TradingView beim Teilen anbietet. */
function normalizeShotUrl(url){
  let u = String(url || "").trim();
  if(!u) return "";
  const m = u.match(/tradingview\.com\/x\/([A-Za-z0-9]+)/);
  if(m){
    const id = m[1];
    return "https://s3.tradingview.com/snapshots/" + id.charAt(0).toLowerCase() + "/" + id + ".png";
  }
  return u;
}

// Hängt einen per URL eingefügten Screenshot (z.B. TradingView-Snapshot-Link) direkt als
// Bild-Vorschau an die Screenshot-Liste der übergebenen Kategorie an. Die URL wird direkt
// als src gespeichert (kein Download/Umwandeln nötig) — funktioniert mit jedem direkt
// verlinkbaren Bild (z.B. "Bildadresse kopieren" auf einem TradingView-Snapshot).
function addShotFromUrl(url, category){
  const clean = normalizeShotUrl(url);
  if(!clean) return;
  const cat = category || SHOT_CATEGORIES[0].key;
  if(!STATE.draft.screenshots) STATE.draft.screenshots = { htf:[], ltf:[], sonstige:[] };
  if(!Array.isArray(STATE.draft.screenshots[cat])) STATE.draft.screenshots[cat] = [];
  STATE.draft.screenshots[cat].push(clean);
  renderModal();
}

// Dasselbe für Erkenntnisse (dort gibt es nur eine Screenshot-Liste ohne Kategorien).
function addInsightShotFromUrl(url){
  const clean = normalizeShotUrl(url);
  if(!clean) return;
  if(!Array.isArray(STATE.insightDraft.screenshots)) STATE.insightDraft.screenshots = [];
  STATE.insightDraft.screenshots.push(clean);
  renderInsightModal();
}

/* Bremse vor dem Hochladen: Ein eingebettetes Bild kostet rund 70-150 KB vom
   5-MB-Kontingent, ein Link dagegen etwa 80 Byte. Ist der Speicher schon stark
   gefüllt, wird einmal pro Sitzung nachgefragt, statt den Nutzer später vom
   "Speicher voll"-Hinweis überraschen zu lassen. */
const STORAGE_WARN_PERCENT = 80;
let storageWarnAccepted = false; // einmal bewusst bestätigt -> in dieser Sitzung nicht mehr fragen

async function confirmImageUpload(){
  if(storageWarnAccepted) return true;
  let st;
  try{ st = storageStats(); }catch(e){ return true; }
  if(st.percent < STORAGE_WARN_PERCENT) return true;
  const ok = await uiConfirm(
    "Der lokale Speicher ist zu " + st.percent + " % belegt (" + formatBytes(st.usedBytes) +
    " von ca. " + formatBytes(LS_LIMIT_BYTES) + "). " +
    (st.shotsLeft <= 0
      ? "Vermutlich passt kein weiteres Bild mehr hinein."
      : "Es passen noch etwa " + st.shotsLeft + " hochgeladene Bild" + (st.shotsLeft===1?"":"er") + " hinein.") +
    "\n\nEin per Link eingebundener Screenshot braucht dagegen fast " +
    "keinen Speicher — das Feld dafür ist direkt unter dem Einfügebereich. TradingView-Links " +
    "werden automatisch umgewandelt.",
    { title:"Speicher fast voll", okText:"Trotzdem hochladen", cancelText:"Abbrechen", danger:true }
  );
  if(ok) storageWarnAccepted = true;
  return ok;
}

// Verarbeitet mehrere Bilder (Datei-Auswahl, Drag&Drop oder Paste) und hängt sie an die
// Screenshot-Liste der übergebenen Kategorie (htf/ltf/sonstige) an.
async function handleImageFiles(files, category){
  if(!(await confirmImageUpload())) return;
  const cat = category || SHOT_CATEGORIES[0].key;
  if(!STATE.draft.screenshots) STATE.draft.screenshots = { htf:[], ltf:[], sonstige:[] };
  if(!Array.isArray(STATE.draft.screenshots[cat])) STATE.draft.screenshots[cat] = [];
  let remaining = files.length;
  files.forEach(file=>{
    const reader = new FileReader();
    reader.onload = (ev)=>{
      const img = new Image();
      img.onload = ()=>{
        const maxW = 900;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width*scale;
        canvas.height = img.height*scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        STATE.draft.screenshots[cat].push(canvas.toDataURL("image/jpeg", 0.72));
        remaining--;
        if(remaining===0) renderModal();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function saveDraft(){
  const d = STATE.draft;
  d.date = document.getElementById("f_date").value || d.date;
  d.notizen = document.getElementById("f_notes").value;
  const grundInput = document.getElementById("f_grundNichtGenommen");
  if(grundInput) d.grundNichtGenommen = grundInput.value;
  if(d.genommen !== false) d.grundNichtGenommen = ""; // nur relevant, wenn nicht genommen

  if(d.ergebnis === "BE"){
    d.r = 0;
  }else if(d.ergebnis === "TP" || d.ergebnis === "SL"){
    const rInput = document.getElementById("f_r");
    const rRaw = rInput ? rInput.value.trim() : "";
    if(rRaw===""){
      d.r = null;
    }else{
      // Nur echte Zahlen akzeptieren — vorher wurde z. B. "2x" still als "kein R"
      // gespeichert und der Trade tauchte ohne Meldung als offen auf.
      const normalized = rRaw.replace(",", ".");
      const magnitude = Math.abs(Number(normalized));
      if(!/^[+-]?\d*\.?\d+$/.test(normalized) || isNaN(magnitude)){
        d._rError = true;
        d._rMagnitudeInput = rRaw;
        renderModal();
        const el = document.getElementById("f_r");
        if(el){ el.focus(); el.scrollIntoView({ block:"center" }); }
        return;
      }
      d.r = d.ergebnis === "TP" ? magnitude : -magnitude;
    }
  }else{
    d.r = null;
  }
  delete d._rMagnitudeInput; // nur ein UI-Hilfsfeld, nicht mit abspeichern
  delete d._rError;
  d.updatedAt = Date.now();

  const idx = STATE.trades.findIndex(t=>t.id===d.id);
  if(idx>-1) STATE.trades[idx] = d; else STATE.trades.push(d);
  saveTrades();
  closeModal();
  render();
  toast("Trade gespeichert.");
}

