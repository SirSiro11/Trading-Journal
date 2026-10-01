/* js/init.js — Sperrbildschirm, globale Tastatur-/Fehler-Handler, Fokus-Management, Start */
/* =========================================================================
   ZUGANGSSPERRE
   Einfache Code-Abfrage, die zufällige Besucher des öffentlichen Links abhält —
   KEINE echte Sicherheit: die App selbst wird trotzdem komplett im Browser
   geladen, ein technisch versierter Besucher könnte die Sperre über die
   Entwicklertools umgehen. Der PIN liegt bewusst nicht im Klartext im Code,
   sondern nur als einfacher Prüfwert (kein kryptografisches Verfahren, damit es
   auch offline/lokal ganz ohne Browser-Sicherheitsfunktionen funktioniert).
   Wird bei JEDEM Öffnen erneut abgefragt (keine Merkfunktion).
   ========================================================================= */
const LOCK_PIN_CHECK = "7c795e72";

function simpleHash(str){
  let h = 5381;
  for(let i=0;i<str.length;i++){
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h.toString(16);
}

function startApp(){
  const lockScreen = document.getElementById("lockScreen");
  const appShell = document.getElementById("appShell");
  // Mehrstufiger Übergang: Lock-Box schrumpft/verblasst zuerst nach oben weg,
  // der Lock-Screen blendet mit leichtem Weichzeichner aus, danach kommt die
  // App mit Blur-Auflösung, sanftem Hochgleiten und kurzem Glow-Aufblitzen rein
  // (statt hartem display:none-Umschalten).
  lockScreen.classList.add("lock-fading");
  setTimeout(()=>{
    lockScreen.style.display = "none";
    appShell.style.display = "";
    appShell.classList.remove("app-shell-glow");
    void appShell.offsetWidth;
    appShell.classList.add("app-shell-glow");
    render();
    gdrivePull();
    setTimeout(()=> appShell.classList.remove("app-shell-glow"), 1100);
  }, 460);
}

function tryUnlock(){
  const input = document.getElementById("lockPinInput");
  const val = input.value.trim();
  if(!val) return;
  if(simpleHash(val) === LOCK_PIN_CHECK){
    startApp();
  }else{
    document.getElementById("lockError").style.display = "block";
    input.value = "";
    input.focus();
  }
}

document.getElementById("lockSubmitBtn").addEventListener("click", tryUnlock);
document.getElementById("lockPinInput").addEventListener("keydown", (e)=>{
  if(e.key === "Enter") tryUnlock();
});
document.getElementById("lockPinInput").focus();

/* =========================================================================
   INIT
   ========================================================================= */
// Warnt beim Schließen/Verlassen der Seite, falls es Änderungen gibt, die noch in
// keinem JSON-Backup stecken (Browser zeigt dafür seinen eigenen Standard-Dialog,
// der Text lässt sich aus Sicherheitsgründen nicht anpassen).
// Seit dem automatischen Drive-Sync nur noch, wenn tatsächlich etwas verloren ginge:
// ein Push steht noch aus, läuft gerade, ist fehlgeschlagen oder wartet auf eine
// Konfliktentscheidung. Nach erfolgreichem Sync keine Warnung mehr.
/* Ein per Link eingebundener Screenshot kann fehlschlagen: kein Netz, Link tot,
   Snapshot beim Anbieter gelöscht. Statt eines kaputten Bild-Symbols zeigt die
   Kachel dann einen anklickbaren Hinweis mit der Original-Adresse. error-Events
   steigen nicht auf, deshalb wird hier in der Capture-Phase gelauscht — so
   genügt ein einziger Listener für alle Ansichten. */
document.addEventListener("error", (e)=>{
  const img = e.target;
  if(!img || img.tagName !== "IMG") return;
  const src = img.getAttribute("src") || "";
  if(!src || src.indexOf("data:") === 0) return; // eingebettete Bilder können nicht fehlen
  const listThumb = img.closest(".trade-thumb");
  if(listThumb){
    listThumb.classList.add("is-broken");
    listThumb.title = "Bild nicht ladbar: " + src;
    listThumb.insertAdjacentText("afterbegin", "⚠");
    return;
  }
  const thumb = img.closest(".shot-thumb");
  if(!thumb) return;
  const box = document.createElement("a");
  box.className = "shot-broken" + (thumb.classList.contains("lg") ? " lg" : "");
  box.href = src;
  box.target = "_blank";
  box.rel = "noopener";
  box.title = src;
  const line1 = document.createElement("div");
  line1.textContent = "⚠ Bild nicht ladbar";
  const line2 = document.createElement("div");
  line2.className = "shot-broken-sub";
  line2.textContent = "Adresse im neuen Tab öffnen";
  box.appendChild(line1); box.appendChild(line2);
  img.replaceWith(box);
}, true);

/* Tastatur: Escape schließt die oberste Ebene (Bild-Vollansicht → Formular/Modal →
   Trade-Detailseite), Enter/Leertaste öffnet anklickbare Karten (Trade-Zeilen,
   Kalendertage, Notizen …), die per Tab erreichbar sind. Eigene Dialoge (uiDialog)
   behandeln ihre Tasten selbst und haben Vorrang. */
document.addEventListener("keydown", (e)=>{
  if(document.getElementById("dialogRoot").children.length) return;
  if(e.key === "Escape"){
    const lb = document.querySelector(".lightbox-backdrop");
    if(lb){ e.preventDefault(); closeLightbox(lb); return; }
    if(document.getElementById("modalRoot").children.length){
      e.preventDefault();
      if(STATE.draft) requestCloseTradeModal();
      else if(STATE.insightDraft) requestCloseInsightModal();
      else if(document.getElementById("settingsBackdrop")) closeSettingsModal();
      else if(document.getElementById("newsBackdrop")) closeNewsModal();
      else closeStrategyEntryModal();
      return;
    }
    if(STATE.viewingTrade){ e.preventDefault(); closeTradeDetail(); }
    return;
  }
  if(e.key === "Enter" || e.key === " "){
    const el = document.activeElement;
    if(el && el.getAttribute("role") === "button" && el.tagName !== "BUTTON" && e.target === el){
      e.preventDefault();
      el.click();
    }
  }
});

/* GEÄNDERT: Barrierefreiheit zentral nachrüsten, ohne jede Render-Funktion anzufassen.
   - Feld-Überschriften (label.fg-label) werden mit ihrem Eingabefeld bzw. ihrer Chip-Gruppe
     verknüpft (vorher hatte kein Formularfeld ein zugeordnetes Label).
   - „Dateien auswählen“-Labels sind per Tastatur erreichbar (das Datei-Input ist unsichtbar).  */
let a11yLabelSeq = 0;
function enhanceA11y(root){
  if(!root) return;
  root.querySelectorAll(".field-group").forEach(fg=>{
    const label = fg.querySelector("label.fg-label");
    if(!label || label.htmlFor || label.dataset.a11y) return;
    label.dataset.a11y = "1";
    const target = fg.querySelector('input:not([type=file]):not([type=hidden]):not([type=checkbox]), textarea, select, .chip-group, .shot-dropzone');
    if(!target || label.contains(target)) return;
    if(/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) && target.id){
      label.htmlFor = target.id;
    }else if(!target.hasAttribute("aria-labelledby") && !target.hasAttribute("aria-label")){
      if(!label.id) label.id = "fgl-" + (++a11yLabelSeq);
      target.setAttribute("aria-labelledby", label.id);
    }
  });
  root.querySelectorAll("label.shot-filelabel:not([tabindex])").forEach(l=>{
    l.tabIndex = 0;
    l.setAttribute("role", "button");
  });
}

