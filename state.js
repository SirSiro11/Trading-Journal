/* state.js — Zentraler Zustand STATE, Dialoge, Navigation, Kategorien-Verwaltung, render() */
/* =========================================================================
   STATE
   ========================================================================= */
const STATE = {
  view: "start",
  trades: loadTrades(),
  config: loadConfig(),
  insights: loadInsights(),
  dayConfirmations: loadDayConfirmations(),
  editingId: null,
  editingArea: "live",
  draft: null,
  modalFreshOpen: false,
  viewingTrade: null,
  insightDraft: null,
  insightEditingId: null,
  insightSearchQuery: "",
  // Standard: nur Live — EOD-Zahlen mit Live in eine Kennzahl zu mischen ist
  // analytisch selten sinnvoll; beide lassen sich weiterhin per Klick dazuschalten.
  // Alle Bericht-Einstellungen werden gemerkt (siehe loadBerichtUi/saveBerichtUi) und
  // überleben damit ein Neuladen — vorher waren nach jedem Reload alle Filter weg.
  berichtAreas: { live:true, eod:false },
  berichtFilters: {}, // { markets:[], directions:[], ... }
  berichtDateFrom: "",
  berichtDateTo: "",
  breakdownDim: "markt",
  berichtFiltersExpanded: false, // eingeklappt starten, damit die Kennzahlen sofort sichtbar sind
  berichtCompareMode: "gesamt", // "gesamt" | "vergleich" (nur bei Live+EOD gleichzeitig aktiv)
  notesSearchQuery: "",
  // Datums-Unterkategorien pro Bereich: "alles" | "monat" | "woche" | "heute"
  areaDateFilter: { live:"alles", eod:"alles" },
  // Schnellsuche in der Live-/EOD-Liste (reiner Anzeige-Filter)
  areaSearch: { live:"", eod:"" },
  areaMentorOnly: { live:false, eod:false }, // Schnellfilter "nur Mentor-Trades" in Live/EOD
  // per Kalender-Klick ausgewählter Einzeltag pro Bereich (überschreibt areaDateFilter)
  areaSelectedDay: { live:null, eod:null },
  // welcher Monat im Kalender pro Bereich gerade angezeigt wird
  areaCalendarMonth: { live: currentYM(), eod: currentYM() },
  // Markt-Filter des Kalenders pro Bereich (leer = alle Märkte)
  areaCalendarMarkets: { live: [], eod: [] },
  eodReasonsExpanded: false,
  eodReasonsQuery: "",
  hiddenNoteWordsExpanded: false,
  hiddenInsightWordsExpanded: false,
  noteWordMenuOpen: false,
  insightWordMenuOpen: false,
  noteMergeMode: false,
  noteMergeSelection: [],
  insightMergeMode: false,
  insightMergeSelection: [],
  driveStatus: "syncing", // syncing|connected|error|conflict — kein "disconnected" mehr nötig, Proxy ist immer bereit
  driveConflictRemote: null, // bei "conflict": der neuere Cloud-Stand, zur Übernahme per Klick
  driveLastSyncAt: null,
  news: loadNews(),           // importierte High-Impact-News (siehe NEWS)
  newsView: loadNewsView(),   // "heute" | "woche"
  driveError: ""
};

// Gemerkte Bericht-Einstellungen wiederherstellen (reine UI-Präferenz, kein Datenbestand —
// daher ohne markDataChanged und ohne Cloud-Sync).
function loadBerichtUi(){
  try{
    const u = JSON.parse(localStorage.getItem(LS_BERICHT_UI));
    if(!u || typeof u !== "object") return;
    if(u.berichtAreas && typeof u.berichtAreas === "object") STATE.berichtAreas = Object.assign({ live:true, eod:false }, u.berichtAreas);
    if(u.berichtFilters && typeof u.berichtFilters === "object") STATE.berichtFilters = u.berichtFilters;
    if(typeof u.berichtDateFrom === "string") STATE.berichtDateFrom = u.berichtDateFrom;
    if(typeof u.berichtDateTo === "string") STATE.berichtDateTo = u.berichtDateTo;
    if(typeof u.breakdownDim === "string") STATE.breakdownDim = u.breakdownDim;
    if(typeof u.berichtFiltersExpanded === "boolean") STATE.berichtFiltersExpanded = u.berichtFiltersExpanded;
    if(u.berichtCompareMode === "gesamt" || u.berichtCompareMode === "vergleich") STATE.berichtCompareMode = u.berichtCompareMode;
  }catch(e){}
}
function saveBerichtUi(){
  try{
    localStorage.setItem(LS_BERICHT_UI, JSON.stringify({
      berichtAreas: STATE.berichtAreas, berichtFilters: STATE.berichtFilters,
      berichtDateFrom: STATE.berichtDateFrom, berichtDateTo: STATE.berichtDateTo,
      breakdownDim: STATE.breakdownDim, berichtFiltersExpanded: STATE.berichtFiltersExpanded,
      berichtCompareMode: STATE.berichtCompareMode
    }));
  }catch(e){}
}
loadBerichtUi();

