/* js/erkenntnisse.js — Erkenntnisse-Reiter (Liste) */
/* =========================================================================
   ERKENNTNISSE — freie Learnings aus dem Markt, unabhängig von einzelnen
   Trades. Mit Notiz + optionalen Screenshots, plus Stichwort-Wolke wie bei
   der Notizen-Suche im Bericht, um wiederkehrende Themen zu erkennen.
   ========================================================================= */
function emptyInsight(){
  return { id: uid(), date: todayISO(), titel: "", text: "", screenshots: [], createdAt: Date.now(), updatedAt: Date.now() };
}

function renderErkenntnisse(){
  const cloudBlock = wordCloudBlockHtml({
    items: STATE.insights,
    getText: i=>i.text,
    hidden: STATE.config.hiddenInsightWords || [],
    groups: STATE.config.insightWordGroups || [],
    chipAttr: "insightword",
    hideAttr: "hideinsightword",
    restoreAttr: "restoreinsightword",
    dissolveAttr: "dissolveinsightgroup",
    mergeToggleAttr: "toggleinsightmerge",
    mergeSelectAttr: "selectinsightword",
    mergeConfirmAttr: "confirminsightmerge",
    mergeCancelAttr: "cancelinsightmerge",
    scope: "insights",
    expanded: STATE.hiddenInsightWordsExpanded,
    mergeMode: STATE.insightMergeMode,
    mergeSelection: STATE.insightMergeSelection,
    wordMenuOpen: STATE.insightWordMenuOpen,
    emptyMsg: "Noch nicht genug Erkenntnisse für wiederkehrende Themen (ein Begriff muss in mind. 2 Erkenntnissen vorkommen)."
  });

  return `
    <div class="page-head">
      <h1>Erkenntnisse</h1>
      <p>Learnings aus dem Markt — mit eigener Notiz und optionalem Screenshot festhalten.</p>
    </div>
    <div class="row-between">
      <div style="color:var(--text-dim); font-size:13.5px;">${STATE.insights.length} Erkenntnis${STATE.insights.length===1?"":"se"}</div>
      <button class="btn btn-primary" id="btnAddInsight">+ Erkenntnis hinzufügen</button>
    </div>

    <div class="panel" style="margin-bottom:22px;">
      <input type="search" id="insightSearchInput" aria-label="Erkenntnisse durchsuchen" placeholder="Erkenntnisse durchsuchen…" value="${escAttr(STATE.insightSearchQuery||"")}">
      <div style="color:var(--text-faint); font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; margin:14px 0 8px;">Wiederkehrende Themen</div>
      ${cloudBlock}
    </div>

    <div id="insightListContainer">${insightListHtml(STATE.insights, STATE.insightSearchQuery)}</div>
  `;
}

function insightListHtml(insights, query){
  const q = (query||"").trim().toLowerCase();
  const filtered = q ? insights.filter(i=> matchesQuery(i.text, q) || matchesQuery(i.titel, q)) : insights;
  const sorted = filtered.slice().sort((a,b)=> (b.date||"").localeCompare(a.date||"") || (b.createdAt||0)-(a.createdAt||0));

  if(!sorted.length){
    return `<div class="empty-state panel">
      <div class="big">◇</div>
      <div>${q ? `Keine Erkenntnisse gefunden für „${escHtml(query)}“.` : "Noch keine Erkenntnisse eingetragen."}</div>
      ${q ? "" : `<button type="button" class="btn btn-primary" data-emptyaddinsight="1">+ Erste Erkenntnis festhalten</button>`}
    </div>`;
  }

  return `<div class="notes-list">${sorted.map(i=>`
    <div class="note-item" data-insightedit="${i.id}" tabindex="0" role="button">
      ${i.titel ? `<div class="note-item-title">${highlightQuery(i.titel, q)}</div>` : ""}
      <div class="note-item-head">
        <span class="tag">${formatDateDE(i.date)}</span>
        ${(i.screenshots&&i.screenshots.length) ? `<span class="tag">${i.screenshots.length} Screenshot${i.screenshots.length===1?"":"s"}</span>` : ""}
        <button type="button" class="icon-action is-danger" data-insightdel="${i.id}" style="margin-left:auto;" title="Löschen" aria-label="Erkenntnis löschen">${ICON_DELETE}</button>
      </div>
      <div class="note-item-text">${highlightQuery(i.text, q)}</div>
      ${(i.screenshots&&i.screenshots.length) ? `
      <div class="shot-gallery" style="margin-top:10px;">
        ${i.screenshots.map((src,si)=>`<div class="shot-thumb" data-insightshotref="${i.id}:${si}" role="button" tabindex="0" aria-label="Screenshot ${si+1} vergrößern"><img src="${escAttr(src)}" alt=""></div>`).join("")}
      </div>` : ""}
    </div>
  `).join("")}</div>`;
}

function wireErkenntnisse(){
  document.getElementById("btnAddInsight").addEventListener("click", ()=> openInsightModal(null));

  const searchInput = document.getElementById("insightSearchInput");
  if(searchInput){
    searchInput.addEventListener("input",(e)=>{
      STATE.insightSearchQuery = e.target.value;
      const container = document.getElementById("insightListContainer");
      if(container) container.innerHTML = insightListHtml(STATE.insights, STATE.insightSearchQuery);
      wireInsightListClicks();
    });
  }
  document.querySelectorAll("[data-insightword]").forEach(chip=>{
    chip.addEventListener("click", ()=>{
      STATE.insightSearchQuery = chip.dataset.insightword;
      render();
    });
  });
  wireWordCloudEvents({
    hideAttr: "hideinsightword", restoreAttr: "restoreinsightword", dissolveAttr: "dissolveinsightgroup",
    mergeToggleAttr: "toggleinsightmerge", mergeSelectAttr: "selectinsightword",
    mergeConfirmAttr: "confirminsightmerge", mergeCancelAttr: "cancelinsightmerge",
    scope: "insights", hiddenArrayKey: "hiddenInsightWords", groupsArrayKey: "insightWordGroups", onChange: render
  });
  wireInsightListClicks();
}