/* GEÄNDERT: Fokus-Management für Modals.
   - Beim Öffnen wandert der Fokus in den Dialog, beim Schließen zurück zum Auslöser.
   - Formulare werden bei jedem Chip-Klick komplett neu gerendert; dabei ging der Tastatur-
     fokus bisher verloren (landete auf <body>). Jetzt wird das zuletzt fokussierte Element
     anhand von id/data-Attributen wiedergefunden. */
let modalWasOpen = false;
let modalReturnFocus = null;
let modalFocusSel = null;
function focusSelectorFor(el){
  if(!el || !el.tagName) return null;
  if(el.id) return "#" + CSS.escape(el.id);
  const attrs = Array.from(el.attributes).filter(a=> a.name.indexOf("data-") === 0);
  if(!attrs.length) return null;
  return el.tagName.toLowerCase() + attrs.map(a=> `[${a.name}="${CSS.escape(a.value)}"]`).join("");
}
document.getElementById("modalRoot").addEventListener("focusin", (e)=>{ modalFocusSel = focusSelectorFor(e.target); });

// Hintergrund-Scrollen sperren, solange ein Modal offen ist (iPhone: sonst scrollt die
// Liste hinter dem Formular mit).
new MutationObserver(()=>{
  const modalRoot = document.getElementById("modalRoot");
  const open = modalRoot.children.length > 0;
  document.body.classList.toggle("modal-open", open);
  if(open){
    if(!modalWasOpen){
      modalReturnFocus = document.activeElement;
      modalFocusSel = null;
    }
    enhanceA11y(modalRoot);
    const dlg = modalRoot.querySelector(".modal");
    if(dlg){
      if(!dlg.hasAttribute("role")) dlg.setAttribute("role", "dialog");
      dlg.setAttribute("aria-modal", "true");
      if(!dlg.hasAttribute("aria-label") && !dlg.hasAttribute("aria-labelledby")){
        const h = dlg.querySelector("h2");
        if(h){ if(!h.id) h.id = "modalTitle"; dlg.setAttribute("aria-labelledby", h.id); }
      }
      if(!dlg.hasAttribute("tabindex")) dlg.tabIndex = -1;
      if(!modalRoot.contains(document.activeElement)){
        const again = modalFocusSel ? modalRoot.querySelector(modalFocusSel) : null;
        (again || dlg).focus({preventScroll:true});
      }
    }
  }else if(modalWasOpen){
    const back = modalReturnFocus;
    modalReturnFocus = null;
    const target = (back && back.isConnected && back !== document.body) ? back : document.getElementById("app");
    if(target && !document.getElementById("dialogRoot").children.length) target.focus({preventScroll:true});
  }
  modalWasOpen = open;
}).observe(document.getElementById("modalRoot"), { childList:true });