// Demo-Trades nur einfügen, wenn wirklich noch nichts gespeichert ist (erster Start).
// WICHTIG: bewusst NICHT über saveTrades(), da das markDataChanged() auslösen und damit
// den "letzte Änderung"-Zeitstempel setzen würde — dann würde ein frisches Gerät beim
// ersten Öffnen fälschlich wie "gerade neu geändert" aussehen und beim Google-Drive-Sync
// die eigenen (bedeutungslosen) Demo-Daten für neuer als die echten Cloud-Daten halten und
// diese überschreiben, statt sie korrekt herunterzuladen.
if(STATE.trades.length === 0){
  STATE.trades = buildDemoTrades();
  persistLocalData();
}

// Einmalige Umstellung auf den gemeinsamen Bild-Speicher: solange in tj_trades_v1
// oder tj_insights_v1 noch rohe Bilddaten stehen, wird einmal neu geschrieben —
// danach liegt jedes Bild nur noch einmal im Speicher. Bewusst OHNE markDataChanged,
// weil sich inhaltlich nichts ändert und sonst ein unnötiger Drive-Push liefe.
/* Der Backtest-Bereich wurde aus dem Journal entfernt (Version 2026.09.04).
   Vorhandene Backtest-Einträge werden einmalig gelöscht — sonst blieben sie
   unsichtbar im Speicher liegen und würden über den Drive-Sync auf jedem Gerät
   wieder auftauchen. Bewusst über den normalen Speicherweg samt markDataChanged,
   damit die Löschung auch in die Cloud und auf die anderen Geräte wandert. */
/* Angleichung an die Strategie (Version 2026.09.05):
   - "Kriterien" enthielt bisher nur die beiden LQ-Werte. Stattdessen stehen jetzt
     die sechs Zonen-Kriterien zur Auswahl (Mehrfachauswahl wie bisher).
     Alte Werte werden nur dann behalten, wenn noch ein Trade sie verwendet —
     sonst verschwänden sie aus der Liste, blieben aber im Trade stehen.
   - Neues Feld "Risiko %" (1 % / 0,5 %). Es wird als frei erstellte Kategorie
     angelegt, weil dieser Mechanismus bereits überall greift: Formular, Listen,
     Detailseite, Bericht-Filter und Aufschlüsselung, Umbenennen und Löschen.
     Du kannst es also im Kategorien-Bereich umbenennen, erweitern oder entfernen.
   Läuft genau einmal (Merker in der Konfiguration). */
