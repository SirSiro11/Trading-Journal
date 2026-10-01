/* js/design.js — Design-Schicht: Animationen, Navigation-Schieber, Hell/Dunkel */
/* =========================================================================
   DESIGN-SCHICHT — Animationen & Interaktionen im Apple-Stil
   Reine Präsentation: greift nicht in Daten, Speichern oder Sync ein. Hängt sich
   über RENDER_HOOKS an render() (Ansichtswechsel) bzw. beobachtet Navigation/Modals.
   1 Sticky-Navigation (kompakt beim Scrollen) + Hero-Parallax   (rAF)
   2 Gleitender Schieber im Segmented Control der Hauptnavigation (FLIP)
   3 Scroll-Reveal (IntersectionObserver, gestaffelt) + Count-up der Kennzahlen
   4 Modals: weiches Einfahren nur beim ersten Öffnen
   5 Diagramm: bei Theme-Wechsel und Fenstergröße neu zeichnen
   ========================================================================= */
(function(){
  "use strict";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const header   = document.querySelector("header.topnav");
  const nav      = document.getElementById("mainNav");
  const app      = document.getElementById("app");
  const modalRoot = document.getElementById("modalRoot");
  if(!header || !nav || !app) return;

  /* ---------- 1 Scroll: kompakte Navigation + Hero-Parallax ---------- */
  let scrollTicking = false;
  function updateScroll(){
    scrollTicking = false;
    const y = window.scrollY || window.pageYOffset || 0;
    header.classList.toggle("is-compact", y > 8);
    const hero = app.querySelector(".start-hero");
    if(hero){
      const h = hero.offsetHeight || 1;
      const p = reduceMotion.matches ? 0 : Math.min(1, Math.max(0, y / h));
      hero.style.setProperty("--hero-p", p.toFixed(4));
    }
  }
  function onScroll(){
    if(scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(updateScroll);
  }
  window.addEventListener("scroll", onScroll, { passive:true });

  /* ---------- 2 Segmented Control: gleitender Schieber ----------
     Endzustand wird direkt gesetzt (Position/Breite), die Bewegung dorthin läuft
     als reine transform-Animation vom alten Rechteck aus (FLIP). */
  const indicator = document.createElement("span");
  indicator.className = "tabs-indicator";
  indicator.setAttribute("aria-hidden", "true");
  nav.insertBefore(indicator, nav.firstChild);
  nav.classList.add("has-indicator");
  let lastRect = null;

  function placeIndicator(animate){
    const active = nav.querySelector("button.active");
    if(!active || getComputedStyle(indicator).display === "none" || !active.offsetWidth){
      indicator.style.opacity = "0"; lastRect = null; return;
    }
    const r = { x:active.offsetLeft, y:active.offsetTop, w:active.offsetWidth, h:active.offsetHeight };
    indicator.style.width  = r.w + "px";
    indicator.style.height = r.h + "px";
    indicator.style.left   = r.x + "px";
    indicator.style.top    = r.y + "px";
    indicator.style.opacity = "1";
    const moved = lastRect && (lastRect.x !== r.x || lastRect.y !== r.y || lastRect.w !== r.w);
    if(animate && moved && !reduceMotion.matches){
      indicator.style.transition = "none";
      indicator.style.transform = `translate(${lastRect.x - r.x}px, ${lastRect.y - r.y}px) scaleX(${lastRect.w / r.w})`;
      void indicator.offsetWidth;            // Startzustand festschreiben
      indicator.style.transition = "";
      indicator.style.transform = "";
    }
    lastRect = r;
  }
  new MutationObserver(()=> placeIndicator(true))
    .observe(nav, { subtree:true, attributes:true, attributeFilter:["class"] });
  let resizeTimer = null;
  window.addEventListener("resize", ()=>{
    placeIndicator(false);
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(redrawChart, 180);
  });
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(()=> placeIndicator(false));

  /* ---------- 3 Scroll-Reveal + Count-up ----------
     Nur beim Wechsel der Ansicht (Reiter, Trade-Detail) — nicht bei jedem
     Neu-Rendern durch Filter oder Chips, das würde nerven. */
  const CONTAINERS = ".stat-grid, .start-stats, .start-bento, .strat-entry-grid, .compare-rings, .trade-list, .notes-list, .start-hero, .panel, .equity-card, .compare-wrap, .strat-panel, .trade-list-scroll";
  const COUNT_SEL  = ".stat-card .value, .start-stat .value, .start-kpi .value, .mini-stat-value, .gauge, .cal-month-total span:last-child";
  const MAX_REVEAL = 60;   // lange Listen: nur die ersten Einträge animieren

  function collectRevealTargets(container, out){
    for(const child of container.children){
      if(out.length >= MAX_REVEAL) return;
      if(child.matches(CONTAINERS) || child.querySelector(CONTAINERS)){
        collectRevealTargets(child, out);
      }else if(child.getClientRects().length){
        out.push(child);
      }
    }
  }

  const revealIO = ("IntersectionObserver" in window) ? new IntersectionObserver((entries)=>{
    let i = 0;
    entries.forEach(entry=>{
      if(!entry.isIntersecting) return;
      const el = entry.target;
      revealIO.unobserve(el);
      el.style.transitionDelay = Math.min(i++, 8) * 70 + "ms";
      el.classList.add("is-visible");
      countUpWithin(el);
      const done = ()=>{ el.classList.remove("reveal", "is-visible"); el.style.transitionDelay = ""; };
      el.addEventListener("transitionend", function te(ev){
        if(ev.target !== el || ev.propertyName !== "transform") return;
        el.removeEventListener("transitionend", te);
        done();
      });
      setTimeout(done, 1800);   // Sicherheitsnetz, falls kein transitionend kommt
    });
  }, { rootMargin:"0px 0px -6% 0px", threshold:0.08 }) : null;

  function setupReveal(){
    if(!revealIO) return;
    const targets = [];
    collectRevealTargets(app, targets);
    targets.forEach(el=>{
      el.classList.add("reveal");
      revealIO.observe(el);
    });
  }

  // Zahlen im deutschen Format hochzählen: „+12,50R“, „63%“, „3“ … Präfix/Suffix bleiben.
  const NUM_RE = /^([^\d+\-−]*)([+\-−]?)(\d+)(?:,(\d+))?(\D*)$/;
  function countUp(el){
    if(el.dataset.counted || el.children.length) return;
    const original = el.textContent;
    const m = original.trim().match(NUM_RE);
    if(!m) return;
    el.dataset.counted = "1";
    const [, pre, sign, intPart, decPart, post] = m;
    const decimals = decPart ? decPart.length : 0;
    const target = parseFloat(intPart + (decPart ? "." + decPart : ""));
    if(!isFinite(target) || target === 0) return;
    const dur = 1100, t0 = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 3);
    function frame(now){
      if(!el.isConnected) return;
      const t = Math.min(1, (now - t0) / dur);
      if(t >= 1){ el.textContent = original; return; }
      const v = (target * ease(t)).toFixed(decimals).replace(".", ",");
      el.textContent = pre + sign + v + post;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  function countUpWithin(root){
    if(reduceMotion.matches) return;
    if(root.matches(COUNT_SEL)) countUp(root);
    root.querySelectorAll(COUNT_SEL).forEach(countUp);
  }

  // GEÄNDERT (Stufe 4): render() meldet Ansichtswechsel selbst (RENDER_HOOKS) —
  // kein eigener MutationObserver auf #app mehr.
  let viewEnterTimer = null;
  RENDER_HOOKS.push((_app, viewChanged)=>{
    if(!viewChanged) return;
    requestAnimationFrame(updateScroll);
    if(reduceMotion.matches) return;
    app.classList.add("is-view-enter");
    clearTimeout(viewEnterTimer);
    viewEnterTimer = setTimeout(()=> app.classList.remove("is-view-enter"), 1600);
    setupReveal();
  });

  /* ---------- 4 Modals: Einfahren nur beim ersten Öffnen ---------- */
  if(modalRoot){
    let wasOpen = false, enterTimer = null;
    new MutationObserver(()=>{
      const open = modalRoot.children.length > 0;
      if(open && !wasOpen && !reduceMotion.matches){
        modalRoot.classList.remove("is-entering");
        void modalRoot.offsetWidth;
        modalRoot.classList.add("is-entering");
        clearTimeout(enterTimer);
        enterTimer = setTimeout(()=> modalRoot.classList.remove("is-entering"), 650);
      }
      wasOpen = open;
    }).observe(modalRoot, { childList:true });
  }

  /* ---------- 5 Diagramm neu zeichnen (Hell/Dunkel, Fenstergröße) ---------- */
  function redrawChart(){
    try{ if(document.getElementById("chart_equity") && typeof renderCharts === "function") renderCharts(); }catch(e){}
  }
  /* ---------- 6 Hell/Dunkel-Umschalter ---------- */
  const THEME_KEY = "tj_theme_v1";
  const root = document.documentElement;
  const themeBtn = document.getElementById("btnTheme");
  const metaTheme = document.getElementById("metaThemeColor");
  let switchTimer = null;
  function setThemeNow(t){
    root.setAttribute("data-theme", t);
    if(metaTheme) metaTheme.setAttribute("content", t === "dark" ? "#000000" : "#f5f5f7");
    if(themeBtn){
      themeBtn.setAttribute("aria-pressed", t === "dark" ? "true" : "false");
      themeBtn.title = t === "dark" ? "Dunkelmodus ausschalten" : "Dunkelmodus einschalten";
    }
    redrawChart();
  }
  // GEÄNDERT: Weicher Hell/Dunkel-Wechsel über die View-Transitions-API — der Browser
  // blendet ein Standbild der alten Ansicht in die neue über (GPU, ruckelfrei). Vorher
  // bekam JEDES Element eine eigene Farb-Transition, das hat bei vielen Elementen,
  // Milchglas und Schatten spürbar geruckelt. Ohne API-Unterstützung: sofortiger Wechsel
  // plus kurzes Überblenden der ganzen Seite (ebenfalls nur eine Ebene).
  let themeTransition = null;
  function applyTheme(t, animate){
    if(root.getAttribute("data-theme") === t && !animate){ setThemeNow(t); return; }
    if(!animate || reduceMotion.matches){ setThemeNow(t); return; }
    if(document.startViewTransition){
      if(themeTransition){ try{ themeTransition.skipTransition(); }catch(e){} }
      root.classList.add("theme-vt");
      themeTransition = document.startViewTransition(()=> setThemeNow(t));
      themeTransition.finished.finally(()=>{ root.classList.remove("theme-vt"); themeTransition = null; });
    }else{
      setThemeNow(t);
      root.classList.remove("theme-fade"); void root.offsetWidth; root.classList.add("theme-fade");
      clearTimeout(switchTimer);
      switchTimer = setTimeout(()=> root.classList.remove("theme-fade"), 500);
    }
  }
  if(themeBtn){
    themeBtn.addEventListener("click", ()=>{
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      try{ localStorage.setItem(THEME_KEY, next); }catch(e){}
      applyTheme(next, true);
    });
  }
  applyTheme(root.getAttribute("data-theme") === "dark" ? "dark" : "light", false);

  const schemeMq = window.matchMedia("(prefers-color-scheme: dark)");
  // Systemwechsel nur übernehmen, solange keine eigene Wahl gespeichert ist
  const onScheme = ()=>{
    let saved = null;
    try{ saved = localStorage.getItem(THEME_KEY); }catch(e){}
    if(saved === "light" || saved === "dark") return;
    applyTheme(schemeMq.matches ? "dark" : "light", true);
  };
  if(schemeMq.addEventListener) schemeMq.addEventListener("change", onScheme);
  else if(schemeMq.addListener) schemeMq.addListener(onScheme);

  updateScroll();
})();