// GEÄNDERT: Labels/Buttons auch in den normalen Ansichten nachrüsten
// GEÄNDERT (Stufe 4): direkt als render()-Haken statt per MutationObserver
RENDER_HOOKS.push(app=> enhanceA11y(app));

/* GEÄNDERT: Tab-Taste bleibt in der obersten offenen Ebene (Dialog → Bildansicht → Modal),
   statt in die Seite dahinter zu springen. */
document.addEventListener("keydown", (e)=>{
  if(e.key !== "Tab") return;
  const layer = document.querySelector("#dialogRoot .dialog")
             || document.querySelector(".lightbox-backdrop")
             || document.querySelector("#modalRoot .modal");
  if(!layer) return;
  const items = Array.from(layer.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
    .filter(el=> el.getClientRects().length > 0);
  if(!items.length){ e.preventDefault(); return; }
  const first = items[0], last = items[items.length - 1];
  const active = document.activeElement;
  if(!layer.contains(active) || active === layer){
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
  }else if(e.shiftKey && active === first){
    e.preventDefault(); last.focus();
  }else if(!e.shiftKey && active === last){
    e.preventDefault(); first.focus();
  }
});

window.addEventListener("beforeunload", (e)=>{
  const pushPending = !!gdrivePushTimer || gdriveBusy || STATE.driveStatus === "error" || STATE.driveStatus === "conflict";
  if(hasUnbackedChanges() && pushPending){
    e.preventDefault();
    e.returnValue = "";
  }
});