function migrateStrategyCategories(){
  try{
    const cfg = STATE.config;
    // "Struktur" ist entfernt — Werteliste und ggf. umbenannte Überschrift mit
    // aufräumen. Bewusst bei JEDEM Aufruf, weil ein Cloud-Stand von einem alten
    // Gerät die Liste sonst wieder mitbringt.
    if(cfg.struktur || (cfg.categoryLabelOverrides && cfg.categoryLabelOverrides.struktur)){
      delete cfg.struktur;
      if(cfg.categoryLabelOverrides) delete cfg.categoryLabelOverrides.struktur;
      saveConfig();
    }
    if(cfg.strategieKategorienV1) return;
    let changed = false;

    const ZONEN_KRITERIEN = ["BOS/ChoCh","IMB","EZ/IND","LQs","GB","LQ-Ziel"];
    const inUse = new Set();
    STATE.trades.forEach(t=> (t.kriterien||[]).forEach(v=> inUse.add(v)));
    const alteWerte = (cfg.kriterien||[]).filter(v=> !ZONEN_KRITERIEN.includes(v) && inUse.has(v));
    const neueListe = ZONEN_KRITERIEN.concat(alteWerte);
    if(JSON.stringify(neueListe) !== JSON.stringify(cfg.kriterien)){ cfg.kriterien = neueListe; changed = true; }

    cfg.customCategories = cfg.customCategories || [];
    if(!cfg.customCategories.some(c=> c.key === "risiko")){
      cfg.customCategories.push({ key:"risiko", label:"Risiko %", multi:false });
      changed = true;
    }
    if(!Array.isArray(cfg.custom_risiko) || !cfg.custom_risiko.length){
      cfg.custom_risiko = ["1 %","0,5 %"];
      changed = true;
    }

    cfg.strategieKategorienV1 = true;
    if(changed) saveConfig(); else safeSetItem(LS_CONFIG, JSON.stringify(cfg));
  }catch(e){}
}
migrateStrategyCategories();

(function cleanUpRemovedFeatures(){
  try{
    const removed = backtestRemovedCount;
    if(!removed && !strukturRemovedCount) return;
    // Einmal neu speichern, damit die Bereinigung wirklich auf der Platte landet
    // und über den Sync auch auf den anderen Geräten ankommt.
    saveTrades();
    if(removed) setTimeout(()=> toast("Der Backtest-Bereich wurde entfernt — " + removed + " Backtest-" + (removed===1?"Eintrag":"Einträge") + " gelöscht.", null, null, 9000), 800);
  }catch(e){}
})();

(function migrateShotStore(){
  try{
    const raw = (localStorage.getItem(LS_TRADES) || "") + (localStorage.getItem(LS_INSIGHTS) || "");
    if(raw.indexOf("data:") === -1) return;
    persistLocalData();
  }catch(e){}
})();

function currentYM(){
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() };
}

function todayISO(){
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
}

function startOfWeek(d){
  // Woche startet Montag
  const day = (d.getDay()+6)%7; // Mo=0 ... So=6
  const monday = new Date(d);
  monday.setDate(d.getDate()-day);
  monday.setHours(0,0,0,0);
  return monday;
}

function dateMatchesFilter(dateStr, filter){
  if(filter==="alles" || !filter) return true;
  if(!dateStr) return false;
  if(filter==="heute") return dateStr === todayISO();
  const d = new Date(dateStr+"T00:00:00");
  const today = new Date(); today.setHours(0,0,0,0);
  if(filter==="woche"){
    const mon = startOfWeek(today);
    const sun = new Date(mon); sun.setDate(mon.getDate()+6); sun.setHours(23,59,59,999);
    return d >= mon && d <= sun;
  }
  if(filter==="monat"){
    return d.getFullYear()===today.getFullYear() && d.getMonth()===today.getMonth();
  }
  return true;
}

function uid(){
  if(window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Math.random().toString(36).slice(2) + Date.now();
}

function toast(msg, undoLabel, undoFn, durationMs){
  const root = document.getElementById("toastRoot");
  const el = document.createElement("div");
  el.className = "toast";
  const text = document.createElement("span");
  text.textContent = msg;
  el.appendChild(text);
  if(undoLabel && undoFn){
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "toast-undo";
    btn.textContent = undoLabel;
    btn.addEventListener("click", ()=>{ undoFn(); el.remove(); });
    el.appendChild(btn);
  }
  root.innerHTML = "";
  root.appendChild(el);
  setTimeout(()=>{ el.remove(); }, durationMs || (undoFn ? 5000 : 2400));
}

/* =========================================================================
   DIALOGE — Ersatz für prompt()/confirm()/alert()
   Liefern ein Promise: uiConfirm -> true/false, uiPrompt -> String oder null
   (Abbrechen). Enter bestätigt, Escape bricht ab, Klick auf den Hintergrund ebenfalls.
   ========================================================================= */
function uiDialog(opts){
  return new Promise(resolve=>{
    const root = document.getElementById("dialogRoot");
    const hasInput = opts.input !== undefined;
    const returnFocus = document.activeElement; // GEÄNDERT: Fokus nach dem Schließen zurückgeben
    root.innerHTML = `
      <div class="dialog-backdrop" id="uiDialogBackdrop">
        <div class="dialog" role="dialog" aria-modal="true" tabindex="-1" ${opts.title ? `aria-labelledby="uiDialogTitle"` : ""} ${opts.text ? `aria-describedby="uiDialogText"` : ""}>
          ${opts.title ? `<h3 id="uiDialogTitle">${escHtml(opts.title)}</h3>` : ""}
          ${opts.text ? `<p id="uiDialogText">${escHtml(opts.text)}</p>` : ""}
          ${hasInput ? `<input type="text" id="uiDialogInput" value="${escAttr(opts.input||"")}" placeholder="${escAttr(opts.placeholder||"")}" autocomplete="off" aria-label="${escAttr(opts.title||opts.text||"Eingabe")}">` : ""}
          ${opts.checkbox ? `<label class="dialog-check"><input type="checkbox" id="uiDialogCheck" ${opts.checkboxDefault?"checked":""}> ${escHtml(opts.checkbox)}</label>` : ""}
          <div class="dialog-actions">
            <button type="button" class="btn btn-ghost" id="uiDialogCancel">${escHtml(opts.cancelText||"Abbrechen")}</button>
            <button type="button" class="btn ${opts.danger?"btn-danger":"btn-primary"}" id="uiDialogOk">${escHtml(opts.okText||"OK")}</button>
          </div>
        </div>
      </div>`;
    const backdrop = document.getElementById("uiDialogBackdrop");
    const input = document.getElementById("uiDialogInput");
    const check = document.getElementById("uiDialogCheck");
    const finish = (ok)=>{
      document.removeEventListener("keydown", onKey);
      root.innerHTML = "";
      if(returnFocus && returnFocus.isConnected && returnFocus.focus) returnFocus.focus({preventScroll:true});
      if(!ok) return resolve(null);
      resolve({ value: input ? input.value : "", checked: check ? check.checked : false });
    };
    const onKey = (e)=>{
      if(e.key === "Escape"){ e.preventDefault(); finish(false); }
      else if(e.key === "Enter" && (!input || document.activeElement === input)){ e.preventDefault(); finish(true); }
    };
    document.addEventListener("keydown", onKey);
    backdrop.addEventListener("click", (e)=>{ if(e.target === backdrop) finish(false); });
    document.getElementById("uiDialogCancel").addEventListener("click", ()=> finish(false));
    document.getElementById("uiDialogOk").addEventListener("click", ()=> finish(true));
    setTimeout(()=>{ if(input){ input.focus(); input.select(); } else document.getElementById("uiDialogOk").focus(); }, 30);
  });
}
async function uiConfirm(text, opts){
  opts = opts || {};
  const r = await uiDialog({ title: opts.title, text, okText: opts.okText || "Ja", cancelText: opts.cancelText || "Abbrechen", danger: !!opts.danger });
  return !!r;
}
async function uiPrompt(text, defaultValue, opts){
  opts = opts || {};
  const r = await uiDialog({ title: opts.title, text, input: defaultValue || "", placeholder: opts.placeholder, okText: opts.okText || "Übernehmen" });
  return r ? r.value : null;
}
function uiAlert(text, opts){
  opts = opts || {};
  return uiDialog({ title: opts.title, text, okText: "OK", cancelText: "Schließen" });
}

/* =========================================================================
   NAV
   ========================================================================= */
document.getElementById("mainNav").addEventListener("click", (e)=>{
  const btn = e.target.closest("button[data-view]");
  if(!btn) return;
  STATE.view = btn.dataset.view;
  STATE.viewingTrade = null; // GEÄNDERT: Reiterwechsel schließt eine offene Trade-Detailansicht
  render();
});

document.getElementById("btnSettings").addEventListener("click", openSettingsModal);

document.getElementById("backupBadge").addEventListener("click", ()=>{
  STATE.view = "bericht";
  STATE.viewingTrade = null; // GEÄNDERT: auch hier eine offene Trade-Detailansicht schließen
  render();
});

function updateNavActive(){
  document.querySelectorAll("#mainNav button").forEach(b=>{
    const isActive = b.dataset.view === STATE.view;
    b.classList.toggle("active", isActive);
    // GEÄNDERT: aktiver Reiter auch für Screenreader erkennbar
    if(isActive) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
}

// Badge im Header ein-/ausblenden — läuft bei jedem render(), damit er auf allen
// Reitern aktuell ist, nicht nur im Bericht (wo die Export-Buttons selbst liegen).
function updateBackupBadge(){
  const badge = document.getElementById("backupBadge");
  if(!badge) return;
  badge.classList.toggle("show", hasUnbackedChanges());
}

/* =========================================================================
   KATEGORIEN VERWALTEN  —  Werte für alle Auswahl-Kategorien
   zentral hinzufügen / entfernen (wirkt auf CONFIG, sofort gespeichert).
   ========================================================================= */
function openSettingsModal(){
  renderSettingsModal();
}

// Erzeugt aus einem Label einen eindeutigen, technischen Schlüssel für eine neue
// frei erstellte Kategorie (z. B. "Markt-Phase" -> "markt_phase").
function slugifyCategoryKey(label){
  let base = label.trim().toLowerCase()
    .replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/ß/g,"ss")
    .replace(/[^a-z0-9]+/g,"_")
    .replace(/^_+|_+$/g,"");
  if(!base) base = "kategorie";
  const existing = (STATE.config.customCategories||[]).map(c=>c.key);
  let key = base, i = 2;
  while(existing.includes(key)){ key = base + "_" + i; i++; }
  return key;
}

function renderSettingsModal(){
  const cfg = STATE.config;
  const allMeta = [
    ...CATEGORY_META.map(m=>({ ...m, label: categoryLabel(m.field, m.label) })),
    ...(cfg.customCategories||[]).map(c=>({ cfgKey:"custom_"+c.key, field:null, label:c.label, multi:c.multi, isCustom:true, customKey:c.key }))
  ];
  const sections = allMeta.map(meta=>{
    const items = cfg[meta.cfgKey] || [];
    const chips = items.map(v=>`
      <span class="market-chip-wrap">
        <span class="chip market-chip-label" style="cursor:default;">${escHtml(v)}</span>
        <button type="button" class="market-chip-edit" data-cat="${meta.cfgKey}" data-catfield="${meta.field||""}" data-catmulti="${meta.multi}" data-catlabel="${escAttr(meta.label)}" data-value="${escAttr(v)}" ${meta.isCustom?`data-customkey="${meta.customKey}"`:""} title="Umbenennen">✎</button>
        <button type="button" class="market-chip-remove" data-cat="${meta.cfgKey}" data-catfield="${meta.field||""}" data-catmulti="${meta.multi}" data-value="${escAttr(v)}" ${meta.isCustom?`data-customkey="${meta.customKey}"`:""} title="Entfernen">✕</button>
      </span>`).join("");
    return `<div class="field-group">
      <label class="fg-label" style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <span style="display:inline-flex; align-items:center; gap:6px;">
          ${escHtml(meta.label)}${meta.isCustom ? ` <span style="color:var(--text-faint); font-weight:400; text-transform:none; letter-spacing:0; font-size:11px;">(eigene Kategorie${meta.multi?", Mehrfachauswahl":""})</span>` : ""}
          <button type="button" class="market-chip-edit" style="position:static; opacity:.55;" data-editcatname="${meta.isCustom?meta.customKey:meta.field}" data-iscustomcat="${!!meta.isCustom}" data-currentlabel="${escAttr(meta.label)}" title="Kategorie-Überschrift umbenennen">✎</button>
        </span>
        ${meta.isCustom ? `<button type="button" class="btn btn-sm btn-danger" data-delcustomcat="${meta.customKey}" data-catlabel="${escAttr(meta.label)}" style="text-transform:none; letter-spacing:0;">Kategorie löschen</button>` : ""}
      </label>
      <div class="chip-group">
        ${chips}
        <button type="button" class="chip chip-add" data-addcat="${meta.cfgKey}" data-catlabel="${escAttr(meta.label)}">+ hinzufügen</button>
      </div>
    </div>`;
  }).join("");

  document.getElementById("modalRoot").innerHTML = `
  <div class="modal-backdrop" id="settingsBackdrop">
    <div class="modal">
      <div class="modal-header-row">
        <div>
          <h2>Kategorien verwalten</h2>
          <div class="modal-sub">Werte hinzufügen, umbenennen (✎) oder entfernen (✕) — wirkt sich sofort auf alle Formulare und Filter aus. Umbenennen aktualisiert automatisch auch alle bestehenden Trades.</div>
        </div>
        <button type="button" class="icon-btn" id="settingsCloseBtn" title="Schließen" aria-label="Schließen">✕</button>
      </div>
      ${sections}
      <div class="field-group" style="border-top:1px solid var(--border); padding-top:18px; margin-top:6px;">
        <button type="button" class="btn" id="addNewCategoryBtn">+ Neue Kategorie erstellen</button>
      </div>
      <div class="modal-footer" style="justify-content:flex-end;">
        <button class="btn btn-primary" id="settingsDoneBtn">Fertig</button>
      </div>
    </div>
  </div>`;

  wireSettingsModal();
}

function wireSettingsModal(){
  const backdrop = document.getElementById("settingsBackdrop");
  backdrop.addEventListener("click",(e)=>{ if(e.target===backdrop) closeSettingsModal(); });
  document.getElementById("settingsCloseBtn").addEventListener("click", closeSettingsModal);
  document.getElementById("settingsDoneBtn").addEventListener("click", closeSettingsModal);

  document.getElementById("addNewCategoryBtn").addEventListener("click", async ()=>{
    const r = await uiDialog({ title:"Neue Kategorie erstellen", text:"Erscheint automatisch im Formular, in den Übersichten und im Bericht.", input:"", placeholder:'z. B. "Marktphase"', checkbox:"Mehrfachauswahl möglich (wie bei Kriterien)", okText:"Erstellen" });
    if(!r) return;
    const label = r.value.trim();
    if(!label) return;
    const multi = r.checked;
    const key = slugifyCategoryKey(label);
    STATE.config.customCategories = STATE.config.customCategories || [];
    STATE.config.customCategories.push({ key, label, multi });
    STATE.config["custom_"+key] = [];
    saveConfig();
    renderSettingsModal();
  });

  // Kategorie-Überschrift selbst umbenennen (nicht die Werte darin) — funktioniert
  // sowohl für die fest eingebauten Kategorien (Richtung, Session, ...) als auch für
  // frei erstellte. Wirkt sich sofort auf Formular, Übersicht und Detailseite aus.
  document.querySelectorAll("[data-editcatname]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const key = btn.dataset.editcatname;
      const isCustom = btn.dataset.iscustomcat === "true";
      const current = btn.dataset.currentlabel;
      const input = await uiPrompt("Neue Überschrift für diese Kategorie:", current, { title:"Kategorie umbenennen" });
      if(input === null) return;
      const newLabel = input.trim();
      if(!newLabel || newLabel === current) return;
      if(isCustom){
        const cat = (STATE.config.customCategories||[]).find(c=>c.key===key);
        if(cat) cat.label = newLabel;
      }else{
        STATE.config.categoryLabelOverrides = STATE.config.categoryLabelOverrides || {};
        STATE.config.categoryLabelOverrides[key] = newLabel;
      }
      saveConfig();
      renderSettingsModal();
    });
  });

  document.querySelectorAll("[data-delcustomcat]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const key = btn.dataset.delcustomcat;
      const label = btn.dataset.catlabel;
      if(!await uiConfirm(`Sie verschwindet dadurch aus allen Formularen, Übersichten und bestehenden Trades — das kann nicht rückgängig gemacht werden.`, { title:`Kategorie „${label}“ löschen?`, okText:"Löschen", danger:true })) return;
      STATE.config.customCategories = (STATE.config.customCategories||[]).filter(c=>c.key!==key);
      delete STATE.config["custom_"+key];
      STATE.trades.forEach(t=>{
        if(t.customCategories && key in t.customCategories) delete t.customCategories[key];
      });
      saveConfig();
      saveTrades();
      renderSettingsModal();
    });
  });

  document.querySelectorAll("[data-addcat]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const cfgKey = btn.dataset.addcat;
      const label = btn.dataset.catlabel;
      const val = await uiPrompt(`Neuer Wert für „${label}“:`, "", { title:"Wert hinzufügen", okText:"Hinzufügen" });
      if(!val) return;
      const v = val.trim();
      if(!v) return;
      if(!STATE.config[cfgKey].includes(v)){
        STATE.config[cfgKey].push(v);
        saveConfig();
      }
      renderSettingsModal();
    });
  });

  document.querySelectorAll(".market-chip-edit[data-cat]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const cfgKey = btn.dataset.cat;
      const field = btn.dataset.catfield;
      const multi = btn.dataset.catmulti === "true";
      const label = btn.dataset.catlabel;
      const oldVal = btn.dataset.value;
      const customKey = btn.dataset.customkey || null;
      const input = await uiPrompt(`Neuer Name — alle bestehenden Trades werden automatisch mit umbenannt.`, oldVal, { title:`„${label}“: Wert umbenennen` });
      if(input === null) return;
      const newVal = input.trim();
      if(!newVal || newVal === oldVal) return;

      const list = STATE.config[cfgKey];
      const duplicateExists = list.includes(newVal);

      // In der Auswahlliste umbenennen — existiert der neue Name schon, wird der alte
      // Eintrag einfach entfernt (kein doppelter Eintrag), sonst wird er ersetzt.
      STATE.config[cfgKey] = list.filter(x=>x!==oldVal);
      if(!duplicateExists) STATE.config[cfgKey].push(newVal);

      // Alle bestehenden Trades, die den alten Wert verwenden, automatisch auf den neuen
      // Namen umstellen — genau das "im ganzen Programm automatisch aktualisieren".
      // Bei frei erstellten Kategorien liegt der Wert in t.customCategories[customKey]
      // statt direkt in t[field].
      let changed = false;
      STATE.trades.forEach(t=>{
        const cur = customKey ? (t.customCategories||{}) : t;
        const curKey = customKey || field;
        if(customKey && !t.customCategories) return;
        if(multi){
          if(Array.isArray(cur[curKey]) && cur[curKey].includes(oldVal)){
            cur[curKey] = [...new Set(cur[curKey].map(x=> x===oldVal ? newVal : x))];
            changed = true;
          }
        }else if(cur[curKey] === oldVal){
          cur[curKey] = newVal;
          changed = true;
        }
      });

      saveConfig();
      if(changed) saveTrades();
      renderSettingsModal();
    });
  });

  document.querySelectorAll(".market-chip-remove[data-cat]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const cfgKey = btn.dataset.cat;
      const field = btn.dataset.catfield;
      const multi = btn.dataset.catmulti === "true";
      const val = btn.dataset.value;
      const customKey = btn.dataset.customkey || null;
      const inUse = STATE.trades.some(t=>{
        const cv = customKey ? (t.customCategories||{})[customKey] : t[field];
        if(multi) return (cv||[]).includes(val);
        return cv === val;
      });
      const msg = inUse
        ? `Wird noch in bestehenden Trades verwendet. Bestehende Trades behalten den Wert, er ist danach nur nicht mehr neu auswählbar.`
        : `Der Wert wird aus der Auswahlliste entfernt.`;
      if(!await uiConfirm(msg, { title:`„${val}“ entfernen?`, okText:"Entfernen", danger:true })) return;
      STATE.config[cfgKey] = STATE.config[cfgKey].filter(x=>x!==val);
      saveConfig();
      renderSettingsModal();
    });
  });
}

function closeSettingsModal(){
  document.getElementById("modalRoot").innerHTML = "";
  render();
}

/* =========================================================================
   HELPERS: chips
   ========================================================================= */
function chipGroupHtml(groupName, options, selected, opts){
  opts = opts || {};
  const multi = !!opts.multi;
  const resultStyle = !!opts.resultStyle;
  const labels = opts.labels || {};
  const sel = multi ? (selected||[]) : selected;
  const chips = options.map(o=>{
    const isSel = multi ? sel.includes(o) : sel === o;
    const cls = "chip" + (isSel?" selected":"") + (resultStyle && isSel ? " result-"+o : "");
    const label = labels[o] || o;
    // GEÄNDERT: aria-pressed – Auswahlzustand war bisher nur an der Farbe erkennbar
    return `<button type="button" class="${cls}" data-group="${groupName}" data-value="${escAttr(o)}" data-multi="${multi}" aria-pressed="${isSel}">${escHtml(label)}</button>`;
  }).join("");
  return `<div class="chip-group" data-chipgroup="${groupName}" role="group">${chips}</div>`;
}

// GEÄNDERT (Stufe 4): Auswahlzustand einer bestehenden Chip-Gruppe aktualisieren, ohne sie
// neu zu erzeugen (gleiche Klassen/ARIA wie chipGroupHtml).
function syncChipGroup(groupEl, value, multi){
  if(!groupEl) return;
  groupEl.querySelectorAll("button[data-group]").forEach(b=>{
    const v = b.dataset.value;
    const isSel = multi ? Array.isArray(value) && value.includes(v) : value === v;
    b.classList.toggle("selected", isSel);
    b.setAttribute("aria-pressed", String(isSel));
  });
}

function escHtml(s){ return String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function escAttr(s){ return escHtml(s); }

/* =========================================================================
   RENDER ROOT
   ========================================================================= */
let lastRenderViewKey = null;
/* GEÄNDERT (Stufe 4): Nachlauf-Haken für render(). Früher haben zwei MutationObserver
   auf #app jede Neuzeichnung "von außen" beobachtet und danach Barrierefreiheit,
   Scroll-Reveal usw. nachgerüstet. Jetzt ruft render() diese Schritte selbst auf —
   einmal, in fester Reihenfolge, mit der Info, ob sich die Ansicht gewechselt hat.
   Registrieren: RENDER_HOOKS.push((app, viewChanged)=>{ ... }) */
const RENDER_HOOKS = [];
let lastHookViewKey = null;
function render(){
  renderView();
  const app = document.getElementById("app");
  const key = STATE.view + (STATE.viewingTrade ? ":detail:" + (STATE.viewingTrade.id || "") : "");
  const viewChanged = key !== lastHookViewKey;
  lastHookViewKey = key;
  for(const fn of RENDER_HOOKS){
    try{ fn(app, viewChanged); }catch(err){ console.error("render-Haken fehlgeschlagen", err); }
  }
}
function renderView(){
  updateNavActive();
  updateBackupBadge();
  const app = document.getElementById("app");
  // Sanften Fade/Slide-Übergang bei jedem Reiter-/Ansichtswechsel erneut auslösen:
  // Animation entfernen, Reflow erzwingen, dann wieder hinzufügen.
  // GEÄNDERT: Fade nur bei echtem Ansichtswechsel (Reiter / Detailseite) — nicht bei
  // jedem Neu-Zeichnen nach Speichern, Löschen oder Sync, sonst "lädt" die Seite doppelt.
  const viewKey = STATE.view + (STATE.viewingTrade ? ":detail:" + (STATE.viewingTrade.id || "") : "");
  if(viewKey !== lastRenderViewKey){
    lastRenderViewKey = viewKey;
    app.classList.remove("app-fade-run");
    void app.offsetWidth;
    app.classList.add("app-fade-run");
  }
  const isStart = STATE.view === "start" && !STATE.viewingTrade;
  app.classList.toggle("main-narrow", isStart);
  // Basis-Breite reicht für die 9 eingebauten Kategorien; jede frei erstellte Kategorie
  // braucht zusätzlichen Platz (85px Spalte + 10px Abstand) — daher hier statt einer
  // festen CSS-Breite eine inline berechnete, die automatisch mitwächst.
  app.style.maxWidth = isStart ? "" : (1560 + (STATE.config.customCategories||[]).length * 95) + "px";

  if(STATE.viewingTrade){
    stopStartClock();
    app.innerHTML = renderTradeDetail(STATE.viewingTrade);
    wireTradeDetail();
    return;
  }

  if(STATE.view === "start"){
    app.innerHTML = renderStart();
    wireStart();
    startStartClock();
  }else{
    stopStartClock();
    if(STATE.view === "bericht"){ saveBerichtUi(); app.innerHTML = renderBericht(); wireBericht(); renderCharts(); }
    else if(STATE.view === "erkenntnisse"){ app.innerHTML = renderErkenntnisse(); wireErkenntnisse(); }
    else if(STATE.view === "strategie"){ app.innerHTML = renderStrategie(); wireStrategie(); }
    else{ app.innerHTML = renderAreaView(STATE.view); wireAreaView(STATE.view); }
  }
}

