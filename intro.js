/* intro.js — Cinematisches Intro nach dem Entsperren: Bild (WebGL), Ton (Web Audio), Ablauf */
/* =========================================================================
   INTRO  —  NEU (2026-10-15)
   Läuft nach dem Entsperren per PIN und vor der Startseite (~18 s). Alles wird
   live erzeugt: Bild mit eigenen WebGL-Shadern, Ton mit Web Audio. Keine
   Video- oder Audiodateien, keine Bibliotheken. Einzige Datei: start-bg.jpg
   für den Match-Cut am Ende. Das Intro LIEST nur (Anzahl Live-Trades) und
   greift nicht in Daten, Sync oder render() ein — die App läuft darunter normal.
   Aufbau:
     1 Drehbuch       — alle Zeiten, Texte, Farben, Look-Werte (hier tunen)
     2 Hilfen         — Zufall (mulberry32), Kurven, Matrizen
     3 Einstellungen  — tj_intro_v1 (nur dieses Gerät, kein Sync)
     4 Ton            — Synthese, Mischpult, Zeitplan
     5 Bild           — WebGL: Shader, Render-Targets, Szenen je Akt
     6 Text           — DOM-Ebene (gestochen scharf, Systemschrift)
     7 Ablauf         — Start, Schleife, Überspringen, Ende, Aufräumen
   Schnittstelle: INTRO.vorbereiten() (in der Entsperr-Geste!), INTRO.geplant(),
   INTRO.starten(), INTRO.aktiv(), INTRO.abspielen(), INTRO.einstellungenHtml(),
   INTRO.einstellungenVerdrahten(root)
   Testparameter: ?intro=vorschau | ?intro=kurz | ?intro=bild:8.5 | ?intro=live (folgt der Einstellung)
   ========================================================================= */
const INTRO = (function(){
"use strict";

/* ---------- 1 DREHBUCH ----------------------------------------------------- */
const D = {
  dauer: 18.1,            // Ende: Overlay ist weg, die Startseite übernimmt
  obergrenze: 22,         // harte Obergrenze in Sekunden (Sicherheitsnetz)
  kurzAb: 13.7,           // Kurzfassung startet hier: Drop → Titel → Übergang (~4,4 s)
  ruhigDauer: 2.2,        // prefers-reduced-motion: ruhige Titelkarte
  akte: {                 // [von, bis] in Sekunden
    stille:[0, 1.2], chaos:[1.2, 4.4], verlust:[4.4, 6.6], disziplin:[6.6, 11.0],   // GEÄNDERT (2026-10-16): mehr Zeit für den Trade
    aufstieg:[11.0, 13.6], drop:[13.6, 14.2], titel:[14.2, 16.85], uebergang:[16.85, 18.1]
  },
  linieZuenden: 0.35,                              // Nulllinie zündet (auf dem Uhr-Tick)
  schnitte: [2.15, 3.3],                           // harte Schnitte im Chaos
  blitze: [1.3, 1.72, 2.15, 2.55, 2.95, 3.3, 3.7, 4.06], // aufblitzende Kerzen — max. 3 pro Sekunde (wird geprüft)
  zeitlupe: { von:4.58, bis:4.95, faktor:0.08 },   // Speed-Ramp im Verlust
  bruchTau: 0.245,                                 // Szenenzeit, in der die Kerze die Stop-Linie durchschlägt
  beats: [7.6, 8.5, 9.4],                          // Disziplin: ein Wort und eine Linie pro Beat
  zielErreicht: 10.2,
  staccato: { von:11.15, bis:13.55, start:0.27, ende:0.11 },  // Abstand der Pulse (s) wird kürzer
  texte: {          // jede Tafel ist mindestens 1,0 s voll lesbar
    A:{ von:1.9, bis:4.15, ein:0.5, aus:0.35 },
    B:{ von:4.75, bis:6.6, ein:0.45, aus:0.3 },
    C:{ bis:11.05, ein:0.3, aus:0.3 },             // Wörter erscheinen auf den beats
    titel:{ von:14.2, bis:16.85, sweep:0.8, lsVon:0.3, lsBis:0.46 },  // Laufweite in em
    motto:{ von:14.95, ein:0.6 },
    daten:{ von:15.35, ein:0.5 }
  },
  saetze: [
    { A:"Der Markt ist Lärm.", B:"Verluste gehören dazu.", C:"Plan. Geduld. Ausführung.", motto:"Prozess vor Ergebnis." },
    { A:"Jeder will den großen Move.", B:"Wenige überstehen den Drawdown.", C:"Regeln. Risiko. Ruhe.", motto:"Disziplin schlägt Talent." },
    { A:"Gier schreit. Angst flüstert.", B:"Der Stop ist kein Fehler.", C:"Warten. Bestätigen. Handeln.", motto:"Tausend Trades zählen. Nicht einer." },
    { A:"Der Markt schuldet dir nichts.", B:"Jeder Verlust ist Lehrgeld.", C:"Setup. Stop. Ziel.", motto:"Heute zählt nur dein Prozess." },
    { A:"Niemand gewinnt jeden Trade.", B:"Aber jeder bestimmt sein Risiko.", C:"Plan your trade. Trade your plan.", motto:"Konstanz ist der Edge." }   // GEÄNDERT (2026-10-16)
  ],
  titel: ["TRADING", "JOURNAL"],
  datenzeile: "Trade Nr. {n} wartet.",              // nur Anzahl, nie Gewinn/Verlust
  farben: {   // sRGB; Rot/Grün bewusst entsättigt; Session-Farben = --sess-ldn / --sess-nyc (dunkel)
    gold:"#f2c27a", weissWarm:"#fff0d6", teal:"#0e3943", tealHell:"#3d8c9a",
    rot:"#b8473e", gruen:"#5aae84", ldn:"#409cff", nyc:"#30d158", lichtHell:"#f3ece1", lila:"#8c78d0", silber:"#c9d3d6"
  },
  /* NEU (2026-10-16): der Trade im Akt „Disziplin“ (GBP/USD, M5, 08.10.2026) — Zeiten „HH:MM“, Preise wie im Chart.
     Gegen einen anderen Trade austauschbar: Stützpunkte des Kursverlaufs, Dochte, Zonen, Linien, Entry/Stop/Ziel. */
  trade: {
    paar:"GBP/USD · M5", mitte:1.32075, hochAb:"05:30",     // Hochformat zeigt den Chart erst ab 05:30
    entry:1.31902, stop:1.31837, ziel:1.32176, start:"13:05", ende:"16:05",
    kurs:[["23:00",1.3203],["23:30",1.3203],["00:30",1.3205],["00:45",1.3210],["01:30",1.3209],["01:50",1.3211],["02:20",1.3206],["02:40",1.3203],
      ["03:00",1.3194],["03:15",1.3199],["03:30",1.31985],["03:45",1.3206],["04:00",1.3214],["04:15",1.32205],["04:25",1.3218],["04:45",1.3215],
      ["05:00",1.3209],["05:15",1.31985],["05:30",1.3203],["05:50",1.3209],["06:10",1.3210],["06:30",1.3205],["06:45",1.3208],["07:00",1.3209],
      ["07:30",1.3203],["07:45",1.3199],["08:00",1.3196],["08:10",1.3188],["08:20",1.3194],["08:40",1.3199],["08:50",1.3200],["09:00",1.3190],
      ["09:10",1.3193],["09:30",1.3199],["09:45",1.3205],["10:00",1.3199],["10:10",1.3202],["10:20",1.3211],["10:35",1.3204],["10:50",1.3198],
      ["11:00",1.3192],["11:10",1.3187],["11:30",1.3195],["11:45",1.3196],["12:00",1.3191],["12:10",1.3186],["12:25",1.3193],["12:45",1.3199],
      ["12:55",1.3204],["13:05",1.3192],["13:20",1.3194],["13:40",1.3195],["14:00",1.3206],["14:15",1.3211],["14:30",1.3213],["14:45",1.3205],
      ["15:00",1.3201],["15:10",1.3208],["15:25",1.3211],["15:40",1.3212],["15:55",1.3216],["16:05",1.3218]],
    dochte:{ "23:15":[1.3215,0], "04:15":[1.32225,0], "08:10":[0,1.31835], "11:10":[0,1.3185], "12:10":[0,1.31845], "13:05":[0,1.31895], "16:00":[1.3219,0] },
    zonen:[ { von:"04:15", bis:"16:05", p:[1.32172,1.32222], art:"angebot" },
            { von:"23:00", bis:"13:30", p:[1.31812,1.31892], art:"nachfrage" },
            { von:"09:05", bis:"12:00", p:[1.31877,1.31929], art:"nachfrage", label:"5" },
            { von:"12:15", bis:"13:30", p:[1.31842,1.31895], art:"nachfrage", label:"15" },
            { von:"13:05", bis:"16:05", p:[1.31837,1.31902], art:"lila", label:"2" } ],
    linien:[ { von:"04:15", bis:"10:00", p:1.3213, art:"gold" }, { von:"04:15", bis:"10:00", p:1.32075, art:"hell" },
             { von:"04:15", bis:"10:00", p:1.3200, art:"fein" }, { von:"04:15", bis:"10:00", p:1.31877, art:"fein" },
             { von:"23:00", bis:"11:00", p:1.32176, art:"fein" }, { von:"23:00", bis:"11:00", p:1.3185, art:"fein" },
             { von:"23:00", bis:"11:00", p:1.32335, art:"hell" }, { von:"12:00", bis:"12:50", p:1.3200, art:"hell", label:"C" } ]
  },
  /* NEU (2026-10-16): Übergänge — Kamera-Stöße [Zeit, Stärke], Glitch-Schnitte (2 Frames RGB-Versatz), radiale Zoom-Unschärfe
     [von, bis, Stärke, Form], Lichteinfälle [von, bis, x von, x bis, Stärke] (x in Bildbreiten) */
  effekte: {
    stoesse:[[1.2,0.5],[2.15,0.3],[3.3,0.3],[4.4,1],[6.6,0.55],[14.2,0.25]],
    glitch:[2.15, 3.3, 4.4, 6.6], glitchDauer:0.075,
    zoom:[[1.18,1.6,0.07,"glocke"],[6.3,6.6,0.16,"auf"],[6.6,6.95,0.1,"ab"],[11.0,11.7,0.05,"glocke"]],
    licht:[[1.12,1.75,-0.15,0.35,0.5],[6.45,7.15,1.15,0.6,0.3],[14.15,15.0,-0.2,0.25,0.18]],
    sog:[6.3, 6.6],          // Verlust → Disziplin: Scherben frieren ein und stürzen ins Objektiv
    blitz:[13.53, 13.6]      // 1 Frame Weiß vor der Stille
  },
  look: { bloom:0.8, schwelle:0.7, streak:0.4, korn:0.042, vignette:0.5, ca:0.012, saettigung:0.94 },
  ton: { lautstaerke:0.72, einblenden:0.6, ausblenden:0.35, hallSek:3.6, nachklang:2.6 }
};
const INTRO_LIVE = false;   // Phase 2: nur über ?intro=… bzw. „Intro jetzt abspielen“. Phase 3 → true

/* ---------- 2 HILFEN ------------------------------------------------------- */
const { sin, cos, exp, pow, abs, min, max, floor, round, hypot, sqrt, tan, tanh, ceil, PI } = Math;
const clamp=(x,a,b)=>x<a?a:x>b?b:x, sat=x=>clamp(x,0,1), lerp=(a,b,k)=>a+(b-a)*k;
const prog=(t,a,b)=>sat((t-a)/(b-a));
const K = {   // Bewegungskurven — nie linear
  sanft:k=>k*k*(3-2*k), aus3:k=>1-pow(1-k,3), ein2:k=>k*k,
  inOut3:k=>k<.5?4*k*k*k:1-pow(-2*k+2,3)/2,
  ausExpo:k=>k>=1?1:1-pow(2,-10*k)
};
function huelle(t,von,bis,ein,aus){ if(t<=von||t>=bis) return 0; return min(K.aus3(prog(t,von,von+ein)), 1-K.sanft(prog(t,bis-aus,bis))); }
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function hexLin(h){ const n=parseInt(h.slice(1),16); return [(n>>16)&255,(n>>8)&255,n&255].map(c=>pow(c/255,2.2)); }
const sk=(c,q,h)=>[c[0]*q,c[1]*q,c[2]*q,h];   // Farbe skaliert + Halo
const mix3=(a,b,k)=>[lerp(a[0],b[0],k),lerp(a[1],b[1],k),lerp(a[2],b[2],k)];
const dist3=(a,b)=>hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const M = {
  neu:()=>new Float32Array(16),
  persp(o,tanH,asp,n,f){ o.fill(0); o[0]=1/(tanH*asp); o[5]=1/tanH; o[10]=(f+n)/(n-f); o[11]=-1; o[14]=2*f*n/(n-f); return o; },
  blick(o,e,c,roll){
    let zx=e[0]-c[0], zy=e[1]-c[1], zz=e[2]-c[2], l=hypot(zx,zy,zz)||1; zx/=l; zy/=l; zz/=l;
    const ux=sin(roll), uy=cos(roll);
    let xx=uy*zz, xy=-ux*zz, xz=ux*zy-uy*zx; l=hypot(xx,xy,xz)||1; xx/=l; xy/=l; xz/=l;
    const yx=zy*xz-zz*xy, yy=zz*xx-zx*xz, yz=zx*xy-zy*xx;
    o[0]=xx;o[1]=yx;o[2]=zx;o[3]=0; o[4]=xy;o[5]=yy;o[6]=zy;o[7]=0; o[8]=xz;o[9]=yz;o[10]=zz;o[11]=0;
    o[12]=-(xx*e[0]+xy*e[1]+xz*e[2]); o[13]=-(yx*e[0]+yy*e[1]+yz*e[2]); o[14]=-(zx*e[0]+zy*e[1]+zz*e[2]); o[15]=1; return o;
  },
  mal(o,a,b){ for(let c=0;c<4;c++) for(let r=0;r<4;r++) o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3]; return o; }
};
// Fotosensibilität (WCAG 2.3.1): höchstens 3 Blitze in jeder Sekunde — überzählige werden verworfen
const BLITZE = D.blitze.slice().sort((a,b)=>a-b).reduce((acc,t)=>{ if(acc.filter(k=>t-k<1).length<3) acc.push(t); return acc; }, []);
const STACCATO = (()=>{ const s=D.staccato, out=[]; let t=s.von; while(t<s.bis){ out.push(t); t+=lerp(s.start,s.ende,(t-s.von)/(s.bis-s.von)); } return out; })();
function heuteIso(){ const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
function tagDesJahres(){ const d=new Date(); return floor((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())-Date.UTC(d.getFullYear(),0,0))/864e5); }

/* ---------- 3 EINSTELLUNGEN (tj_intro_v1, nur dieses Gerät) --------------- */
const LS_INTRO = "tj_intro_v1";
const MODI = [["immer","Immer"],["taeglich","Einmal am Tag, sonst kurz"],["kurz","Nur Kurzfassung"],["aus","Aus"]];
function ladeEinst(){
  let o = {};
  try{ o = JSON.parse(localStorage.getItem(LS_INTRO) || "{}") || {}; }catch(e){}
  return { modus: MODI.some(m=>m[0]===o.modus) ? o.modus : "immer", ton: o.ton !== false, letzteVoll: o.letzteVoll || "" };
}
function speichereEinst(e){ try{ localStorage.setItem(LS_INTRO, JSON.stringify(e)); }catch(_){} }   // bewusst ohne markDataChanged
const URL_INTRO = (()=>{ try{ return new URLSearchParams(location.search).get("intro"); }catch(e){ return null; } })();
const ruhigGewuenscht = ()=> !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

// Welche Fassung läuft nach dem Entsperren? null = keine
function planNachEntsperren(){
  const p = URL_INTRO || "";
  let art = null, bildT = 0;
  if(p === "vorschau") art = "voll";
  else if(p === "kurz") art = "kurz";
  else if(p.indexOf("bild:") === 0){ art = "bild"; bildT = parseFloat(p.slice(5).replace(",", ".")); if(!isFinite(bildT)) bildT = 8.5; }
  else if(INTRO_LIVE || p === "live"){   // ?intro=live: wie nach der Freischaltung (folgt der Einstellung)
    const e = ladeEinst();
    if(e.modus === "aus") return null;
    if(e.modus === "kurz") art = "kurz";
    else if(e.modus === "taeglich"){ const h = heuteIso(); if(e.letzteVoll === h) art = "kurz"; else { art = "voll"; e.letzteVoll = h; speichereEinst(e); } }
    else art = "voll";
  }
  if(!art) return null;
  if(art !== "bild" && ruhigGewuenscht()) art = "ruhig";
  return { art, bildT };
}

/* ---------- 4 TON (Web Audio, komplett synthetisiert) --------------------- */
// Kurzformen für Parameter-Automationen
const sv = (p, v, t)=> p.setValueAtTime(v, t), lr = (p, v, t)=> p.linearRampToValueAtTime(v, t), er = (p, v, t)=> p.exponentialRampToValueAtTime(v, t), st = (p, v, t, k)=> p.setTargetAtTime(v, t, k);
function kurve(n, fn){ const c = new Float32Array(n); for(let i=0;i<n;i++) c[i] = fn(i/(n-1)*2-1); return c; }
// Mischpult: Quellen → Bus (+ Hall-Send) → Tiefpass („unter Wasser“) → Drop-Tor → Limiter → Master → Soft-Clip (−1 dBFS)
function baueTon(ctx, t0, startAb){
  const A = { ctx, t0, startAb, T:s=> t0 + (s - startAb), r:mulberry32(4711) };
  const sr = ctx.sampleRate;
  A.nb = ctx.createBuffer(1, sr*2, sr);
  const nd = A.nb.getChannelData(0); for(let i=0;i<nd.length;i++) nd[i] = A.r()*2-1;
  const ir = ctx.createBuffer(2, floor(sr*D.ton.hallSek), sr);   // selbst erzeugte Impulsantwort
  for(let ch=0; ch<2; ch++){
    const d = ir.getChannelData(ch); let lp = 0;
    for(let i=0;i<d.length;i++){ const x=i/sr; lp += (A.r()*2-1-lp)*(0.12+0.75*exp(-x/0.5)); d[i] = lp*exp(-x/0.62)*min(1, x/0.015); }
  }
  const g = (v)=>{ const n=ctx.createGain(); n.gain.value=v; return n; };
  A.bus = g(1); A.hallIn = g(1);
  const hall = ctx.createConvolver(); hall.buffer = ir;
  const hallOut = g(0.85); A.hallIn.connect(hall); hall.connect(hallOut); hallOut.connect(A.bus);
  const sh = ctx.createWaveShaper(); sh.curve = kurve(1024, x=>tanh(2.4*x)/tanh(2.4)); sh.connect(A.bus);
  A.satt = g(0.41); A.satt.connect(sh);   // vorgeschaltet: leise Signale bleiben gleich laut, nur Spitzen sättigen
  A.warm = kurve(1024, x=>tanh(1.8*x)/tanh(1.8));
  A.uw = ctx.createBiquadFilter(); A.uw.type = "lowpass"; A.uw.frequency.value = 18000; A.uw.Q.value = 0.6;
  A.tor = g(1);
  // Nur ein Limiter gegen Spitzen — ein Kompressor davor hebt (Chromium: automatische Aufholverstärkung) leise Stellen an und nimmt die Dynamik
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -6; lim.knee.value = 2; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.2;
  A.master = g(0); A.stumm = g(1);
  const clip = ctx.createWaveShaper(); clip.curve = kurve(2048, x=>0.87*tanh(0.62*x)/tanh(0.62));
  A.bus.connect(A.uw); A.uw.connect(A.tor); A.tor.connect(lim); lim.connect(A.master);
  A.master.connect(A.stumm); A.stumm.connect(clip); clip.connect(ctx.destination);
  // feste Automationen: Einblenden, Unterwasser im Verlust, absolute Stille im Drop
  const T = A.T, t1 = max(t0, T(0));
  sv(A.master.gain, 0, t0);
  lr(A.master.gain, D.ton.lautstaerke, t0 + D.ton.einblenden);
  if(startAb < D.akte.disziplin[0]){
    sv(A.uw.frequency, 18000, max(t1, T(4.44)));
    er(A.uw.frequency, 420, max(t1, T(4.98)));
    sv(A.uw.frequency, 420, max(t1, T(6.3)));       // GEÄNDERT (2026-10-16): taucht mit dem Sog auf
    er(A.uw.frequency, 18000, max(t1, T(6.6)));
  }
  if(startAb < D.akte.drop[0]){
    sv(A.tor.gain, 1, T(13.6) - 0.008);
    lr(A.tor.gain, 0, T(13.6));
    sv(A.tor.gain, 0, T(13.93));
    lr(A.tor.gain, 1, T(13.94));
  }
  A.plan = tonPlan(startAb);
  A.idx = 0;
  return A;
}
// verbindet eine Stimme mit dem Bus (optional Hall-Send und Panorama)
function ziel(A, n, hall, pan, satt){
  let o = n;
  if(pan && A.ctx.createStereoPanner){ const p = A.ctx.createStereoPanner(); p.pan.value = pan; o.connect(p); o = p; }
  o.connect(satt ? A.satt : A.bus);
  if(hall){ const s = A.ctx.createGain(); s.gain.value = hall; o.connect(s); s.connect(A.hallIn); }
}
function rausch(A, T, dauer){ const s = A.ctx.createBufferSource(); s.buffer = A.nb; s.loop = true; s.start(T, A.r()*1.5); s.stop(T + dauer + 0.05); return s; }
function filt(A, typ, f, q){ const b = A.ctx.createBiquadFilter(); b.type = typ; b.frequency.value = f; b.Q.value = q == null ? 0.7 : q; return b; }
function hk(A, T, a, peak, d){ const v = A.ctx.createGain(); sv(v.gain, 0, T); lr(v.gain, peak, T + a); er(v.gain, 0.0001, T + a + d); sv(v.gain, 0, T + a + d + 0.01); return v; }
function osz(A, typ, f, T, dauer){ const o = A.ctx.createOscillator(); o.type = typ; o.frequency.value = f; o.start(T); o.stop(T + dauer); return o; }
const I = {   // Instrumente; s = Drehbuch-Zeit
  tick(A, s, g, pan){ const T = A.T(s);
    const n = rausch(A, T, 0.05), f = filt(A, "bandpass", 3400, 5), v = hk(A, T, 0.0015, g, 0.035); n.connect(f); f.connect(v); ziel(A, v, 0.12, pan);
    const o = osz(A, "sine", 1900, T, 0.03), v2 = hk(A, T, 0.001, g*0.35, 0.022); o.connect(v2); ziel(A, v2, 0.1, pan); },
  klick(A, s, g, pan){ const T = A.T(s);
    const n = rausch(A, T, 0.012), f = filt(A, "highpass", 4500), v = hk(A, T, 0.0008, g, 0.006); n.connect(f); f.connect(v); ziel(A, v, 0.05, pan); },
  schlag(A, T, g){ const o = osz(A, "sine", 62, T, 0.25); sv(o.frequency, 64, T); er(o.frequency, 37, T + 0.12);
    const v = hk(A, T, 0.004, g, 0.17); o.connect(v); ziel(A, v, 0, 0, true); },
  herz(A, s, g){ const T = A.T(s); I.schlag(A, T, g); I.schlag(A, T + 0.19, g*0.62); },
  puls(A, s, g){ const T = A.T(s), lp = filt(A, "lowpass", 380, 1), v = hk(A, T, 0.006, g, 0.5);
    osz(A, "sine", 55, T, 0.6).connect(lp); const t2 = osz(A, "triangle", 110, T, 0.6), v2 = A.ctx.createGain(); v2.gain.value = 0.3; t2.connect(v2); v2.connect(lp);
    lp.connect(v); ziel(A, v, 0.15, 0, true); },
  boom(A, s, g){ const T = A.T(s), o = osz(A, "sine", 65, T, 3);
    sv(o.frequency, 65, T); er(o.frequency, 30, T + 1.4);
    const v = A.ctx.createGain(); sv(v.gain, 0, T); lr(v.gain, g, T + 0.006); st(v.gain, 0, T + 0.06, 0.6);
    o.connect(v); ziel(A, v, 0.1, 0, true);
    const n = rausch(A, T, 0.2), f = filt(A, "lowpass", 160, 0.8), v2 = hk(A, T, 0.003, g*0.5, 0.14); n.connect(f); f.connect(v2); ziel(A, v2, 0, 0, true); },
  braam(A, s, dauer, g){ const T = A.T(s), c = A.ctx, lp = filt(A, "lowpass", 90, 1.6);
    sv(lp.frequency, 90, T); er(lp.frequency, 1500, T + 0.16); er(lp.frequency, 230, T + dauer*0.7);
    const sh = c.createWaveShaper(); sh.curve = A.warm;
    const v = c.createGain(); sv(v.gain, 0, T); lr(v.gain, g, T + 0.035); st(v.gain, g*0.5, T + 0.08, 0.25); st(v.gain, 0, T + 0.6, dauer/3);
    [[41.2,1],[61.74,.7],[82.41,.8],[123.47,.42],[164.81,.22]].forEach(([f,l])=>{
      [-7,7].forEach(ct=>{ const o = osz(A, "sawtooth", f, T, dauer + 0.6); o.detune.value = ct; const m = c.createGain(); m.gain.value = l*0.22; o.connect(m); m.connect(lp); });
    });
    lp.connect(sh); sh.connect(v); ziel(A, v, 0.55); },
  riser(A, s0, s1, g){ const T0 = A.T(s0), T1 = A.T(s1), d = T1 - T0;
    const n = rausch(A, T0, d + 0.02), f = filt(A, "bandpass", 300, 1.3);
    sv(f.frequency, 300, T0); er(f.frequency, 5200, T1);
    const v = A.ctx.createGain(); sv(v.gain, 0.0001, T0); er(v.gain, g, T1 - 0.012); lr(v.gain, 0, T1);
    n.connect(f); f.connect(v); ziel(A, v, 0.2);
    const o = osz(A, "sawtooth", 70, T0, d + 0.02); sv(o.frequency, 70, T0); er(o.frequency, 300, T1);
    const lp = filt(A, "lowpass", 1400, 0.8), v2 = A.ctx.createGain(); sv(v2.gain, 0.0001, T0); er(v2.gain, g*0.35, T1 - 0.012); lr(v2.gain, 0, T1);
    o.connect(lp); lp.connect(v2); ziel(A, v2, 0.2); },
  swell(A, sEnde, dauer, g){ const T1 = A.T(sEnde), T0 = T1 - dauer;   // umgekehrtes Becken
    const n = rausch(A, T0, dauer + 0.02), f = filt(A, "highpass", 2200, 0.7);
    const v = A.ctx.createGain(); sv(v.gain, 0.0001, T0); er(v.gain, g, T1 - 0.01); lr(v.gain, 0, T1);
    n.connect(f); f.connect(v); ziel(A, v, 0.3); },
  whoosh(A, s, dauer, g){ const T = A.T(s), n = rausch(A, T, dauer), f = filt(A, "bandpass", 500, 0.9);
    sv(f.frequency, 500, T); er(f.frequency, 3200, T + dauer*0.45); er(f.frequency, 700, T + dauer);
    const v = A.ctx.createGain(); sv(v.gain, 0, T); lr(v.gain, g, T + dauer*0.4); lr(v.gain, 0, T + dauer);
    n.connect(f); f.connect(v); ziel(A, v, 0.25); },
  staccato(A, s, g, f){ const T = A.T(s), lp = filt(A, "lowpass", 1300, 2.5), v = hk(A, T, 0.003, g, 0.1);
    [[f,1],[f*1.006,1],[f*2,.4]].forEach(([fr,l])=>{ const o = osz(A, "sawtooth", fr, T, 0.15), m = A.ctx.createGain(); m.gain.value = l*0.4; o.connect(m); m.connect(lp); });
    lp.connect(v); ziel(A, v, 0.15); },
  flaeche(A, s0, s1, g){ const T0 = A.T(s0), T1 = A.T(s1), c = A.ctx, lp = filt(A, "lowpass", 700, 0.7);
    sv(lp.frequency, 700, max(T0, A.T(11.0))); er(lp.frequency, 2600, A.T(13.55));
    const v = c.createGain(); sv(v.gain, 0, T0); lr(v.gain, g, T0 + 1.0); sv(v.gain, g, A.T(11.0)); lr(v.gain, g*1.8, A.T(13.55)); lr(v.gain, 0, T1);
    const nrm = c.createGain(); nrm.gain.value = 0.125; nrm.connect(lp);
    [110, 164.81, 246.94, 261.63].forEach(f=>[-5,5].forEach(ct=>{ const o = osz(A, "triangle", f, T0, T1 - T0 + 0.05); o.detune.value = ct; o.connect(nrm); }));
    lp.connect(v); ziel(A, v, 0.4); },
  drone(A, s0, s1, g){ const T0 = A.T(s0), T1 = A.T(s1), c = A.ctx, lp = filt(A, "lowpass", 240, 0.7);
    const v = c.createGain(); sv(v.gain, 0, T0); lr(v.gain, g, T0 + 1.4); sv(v.gain, g, T1 - 0.02); lr(v.gain, 0, T1);
    [[55,1],[82.6,.6],[110.4,.25]].forEach(([f,l])=>{ const o = osz(A, "sine", f, T0, T1 - T0 + 0.05), m = c.createGain(); m.gain.value = l; o.connect(m); m.connect(lp); });
    const n = rausch(A, T0, T1 - T0), m2 = c.createGain(); m2.gain.value = 0.35; n.connect(m2); m2.connect(lp);
    lp.connect(v); ziel(A, v, 0.2, 0, true); },
  glitch(A, s, g){ for(let i=0;i<4;i++) I.klick(A, s + i*0.018, g*(1 - i*0.15), (i%2 ? 0.5 : -0.5)); },   // NEU (2026-10-16): digitales Stottern auf dem Schnitt
  schimmer(A, s, dauer, g){ const T = A.T(s), c = A.ctx, v = c.createGain();
    sv(v.gain, 0, T); lr(v.gain, g, T + 0.25); st(v.gain, 0, T + 0.4, dauer/3);
    [1318.5, 1975.5, 2637].forEach((f,i)=>{ const o = osz(A, "sine", f, T, dauer + 1); o.detune.value = (i-1)*6; o.connect(v); });
    ziel(A, v, 0.9); }
};
// Zeitplan aller Klänge (Drehbuch-Zeiten). Live wird vorausschauend geplant, offline alles sofort.
function tonPlan(startAb){
  const P = [], r = mulberry32(17), b = D.beats;
  const ev = (s, f)=>{ if(s >= startAb - 0.6) P.push({ s, f }); };
  ev(0, A=>I.drone(A, 0, 13.6, 0.03));
  ev(D.linieZuenden, A=>I.tick(A, D.linieZuenden, 0.11, 0));
  ev(1.15, A=>I.whoosh(A, 1.15, 0.5, 0.1));
  ev(1.2, A=>I.puls(A, 1.2, 0.15));
  ev(1.2, A=>I.riser(A, 1.2, 4.38, 0.15));
  for(let s=1.35, i=0; s<4.3; i++){ const q=s; ev(q, A=>I.herz(A, q, lerp(0.1, 0.19, prog(q, 1.35, 4.3)))); s += lerp(0.82, 0.46, prog(s, 1.35, 4.3)); }
  for(let s=1.25; s<4.36; ){ const q=s, p=(r()-.5)*1.4; ev(q, A=>I.klick(A, q, 0.03+r()*0.025, p)); s += 1/lerp(6, 28, prog(s, 1.25, 4.36)); }
  D.schnitte.forEach(s=>{ ev(s, A=>{ I.tick(A, s, 0.07, 0); I.puls(A, s, 0.11); I.whoosh(A, s - 0.12, 0.3, 0.06); I.glitch(A, s, 0.06); }); });
  ev(3.85, A=>I.swell(A, 4.4, 0.55, 0.035));
  ev(4.4, A=>{ I.braam(A, 4.4, 3.2, 0.2); I.boom(A, 4.4, 0.5); });
  [5.0, 5.95].forEach(s=> ev(s, A=>I.herz(A, s, 0.27)));
  // NEU (2026-10-16): Sog ins Objektiv und Match-Cut auf den Trade
  ev(6.25, A=>{ I.swell(A, 6.6, 0.35, 0.04); I.whoosh(A, 6.3, 0.32, 0.09); });
  ev(6.6, A=>{ I.boom(A, 6.6, 0.28); I.tick(A, 6.6, 0.08, 0); I.glitch(A, 6.6, 0.05); });
  ev(6.6, A=>I.flaeche(A, 6.6, 13.6, 0.045));
  ev(10.95, A=>I.whoosh(A, 10.95, 0.7, 0.08));
  ev(16.9, A=>I.whoosh(A, 16.9, 0.45, 0.07));
  for(let s=6.75, i=0; s<11.0; s+=0.45, i++){ const q=s, p=i%2?0.25:-0.25; ev(q, A=>I.tick(A, q, 0.045, p)); }
  b.forEach(s=> ev(s, A=>I.puls(A, s, 0.2)));
  ev(D.zielErreicht, A=>I.schimmer(A, D.zielErreicht, 0.9, 0.018));
  STACCATO.forEach((s,i)=>{ ev(s, A=>I.staccato(A, s, lerp(0.08, 0.22, pow(prog(s, 11.15, 13.55), 1.5)), 110)); if(i%4===0) ev(s, A=>I.herz(A, s, lerp(0.12, 0.2, prog(s, 11.15, 13.55)))); });
  ev(11.6, A=>I.riser(A, 11.6, 13.585, 0.26));
  ev(13.95, A=>I.swell(A, 14.2, 0.25, 0.03));
  ev(14.2, A=>{ I.boom(A, 14.2, 0.62); I.braam(A, 14.2, 4.6, 0.22); I.schimmer(A, 14.2, 2.2, 0.024); });
  return P.sort((x,y)=>x.s-y.s);
}
function tonPlanen(A, bisS){ while(A.idx < A.plan.length && A.plan[A.idx].s <= bisS){ try{ A.plan[A.idx].f(A); }catch(e){} A.idx++; } }
function tonAusblenden(A, dauer, beiT){
  const g = A.master.gain, t = beiT == null ? A.ctx.currentTime : beiT;
  if(g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t); else { g.cancelScheduledValues(t); sv(g, g.value, t); }
  lr(g, 0, t + dauer);
}
function tonSchliessen(A){ try{ A.ctx.close(); }catch(e){} }
function tonStumm(A, aus){ try{ const g = A.stumm.gain, t = A.ctx.currentTime; g.cancelScheduledValues(t); st(g, aus ? 0 : 1, t, 0.05); }catch(e){} }
// Für Tests/Abnahme: rendert den Ton offline (Spitzenpegel, WAV, Knackser beim Überspringen)
function tonOffline(opt){
  opt = opt || {};
  const sr = opt.sr || 48000, dauer = opt.dauer || 21.5;
  const c = new OfflineAudioContext(2, ceil(sr*dauer), sr);
  const A = baueTon(c, 0.05, opt.startAb || 0);
  tonPlanen(A, 1e9);
  if(opt.abbruchBei != null) tonAusblenden(A, D.ton.ausblenden, A.T(opt.abbruchBei));
  return c.startRendering();
}

/* ---------- 5 BILD (WebGL) ------------------------------------------------- */
const GLSL_VOLL = "attribute vec2 aP;varying vec2 vUv;void main(){vUv=aP*.5+.5;gl_Position=vec4(aP,0.,1.);}";
const GLSL_BG = `precision highp float;varying vec2 vUv;
uniform vec2 uRes;uniform float uT,uOut;uniform vec3 uHaze,uLC,uL;uniform vec2 uLP;uniform vec4 uB1,uB2;uniform vec3 uB1C,uB2C;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
vec3 band(vec2 q,vec4 b,vec3 c){vec2 d=vec2(cos(b.w),sin(b.w));float s=dot(q,d)-b.x;return c*b.z*exp(-s*s/(b.y*b.y));}
void main(){float asp=uRes.x/uRes.y;vec2 q=vUv*vec2(asp,1.);vec2 p=(vUv-uLP)*vec2(asp,1.);float r=length(p);vec2 dr=p/max(r,1e-4);
float ray=n2(dr*4.+vec2(uT*.07,0.))*.6+n2(dr*11.-vec2(0.,uT*.05))*.4;ray=pow(ray,2.4)*1.4;float fa=exp(-r*1.7);
vec3 c=uHaze*(1.-.55*length((vUv-.5)*vec2(1.,1.25)));
c+=uLC*uL.x*(fa*fa*.3+ray*fa*uL.y+exp(-r*r*70.)*uL.z);
c+=band(q,uB1,uB1C)+band(q,uB2,uB2C);gl_FragColor=vec4(c*uOut,0.);}`;
const GLSL_LINIE_V = `attribute vec3 aP,aA,aB;attribute float aS;attribute vec4 aC;attribute float aW;
uniform mat4 uVP,uV;uniform vec2 uAsp;uniform float uWS,uPx,uFok,uBl,uOrtho;
varying vec4 vC;varying float vD,vH,vB,vT;
vec2 sc(vec3 p){vec4 c=uVP*vec4(p,1.);return c.xy/c.w*uAsp;}
void main(){vec4 c=uVP*vec4(aP,1.);vec2 s=c.xy/c.w*uAsp,a=sc(aA),b=sc(aB);vec2 d1=s-a,d2=b-s;
if(dot(d1,d1)<1e-12)d1=d2;if(dot(d2,d2)<1e-12)d2=d1;d1=normalize(d1+1e-9);d2=normalize(d2+1e-9);vec2 t=d1+d2;t=dot(t,t)<1e-8?d1:normalize(t);
vec2 n=vec2(-t.y,t.x);float m=1./max(dot(n,vec2(-d1.y,d1.x)),.4);
float zv=uOrtho>.5?1.:max(-(uV*vec4(aP,1.)).z,.01);float coc=uBl*abs(zv-uFok)/max(uFok,.01);
float k=uWS/(zv*uPx);float h=aW*.5*k,bl=coc*k,hh=max(h,.55);float e=h/hh*hh/(hh+bl);float tot=(hh+bl)*2.2+1.5;
c.xy+=n/uAsp*(tot*m*aS)*uPx*c.w;gl_Position=c;vD=aS*tot*m;vH=hh;vB=bl;vT=tot;vC=vec4(aC.rgb*e,aC.a);}`;
const GLSL_LINIE_F = `precision highp float;uniform float uOut;varying vec4 vC;varying float vD,vH,vB,vT;
void main(){float d=abs(vD);float aa=.7+vB;float core=1.-smoothstep(vH-aa,vH+aa,d);float halo=exp(-d*d/(vT*vT)*5.)*.24*vC.a;
gl_FragColor=vec4(vC.rgb*(core+halo)*uOut,0.);}`;
const GLSL_SPR_V = `attribute vec3 aP;attribute vec2 aQ,aG;attribute float aR;attribute vec4 aC;attribute vec3 aT;
uniform mat4 uVP,uV;uniform vec3 uRe,uUp;uniform float uWS,uPx,uFok,uBl,uOrtho;
varying vec2 vQ,vG,vZ;varying vec4 vC;varying float vTyp,vW,vAA,vCoc,vBias,vK;
void main(){float zv=uOrtho>.5?1.:max(-(uV*vec4(aP,1.)).z,.01);float px=uPx*zv/uWS;float coc=uBl*abs(zv-uFok)/max(uFok,.01);
float typ=aT.x;vec2 g=aG;vec2 gm=max(g,vec2(px*.7));float e=(g.x*g.y)/(gm.x*gm.y);g=gm;vec2 ge=g;
if(typ<1.5){ge=g+coc;e*=(g.x*g.y)/(ge.x*ge.y);if(typ>.5)e=1.;}else if(typ<2.5){e/=1.+coc/g.y*.6;}else ge=g*1.5;
float cs=cos(aR),sn=sin(aR);vec2 q=aQ*ge;q=vec2(q.x*cs-q.y*sn,q.x*sn+q.y*cs);vec3 off=aT.z>.5?uRe*q.x+uUp*q.y:vec3(q,0.);
gl_Position=uVP*vec4(aP+off,1.);vQ=aQ;vG=ge;vC=vec4(aC.rgb*e,aC.a);vTyp=typ;vW=clamp(coc/min(ge.x,ge.y),0.,1.);vAA=px;vCoc=coc;
vBias=log2(1.+coc/px*.35);vZ=vec2(mod(aT.y,4.),floor(aT.y/4.+.001));vK=aT.y;}`;
const GLSL_SPR_F = `precision highp float;uniform sampler2D uTex;uniform float uOut;
varying vec2 vQ,vG,vZ;varying vec4 vC;varying float vTyp,vW,vAA,vCoc,vBias,vK;
void main(){vec2 q=vQ;vec3 c;float a=0.;
if(vTyp<.5){float r=length(q);float s=exp(-r*r*5.);float dk=(1.-smoothstep(.8,1.,r))*(.72+.28*smoothstep(.4,.95,r));c=vC.rgb*mix(s,dk*.9,vW);}
else if(vTyp<1.5){vec2 p=abs(q)*vG;float aa=max(vAA,vCoc);vec2 d=p-(vG-vec2(vCoc));float k=max(d.x,d.y);
float fill=1.-smoothstep(-aa,aa,k);float rim=fill*(1.-smoothstep(0.,aa*2.5+vAA*1.5,-k));c=vC.rgb*(fill*(.2+.16*(q.y*.5+.5))+rim*vK*(1.-vW*.85));a=fill*vC.a;}
else if(vTyp<2.5){vec2 uv=vec2((vZ.x+q.x*.5+.5)*.25,(vZ.y+.5-q.y*.5)*.0625);c=vC.rgb*texture2D(uTex,uv,vBias).a;}
else{c=vC.rgb*exp(-dot(q,q)*vK*2.25);}
gl_FragColor=vec4(c*uOut,a);}`;
const GLSL_HELL = `precision highp float;
#define T(o) texture2D(uS,vUv+(o)).rgb
varying vec2 vUv;uniform sampler2D uS;uniform vec2 uTx;uniform float uThr;
void main(){vec3 c=(T(uTx*vec2(-1,-1))+T(uTx*vec2(1,-1))+T(uTx*vec2(-1,1))+T(uTx))*.25;
float l=max(c.r,max(c.g,c.b));float kn=uThr*.5;float s=clamp(l-uThr+kn,0.,2.*kn);s=s*s/(4.*kn+1e-5);gl_FragColor=vec4(c*max(s,l-uThr)/max(l,1e-5),1.);}`;
const GLSL_RUNTER = `precision highp float;
#define T(o) texture2D(uS,vUv+(o)).rgb
varying vec2 vUv;uniform sampler2D uS;uniform vec2 uTx;
void main(){vec3 c=T(vec2(0.))*4.;c+=T(-uTx)+T(uTx)+T(vec2(uTx.x,-uTx.y))+texture2D(uS,vUv-vec2(uTx.x,-uTx.y)).rgb;gl_FragColor=vec4(c/8.,1.);}`;
const GLSL_HOCH = `precision highp float;
#define T(o) texture2D(uS,vUv+(o)).rgb
varying vec2 vUv;uniform sampler2D uS;uniform vec2 uTx;uniform float uK;
void main(){vec3 c=T(vec2(-uTx.x*2.,0.))+T(vec2(uTx.x*2.,0.))+T(vec2(0.,uTx.y*2.))+T(vec2(0.,-uTx.y*2.));
c+=(T(uTx)+T(-uTx)+T(vec2(uTx.x,-uTx.y))+T(vec2(-uTx.x,uTx.y)))*2.;gl_FragColor=vec4(c/12.*uK,1.);}`;
const GLSL_STREAK = `precision highp float;
#define T(o) texture2D(uS,vUv+(o)).rgb
varying vec2 vUv;uniform sampler2D uS;uniform vec2 uTx;
void main(){vec3 c=T(vec2(0.))*.2;c+=(T(uTx)+T(-uTx))*.17;c+=(T(uTx*2.)+texture2D(uS,vUv-uTx*2.).rgb)*.12;
c+=(T(uTx*3.)+texture2D(uS,vUv-uTx*3.).rgb)*.07;c+=(T(uTx*4.)+texture2D(uS,vUv-uTx*4.).rgb)*.04;gl_FragColor=vec4(c,1.);}`;
const GLSL_COMP = `precision highp float;varying vec2 vUv;uniform sampler2D uS,uBl,uSt;
uniform vec2 uRes,uVel,uLeak;uniform float uT,uIn,uBS,uSS,uExp,uCA,uKorn,uVig,uUW,uSat,uZoom,uGl,uWv;uniform vec3 uSchatten,uLichter,uStC;
float h2(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
vec3 aces(vec3 x){return clamp(x*(2.51*x+.03)/(x*(2.43*x+.59)+.14),0.,1.);}
void main(){vec2 uv=vUv+vec2(sin(uT*37.)+sin(uT*13.),cos(uT*29.)+sin(uT*17.))*.00025*uWv;
if(uUW>0.)uv+=vec2(sin(uv.y*16.+uT*1.7),cos(uv.x*13.+uT*1.3))*.0007*uUW;
if(uGl>0.){float b=floor(uv.y*26.)+floor(uT*24.)*7.;uv.x+=(h2(vec2(b,3.))-.5)*.05*uGl*step(.55,h2(vec2(b,9.)));}
vec2 d=uv-.5;vec2 ca=d*dot(d,d)*uCA+vec2(.009*uGl,0.);vec3 c=vec3(0.);
if(uZoom>0.){for(int i=0;i<10;i++){vec2 q=.5+d*(1.-uZoom*float(i)/9.);c+=vec3(texture2D(uS,q+ca).r,texture2D(uS,q).g,texture2D(uS,q-ca).b);}c/=10.;}
else if(dot(uVel,uVel)>1e-8){for(int i=0;i<8;i++){vec2 o=uVel*(float(i)/7.-.5);c+=vec3(texture2D(uS,uv+o+ca).r,texture2D(uS,uv+o).g,texture2D(uS,uv+o-ca).b);}c/=8.;}
else c=vec3(texture2D(uS,uv+ca).r,texture2D(uS,uv).g,texture2D(uS,uv-ca).b);
c*=uIn;c+=texture2D(uBl,uv).rgb*uIn*uBS;c+=texture2D(uSt,uv).rgb*uIn*uSS*uStC;c*=uExp;
c+=vec3(1.,.52,.2)*uLeak.y*.22*exp(-pow((vUv.x-uLeak.x)*2.4,2.))*(.35+.65*vUv.y);
float l=dot(c,vec3(.2126,.7152,.0722));
c=mix(c,vec3(l)*vec3(.6,.95,1.05)+uSchatten*.6,uUW*.3);
c+=uSchatten*(1.-smoothstep(0.,.3,l));c*=mix(vec3(1.),uLichter,smoothstep(.2,1.2,l));c=max(mix(vec3(l),c,uSat),0.);
c=aces(c);vec2 v=d*vec2(mix(1.,uRes.x/uRes.y,.5),1.);c*=mix(1.,smoothstep(.95,.18,length(v)*1.25),uVig);
c=pow(c,vec3(1./2.2));float n=h2(gl_FragCoord.xy+fract(uT*7.31)*97.)-.5;c+=n*uKorn*(.4+.6*sqrt(max(l,0.)));
c+=(h2(gl_FragCoord.xy*1.37+3.1)-.5)/255.;gl_FragColor=vec4(c,1.);}`;

const LV_ST = 15, SP_ST = 15, MAXLV = 60000, MAXLI = 90000, MAXS = 4000;
const LV = new Float32Array(MAXLV*LV_ST), LI = new Uint16Array(MAXLI), SV = new Float32Array(MAXS*4*SP_ST);
let nLV = 0, nLI = 0, nS = 0;
const EB = [0,1,2,3].map(()=>({ P:M.neu(), V:M.neu(), VP:M.neu(), re:[1,0,0], up:[0,1,0], ws:1, ortho:0, fok:10, bl:0, l0:0, s0:0 }));
let nEb = 0, eb = null;
let W = null;      // Welt (Zufallsdaten des Tages)
let L = null;      // Bildschirm-Maße
const C = {};      // Farben linear
for(const k in D.farben) C[k] = hexLin(D.farben[k]);

function glAnlegen(canvas){
  const at = { alpha:false, antialias:false, depth:false, stencil:false, premultipliedAlpha:true, preserveDrawingBuffer:false, powerPreference:"high-performance" };
  let gl = null, v2 = false;
  try{ gl = canvas.getContext("webgl2", at); v2 = !!gl; if(!gl) gl = canvas.getContext("webgl", at) || canvas.getContext("experimental-webgl", at); }catch(e){ gl = null; }
  if(!gl) return null;
  const g = { gl, v2 };
  const sh = (typ, src)=>{ const s = gl.createShader(typ); gl.shaderSource(s, src); gl.compileShader(s); if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error("Shader: " + gl.getShaderInfoLog(s)); return s; };
  const pr = (vs, fs, attrs)=>{
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    attrs.forEach((n,i)=> gl.bindAttribLocation(p, i, n)); gl.linkProgram(p);
    if(!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("Programm: " + gl.getProgramInfoLog(p));
    p.u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for(let i=0;i<n;i++){ const u = gl.getActiveUniform(p, i); p.u[u.name] = gl.getUniformLocation(p, u.name); }
    return p;
  };
  g.pBg = pr(GLSL_VOLL, GLSL_BG, ["aP"]);
  g.pLin = pr(GLSL_LINIE_V, GLSL_LINIE_F, ["aP","aA","aB","aS","aC","aW"]);
  g.pSpr = pr(GLSL_SPR_V, GLSL_SPR_F, ["aP","aQ","aG","aR","aC","aT"]);
  g.pHell = pr(GLSL_VOLL, GLSL_HELL, ["aP"]); g.pRunter = pr(GLSL_VOLL, GLSL_RUNTER, ["aP"]);
  g.pHoch = pr(GLSL_VOLL, GLSL_HOCH, ["aP"]); g.pStreak = pr(GLSL_VOLL, GLSL_STREAK, ["aP"]); g.pComp = pr(GLSL_VOLL, GLSL_COMP, ["aP"]);
  g.bVoll = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, g.bVoll); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
  g.bLV = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, g.bLV); gl.bufferData(gl.ARRAY_BUFFER, LV.byteLength, gl.DYNAMIC_DRAW);
  g.bLI = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.bLI); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, LI.byteLength, gl.DYNAMIC_DRAW);
  g.bSV = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, g.bSV); gl.bufferData(gl.ARRAY_BUFFER, SV.byteLength, gl.DYNAMIC_DRAW);
  const si = new Uint16Array(MAXS*6); for(let i=0;i<MAXS;i++){ const v=i*4, o=i*6; si[o]=v; si[o+1]=v+1; si[o+2]=v+2; si[o+3]=v; si[o+4]=v+2; si[o+5]=v+3; }
  g.bSI = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.bSI); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, si, gl.STATIC_DRAW);
  // Render-Target-Format: Half-Float (HDR) wenn möglich, sonst 8 bit mit Skalierung
  const fm = [];
  if(v2){ if(gl.getExtension("EXT_color_buffer_float") || gl.getExtension("EXT_color_buffer_half_float")) fm.push({ i:gl.RGBA16F, t:gl.HALF_FLOAT, out:1 }); }
  else { const hf = gl.getExtension("OES_texture_half_float"); if(hf && gl.getExtension("OES_texture_half_float_linear")){ gl.getExtension("EXT_color_buffer_half_float"); fm.push({ i:gl.RGBA, t:hf.HALF_FLOAT_OES, out:1 }); } }
  fm.push({ i:gl.RGBA, t:gl.UNSIGNED_BYTE, out:0.25 });
  for(const f of fm){ g.fmt = f; const r = rtNeu(g, 4, 4); const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; rtWeg(g, r); if(ok) break; }
  g.atlas = atlasBauen(g);
  g.verlust = gl.getExtension("WEBGL_lose_context");
  return g;
}
function rtNeu(g, w, h){
  const gl = g.gl, t = gl.createTexture(); w = max(2, w|0); h = max(2, h|0);
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, g.fmt.i, w, h, 0, gl.RGBA, g.fmt.t, null);
  const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  return { t, f, w, h };
}
function rtWeg(g, r){ if(r){ g.gl.deleteTexture(r.t); g.gl.deleteFramebuffer(r.f); } }
function rtsAnlegen(g, w, h){
  (g.rts || []).forEach(r=> rtWeg(g, r));
  g.S = rtNeu(g, w, h); g.B = []; let bw = w, bh = h;
  for(let i=0;i<5;i++){ bw = max(2, bw>>1); bh = max(2, bh>>1); g.B.push(rtNeu(g, bw, bh)); }
  g.St0 = rtNeu(g, w>>2, h>>4); g.St1 = rtNeu(g, w>>2, h>>4);
  g.rts = [g.S, g.St0, g.St1].concat(g.B);
}
// Zahlen-Atlas für Bokeh-Kursziffern und Beschriftungen (Canvas 2D, Systemschrift, mit Mipmaps)
const Z_SL = 36, Z_ENTRY = 37, Z_STOP = 38, Z_ZIEL = 39, Z_LABEL = { "5":40, "15":41, "2":42, "C":43 }, Z_PREIS = 44, Z_PAAR = 47;   // GEÄNDERT (2026-10-16)
function atlasBauen(g){
  const gl = g.gl, cv = document.createElement("canvas"); cv.width = cv.height = 1024;
  const x = cv.getContext("2d"), r = mulberry32(1234), txt = [];
  const fmt = (v, d)=> v.toFixed(d).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  for(let i=0;i<36;i++){
    const k = i % 4;
    if(k === 0) txt.push(fmt(4800 + r()*90, 2)); else if(k === 1) txt.push(fmt(17880 + r()*140, 1));
    else if(k === 2) txt.push(fmt(1.08 + r()*0.01, 4)); else txt.push(String(9 + (r()*6|0)).padStart(2,"0") + ":" + String(r()*60|0).padStart(2,"0") + ":" + String(r()*60|0).padStart(2,"0"));
  }
  const pz = (v)=> v.toFixed(5).replace(".", ",");
  txt.push("SL", "ENTRY", "STOP", "ZIEL", "5", "15", "2", "C", pz(D.trade.ziel), pz(D.trade.entry), pz(D.trade.stop), D.trade.paar);
  x.fillStyle = "#fff"; x.textAlign = "center"; x.textBaseline = "middle";
  txt.forEach((s,i)=>{
    const lab = i >= 36;
    x.font = (lab ? "600 30px " : "500 38px ") + "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif";
    if("letterSpacing" in x) x.letterSpacing = lab ? "7px" : "1px";
    x.fillText(s, (i%4)*256 + 128, floor(i/4)*64 + 33);
  });
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
function glFreigeben(g){
  try{ const gl = g.gl; (g.rts || []).forEach(r=> rtWeg(g, r)); gl.deleteTexture(g.atlas); [g.bVoll,g.bLV,g.bLI,g.bSV,g.bSI].forEach(b=> gl.deleteBuffer(b));
    [g.pBg,g.pLin,g.pSpr,g.pHell,g.pRunter,g.pHoch,g.pStreak,g.pComp].forEach(p=> gl.deleteProgram(p));
    if(g.verlust) g.verlust.loseContext(); }catch(e){}
}

/* --- Kamera & Ebenen --- */
// Abstand, bei dem ein Bereich (halbe Breite/Höhe) im Bildausschnitt zwischen den Balken Platz hat
function abstand(hw, hh, fov){ const t = tan(fov*PI/360); return max(hh/t, hw/(t*L.aspI)); }
function vpAus(k, P, V, VP){
  const tanH = tan(k.fov*PI/360)/L.sInh;
  M.persp(P, tanH, L.asp, 0.05, 900); M.blick(V, k.pos, k.tgt, (k.roll||0)*PI/180); M.mal(VP, P, V);
  if(k.shiftY){ const sy = k.shiftY*L.sInh; for(let c=0;c<4;c++) VP[c*4+1] += sy*VP[c*4+3]; }
}
function ebeneKamera(k){
  eb = EB[nEb++]; vpAus(k, eb.P, eb.V, eb.VP);
  eb.ws = eb.P[5]; eb.ortho = 0; eb.fok = k.fok != null ? k.fok : dist3(k.pos, k.tgt); eb.bl = k.bl || 0;
  eb.re = [eb.V[0], eb.V[4], eb.V[8]]; eb.up = [eb.V[1], eb.V[5], eb.V[9]]; eb.l0 = nLI; eb.s0 = nS; eb.kam = k;
  return eb;
}
function ebeneOrtho(){   // Welt = CSS-Pixel (y nach unten)
  eb = EB[nEb++]; const VP = eb.VP; VP.fill(0); VP[0] = 2/L.w; VP[5] = -2/L.h; VP[10] = -1; VP[12] = -1; VP[13] = 1; VP[15] = 1;
  eb.V.fill(0); eb.V[0] = eb.V[5] = eb.V[10] = eb.V[15] = 1;
  eb.ws = 2/L.h; eb.ortho = 1; eb.fok = 1; eb.bl = 0; eb.re = [1,0,0]; eb.up = [0,1,0]; eb.l0 = nLI; eb.s0 = nS;
  return eb;
}
const zv = (x,y,z)=>{ const V = eb.V; return -(V[2]*x + V[6]*y + V[10]*z + V[14]); };
function aufSchirm(VP, p){ const x = VP[0]*p[0]+VP[4]*p[1]+VP[8]*p[2]+VP[12], y = VP[1]*p[0]+VP[5]*p[1]+VP[9]*p[2]+VP[13], w = VP[3]*p[0]+VP[7]*p[1]+VP[11]*p[2]+VP[15]; return [x/w*.5+.5, y/w*.5+.5, w]; }

/* --- Geometrie ausgeben --- */
const NAH = 0.12, PKT = new Float32Array(3*1500), CT = [0,0,0,0];
function linie(P, n, farbe, breite, fn){
  let a = -1;
  for(let i=0;i<=n;i++){
    let ok = i < n;
    if(ok && !eb.ortho) ok = zv(P[i*3], P[i*3+1], P[i*3+2]) > NAH;
    if(ok){ if(a < 0) a = i; } else if(a >= 0){ streifen(P, a, i, farbe, breite, fn); a = -1; }
  }
}
function streifen(P, a, b, farbe, breite, fn){
  const k = b - a; if(k < 2 || nLV + 2*k > MAXLV || nLI + 6*(k-1) > MAXLI) return;
  const base = nLV;
  for(let i=a;i<b;i++){
    const x = P[i*3], y = P[i*3+1], z = P[i*3+2];
    let px, py, pz, qx, qy, qz;
    if(i > a){ px = P[i*3-3]; py = P[i*3-2]; pz = P[i*3-1]; } else { px = 2*x-P[i*3+3]; py = 2*y-P[i*3+4]; pz = 2*z-P[i*3+5]; }
    if(i < b-1){ qx = P[i*3+3]; qy = P[i*3+4]; qz = P[i*3+5]; } else { qx = 2*x-px; qy = 2*y-py; qz = 2*z-pz; }
    const c = fn ? (fn(i, CT), CT) : farbe;
    for(let s=-1;s<=1;s+=2){ let o = nLV*LV_ST; LV[o++]=x;LV[o++]=y;LV[o++]=z;LV[o++]=px;LV[o++]=py;LV[o++]=pz;LV[o++]=qx;LV[o++]=qy;LV[o++]=qz;LV[o++]=s;LV[o++]=c[0];LV[o++]=c[1];LV[o++]=c[2];LV[o++]=c[3];LV[o++]=breite; nLV++; }
  }
  for(let j=0;j<k-1;j++){ const v = base + j*2; LI[nLI++]=v; LI[nLI++]=v+1; LI[nLI++]=v+2; LI[nLI++]=v+1; LI[nLI++]=v+3; LI[nLI++]=v+2; }
}
function strecke(x0,y0,z0,x1,y1,z1,farbe,breite){ PKT[0]=x0;PKT[1]=y0;PKT[2]=z0;PKT[3]=x1;PKT[4]=y1;PKT[5]=z1; linie(PKT, 2, farbe, breite); }
const QE = [-1,-1, 1,-1, 1,1, -1,1];
// Typ 0 = Punkt/Bokeh, 1 = Kerze (Rechteck mit Randlicht), 2 = Schrift (Atlas), 3 = weiches Licht (k = Schärfe)
function spr(x,y,z, gx,gy, rot, c, i, a, typ, zelle, bb){
  if(nS >= MAXS || i <= 0.0005) return;
  if(!eb.ortho && zv(x,y,z) < NAH) return;
  let o = nS*4*SP_ST;
  for(let q=0;q<4;q++){ SV[o++]=x;SV[o++]=y;SV[o++]=z;SV[o++]=QE[q*2];SV[o++]=QE[q*2+1];SV[o++]=gx;SV[o++]=gy;SV[o++]=rot;SV[o++]=c[0]*i;SV[o++]=c[1]*i;SV[o++]=c[2]*i;SV[o++]=a;SV[o++]=typ;SV[o++]=zelle;SV[o++]=bb; }
  nS++;
}

/* --- Welt: alle Zufallsdaten des Tages (Seed = Datum) --- */
function baueWelt(seed, hoch){
  const R = mulberry32(seed), w = {};
  const X0 = -10, DX = 0.1, N = 1151, y = new Float32Array(N);
  let v = 0, vol = 0.22;
  for(let i=0;i<N;i++){
    vol += (0.22-vol)*0.03 + (R()-0.5)*0.05; vol = clamp(vol, 0.06, 0.55);
    if(R() < 0.015) v += (R()<0.5?-1:1)*(0.6 + R()*1.2);
    v += (R()-0.5)*vol; v *= 0.992; y[i] = v;
  }
  const yg = new Float32Array(N);
  for(let i=0;i<N;i++) yg[i] = (y[max(0,i-1)] + 2*y[i] + y[min(N-1,i+1)])/4;
  let mx = 0; for(let i=180;i<N;i++) mx = max(mx, abs(yg[i]));
  const sk = 2.6/(mx||1); for(let i=0;i<N;i++) yg[i] *= sk;
  const glatt = (fen)=>{ const o = new Float32Array(N); for(let i=0;i<N;i++){ let s=0, n=0; for(let j=max(0,i-fen); j<=min(N-1,i+fen); j++){ s+=yg[j]; n++; } o[i]=s/n; } return o; };
  w.kurs = { X0, DX, N, y:yg, ys:glatt(40), ym:glatt(8) };
  w.kerzen = [];
  for(let x=-9; x<104; x+=1){
    const i0 = round((x-X0)/DX), i1 = round((x+1-X0)/DX); let H=-1e9, Lo=1e9;
    for(let i=i0;i<=i1;i++){ H = max(H, yg[i]); Lo = min(Lo, yg[i]); }
    w.kerzen.push({ x, O:yg[i0], C:yg[i1], H:H+0.06, L:Lo-0.06 });
  }
  w.ziffern = [];
  for(let i=0;i<80;i++){ const nah = i < 14; w.ziffern.push({ x:-12+R()*118, y:(R()-0.5)*(nah?6:15), z:nah ? 3+R()*4.5 : -7-R()*26, zelle:(R()*36)|0, h:(nah?0.22:0.55)+R()*0.45, a:0.1+R()*0.18, dx:(R()-0.5)*0.4 }); }
  w.staub = []; for(let i=0;i<520;i++) w.staub.push([R(), R(), R(), 0.006+R()*R()*0.02, R()]);
  // Stop-Linie: Striche und ihre Scherben
  w.striche = []; w.scherben = [];
  for(let x=-8.6; x<8.6; x+=0.82){
    const c = x + 0.26, dx = c, nah = abs(dx) < 1.4 ? 1.7 : 1;
    w.striche.push({ x0:x, x1:x+0.52, tb:D.bruchTau + abs(dx)*0.012 });
    for(let k=0;k<2;k++){
      const cx = x + 0.13 + k*0.26, sg = cx >= 0 ? 1 : -1, ax = R()-0.5, ay = R()-0.5, az = R()-0.5, al = hypot(ax,ay,az)||1;
      w.scherben.push({ cx, hl:0.12+R()*0.05, tb:D.bruchTau + abs(dx)*0.012,
        vx:sg*(0.5+R()*2.0)*nah/(1+abs(dx)*0.25), vy:(R()-0.38)*2.6*nah, vz:(R()-0.3)*2.2*nah,
        ax:ax/al, ay:ay/al, az:az/al, w:5+R()*12, ph:R()*6 });
    }
  }
  w.funken = []; for(let i=0;i<150;i++){ const a = R()*PI*2, el = (R()-0.3)*1.4, sp = 2+R()*8; w.funken.push({ vx:cos(a)*sp, vy:sin(a)*sp*0.7+el, vz:(R()-0.4)*sp*0.6, g:0.008+R()*0.016, life:0.18+R()*0.35 }); }
  w.fern = new Float32Array(3*160); { let fy = 4; for(let i=0;i<160;i++){ fy += (R()-0.58)*0.9; w.fern[i*3] = -60 + i*0.75; w.fern[i*3+1] = fy; w.fern[i*3+2] = -28; } }
  // Equity-Kurve: viele kleine Trades, mit Rücksetzern, steigend
  const nT = 230, eq = [0], rs = [];
  for(let i=0;i<nT;i++){ const r = R() < 0.43 ? 1.2 + R()*1.4 : -(0.9 + R()*0.15); rs.push(r); eq.push(eq[i] + r); }
  const end = eq[nT] > 1 ? eq[nT] : 1, Wc = hoch ? 26 : 58, Hc = hoch ? 34 : 22;
  w.eq = { n:nT+1, rs, x:new Float32Array(nT+1), y:new Float32Array(nT+1) };
  w.chart = baueChart(hoch);   // NEU (2026-10-16)
  const ex = w.chart.hw + 0.7, ey = w.chart.yZiel;   // die Kurve beginnt am Ziel des Trades
  for(let i=0;i<=nT;i++){ w.eq.x[i] = ex + Wc*i/nT; w.eq.y[i] = ey + Hc*eq[i]/end; }
  let x0 = -w.chart.hw - 0.6, x1 = ex + Wc + 7, y0 = -w.chart.hh - 0.4, y1 = ey + Hc + 5;
  for(let i=0;i<=nT;i++){ y0 = min(y0, w.eq.y[i]-1); }
  w.eq.licht = hoch ? [ex + Wc*0.9, ey + Hc*1.16, -10] : [ex + Wc*1.08, ey + Hc*1.12, -10];   // Hochformat: Licht nicht am Bildrand anschneiden
  w.eq.box = { cx:(x0+x1)/2, cy:(y0+y1)/2, hw:(x1-x0)/2, hh:(y1-y0)/2 };
  return w;
}
// NEU (2026-10-16): Trade aus D.trade in Weltkoordinaten (5-Minuten-Kerzen ab 23:00)
function baueChart(hoch){
  const T = D.trade, R = mulberry32(808);
  const idx = (z)=>{ const [h, m] = z.split(":").map(Number); return ((h - 23 + 24) % 24)*12 + m/5; };
  const iE = idx(T.start), iZ = idx(T.ende), N = iZ + 1, i0 = hoch ? idx(T.hochAb) : 0;
  const hw = hoch ? 3.3 : 6.9, yk = hoch ? 1250 : 720, dx = 2*hw/(N - i0);   // Querformat flacher: Platz für die Texte darunter
  const X = (i)=> -hw + (i - i0 + 0.5)*dx, Y = (p)=> (p - T.mitte)*yk;
  const kp = T.kurs.map(([z, p])=> [idx(z), p]);
  const pfad = (i)=>{ for(let k=1;k<kp.length;k++) if(i <= kp[k][0]){ const a = kp[k-1], b = kp[k]; return lerp(a[1], b[1], K.sanft((i-a[0])/(b[0]-a[0]))); } return kp[kp.length-1][1]; };
  const dochte = {}; for(const z in T.dochte) dochte[idx(z)] = T.dochte[z];
  const kerzen = []; let o = pfad(0);
  for(let i=0;i<N;i++){
    const c = pfad(i + 1) + (R() - 0.5)*0.00011;
    let h = max(o, c) + R()*R()*0.00016 + 0.00002, l = min(o, c) - R()*R()*0.00016 - 0.00002;
    if(dochte[i]){ if(dochte[i][0]) h = dochte[i][0]; if(dochte[i][1]) l = dochte[i][1]; }
    if(i >= i0) kerzen.push({ i, x:X(i), O:Y(o), C:Y(c), H:Y(h), L:Y(l) });
    o = c;
  }
  const iS = idx("12:10"), zx = (z)=> z ? X(clamp(idx(z), i0, N - 1)) : X(N - 1);
  return { kerzen, hw, hh:2.7*yk/1000, dx, iE, iZ, i0, X, Y,
    sx:X(iS), sy:Y(1.31845),                                  // Sweep in die Nachfragezone (Start der Szene)
    xE:X(iE) - dx*0.5, xZ:X(iZ) + dx*0.5, yE:Y(T.entry), yS:Y(T.stop), yZiel:Y(T.ziel),
    bx:(X(iE) + X(iZ))/2, by:(Y(T.entry) + Y(T.ziel))/2,
    zonen:T.zonen.map(z=> ({ x0:max(zx(z.von), X(i0)) - dx*0.5, x1:zx(z.bis) + dx*0.5, y0:Y(z.p[0]), y1:Y(z.p[1]), art:z.art, label:z.label })),
    linien:T.linien.filter(l=> idx(l.bis) > i0).map(l=> ({ x0:max(zx(l.von), X(i0)), x1:zx(l.bis), y:Y(l.p), art:l.art, label:l.label })),
    flug:[0,1,2,3,4,5,6,7,8,9,10,11].map(()=> [R()-0.5, R()-0.5, R(), R()-0.5, R()-0.5]) };   // Startversatz der einfliegenden Striche
}
const kursIdx = (x)=> clamp((x - W.kurs.X0)/W.kurs.DX, 0, W.kurs.N-1.001);
const kursAus = (arr, x)=>{ const f = kursIdx(x), i = f|0, k = f - i; return lerp(arr[i], arr[i+1], k); };
const kursAmp = (x, t)=>{ if(x > 8) return 1; const d = abs(x)*0.014; return K.ausExpo(prog(t, 1.2+d, 1.5+d)); };
const kopfX = (t)=> t < 1.25 ? 8 : 8 + 21*(t-1.25) + 1.5*(t-1.25)*(t-1.25);
function zeitlupeTau(t){   // Szenenzeit im Verlust (Speed-Ramp)
  const z = D.zeitlupe, a = z.von - 4.4, f = z.faktor;
  if(t <= z.von) return t - 4.4;
  if(t <= z.bis){ const u = t - z.von; return a + u + (f-1)*u*u/(2*(z.bis-z.von)); }
  return a + (z.bis-z.von)*(1+f)/2 + f*(t - z.bis);
}

/* --- Kameras je Shot --- */
function kamStille(t){ const k = K.sanft(prog(t, 0, 1.2)); return { pos:[0, 0.22-0.08*k, 14.5-1.6*k], tgt:[0,0,0], fov:30, roll:0, bl:0.035, shot:"a" }; }
function kamTrack(t){ const xh = kopfX(t), y = kursAus(W.kurs.ys, xh);   // Hochformat: flacher am Kurs entlang, die Linie läuft in die Tiefe
  return L.hoch ? { pos:[xh-6.2, y-0.35, 1.7], tgt:[xh+2.2, y+0.35, 0], fov:50, roll:9, bl:0.05 } : { pos:[xh-4.6, y-0.85, 3.3], tgt:[xh+1.4, y+0.25, 0], fov:44, roll:5, bl:0.05 }; }
function kamRoh(t){
  const a = D.akte;
  if(t < a.chaos[0]) return kamStille(t);
  if(t < D.schnitte[0]){ const s = kamStille(1.2), r = kamTrack(t), m = K.inOut3(prog(t, 1.2, 1.62));
    return { pos:mix3(s.pos, r.pos, m), tgt:mix3(s.tgt, r.tgt, m), fov:lerp(s.fov, r.fov, m), roll:lerp(0, r.roll, m), bl:lerp(s.bl, r.bl, m), shot:"a" }; }
  if(t < D.schnitte[1]){ const xh = kopfX(t), y = kursAus(W.kurs.ym, xh); return { pos:[xh-1.35, y+0.3, 1.05], tgt:[xh+0.6, y+0.02, 0], fov:38, roll:-3, bl:0.07, shot:"m" }; }
  if(t < a.verlust[0]){ const xh = kopfX(t), y = kursAus(W.kurs.ys, xh), k = K.ein2(prog(t, 3.3, 4.4));
    return { pos:[xh-7.5+1.5*k, y+4.2-1.0*k, (L.hoch?19:15)-3.8*k], tgt:[xh-3.2, y, 0], fov:38, roll:-4.5*k, bl:0.022, shot:"t" }; }
  if(t < a.disziplin[0]){ const k = K.sanft(prog(t, 4.4, 6.6)), f = max(1, abstand(2.4, 3.6, 32)/9.6);
    const pos = [lerp(2.4,1.3,k)*f, lerp(1.05,0.35,k), lerp(9.6,7.4,k)*f], tgt = [lerp(0.35,0.15,k), lerp(0.45,-0.15,k)+(L.hoch?0.5:0), 0];
    const nah = dist3(pos, [0,0,0]), r = K.inOut3(prog(t, 5.55, 6.25));
    return { pos, tgt, fov:32, roll:lerp(-1.5,-4,k), bl:0.2, fok:lerp(nah, 30, r), shot:"v" }; }
  if(t < a.aufstieg[0]) return kamChart(t);
  if(t < a.drop[0]){   // Aufstieg: weit zurück, der Trade wird zur ersten Kachel der Equity-Kurve
    const k0 = kamChart(a.aufstieg[0]), fov = k0.fov, z = 1 - pow(1 - K.sanft(prog(t, a.aufstieg[0], 13.5)), 2.2), B = W.eq.box;
    const d0 = dist3(k0.pos, k0.tgt), d1 = abstand(B.hw*1.04, B.hh*1.08, fov), d = d0*pow(d1/d0, z);
    const tgt = mix3(k0.tgt, [B.cx, B.cy, 0], z), ph = 0.2*z;
    const pos = [tgt[0] + lerp(k0.pos[0]-k0.tgt[0], 0, z) + sin(ph)*d, tgt[1] + lerp(k0.pos[1]-k0.tgt[1], 0.1*d, z), cos(ph)*d];
    return { pos, tgt, fov, roll:lerp(k0.roll, -1.5, z), bl:0.012, shiftY:lerp(k0.shiftY, 0.02, z), shot:"d" }; }
  const k = K.sanft(prog(t, 14.2, 18)); return { pos:[0, 0, 10-0.8*k], tgt:[0,0,0], fov:30, roll:0, bl:0.06, fok:6, shot:"z" };
}

/* --- NEU (2026-10-16): Übergangs-Effekte aus D.effekte --- */
function fx(t){
  const E = D.effekte, o = { stoss:0, gl:0, zoom:0, leak:[0.5, 0] };
  for(const [h, a] of E.stoesse) if(t >= h) o.stoss += a*exp(-(t-h)*7);
  for(const g of E.glitch) if(t >= g && t < g + E.glitchDauer) o.gl = max(o.gl, 1 - (t-g)/E.glitchDauer);
  for(const [a, b, st, form] of E.zoom){ if(t < a || t >= b) continue; const k = prog(t, a, b);
    o.zoom += st*(form === "auf" ? K.ein2(k) : form === "ab" ? 1 - K.aus3(k) : sin(PI*k)); }
  for(const [a, b, x0, x1, st] of E.licht){ if(t < a || t >= b) continue; const k = prog(t, a, b); o.leak = [lerp(x0, x1, K.sanft(k)), st*sin(PI*k)]; }
  return o;
}
// Kamera mit Stößen (Erschütterung auf den Hits); kamRoh() bleibt ohne, für die Bewegungsunschärfe
function kamBei(t){
  const k = kamRoh(t), s = fx(t).stoss;
  if(s < 0.002) return k;
  const d = dist3(k.pos, k.tgt)*0.012*s, ox = (sin(t*53.1) + sin(t*31.7 + 1.3))*0.5*d, oy = (sin(t*47.3 + 2.1) + sin(t*29.9))*0.5*d;
  k.pos = [k.pos[0] + ox, k.pos[1] + oy, k.pos[2]]; k.tgt = [k.tgt[0] + ox*0.6, k.tgt[1] + oy*0.6, k.tgt[2]];
  k.roll = (k.roll || 0) + s*1.4*sin(t*41.7);
  return k;
}

// NEU (2026-10-16): Kamera im Trade — Nahaufnahme am Sweep, Rückzug auf die Totale, langsamer Push auf die Long-Box
function kamChart(t){
  const T = W.chart, fov = 30;
  const a = K.inOut3(prog(t, 7.15, 8.3)), p = K.sanft(prog(t, 8.3, D.akte.aufstieg[0])), r = K.aus3(prog(t, 6.6, 7.2));
  const tn = tan(fov*PI/360), dVoll = max(T.hh*1.06/(0.53*tn), T.hw*1.05/(0.95*tn*L.aspI)), dNah = (L.hoch ? 3.4 : 2.7)*lerp(1.25, 1, r);   // Chart in der oberen Bildhälfte, Text darunter
  const tgtNah = [T.sx + 0.35, T.sy + 0.45, 0], tgtVoll = [0, 0, 0], tgtBox = [lerp(0, T.bx, 0.35), lerp(0, T.by, 0.35), 0];
  const tgt = mix3(mix3(tgtNah, tgtVoll, a), tgtBox, p), d = lerp(dNah, dVoll, a)*lerp(1, 0.88, p);
  const yaw = lerp(-0.42, 0, a) + 0.05*p, pitch = lerp(-0.14, 0.015, a);
  return { pos:[tgt[0] + sin(yaw)*d, tgt[1] + sin(pitch)*d, cos(yaw)*cos(pitch)*d], tgt, fov, roll:lerp(5, 0, a) - 0.8*p,
    bl:lerp(0.1, 0.014, a), shiftY:lerp(0, 0.39, a), shot:"d" };
}

/* --- Bausteine --- */
function hintergrund(F, haze, lc, lp, li, rays, kern){ F.bg.haze = haze; F.bg.lc = lc; F.bg.lp = lp; F.bg.l = [li, rays*(L.hoch ? 0.6 : 1), kern]; }
function staub(t, mitte, box, hell, farbe, lp, dichte){
  const n = floor(W.staub.length*(dichte == null ? 1 : dichte)), VP = eb.VP;
  for(let i=0;i<n;i++){
    const s = W.staub[i];
    const x = mitte[0]-box[0]/2 + ((s[0]*box[0] + t*0.05*(s[4]-0.3) - (mitte[0]-box[0]/2)) % box[0] + box[0]) % box[0];
    const y = mitte[1]-box[1]/2 + ((s[1]*box[1] + t*0.035*(s[4]+0.2) - (mitte[1]-box[1]/2)) % box[1] + box[1]) % box[1];
    const z = mitte[2]-box[2]/2 + ((s[2]*box[2] - (mitte[2]-box[2]/2)) % box[2] + box[2]) % box[2];
    const p = aufSchirm(VP, [x,y,z]); if(p[2] < NAH) continue;
    const dx = (p[0]-lp[0])*L.asp, dy = p[1]-lp[1];
    const lichtig = 0.18 + 1.5*exp(-(dx*dx+dy*dy)*2.2);
    const fl = 0.75 + 0.25*sin(t*1.7 + s[4]*40);
    spr(x,y,z, s[3],s[3], 0, farbe, hell*lichtig*fl, 0, 0, 0, 1);
  }
}
function kursZeichnen(t, xa, xb, fn){
  const k = W.kurs; let n = 0;
  const i0 = max(0, ceil((xa-k.X0)/k.DX)), i1 = min(k.N-1, floor((xb-k.X0)/k.DX));
  for(let i=i0; i<=i1 && n<1490; i++){ const x = k.X0 + i*k.DX; PKT[n*3] = x; PKT[n*3+1] = k.y[i]*kursAmp(x, t); PKT[n*3+2] = 0; n++; }
  PKT[n*3] = xb; PKT[n*3+1] = kursAus(k.y, xb)*kursAmp(xb, t); PKT[n*3+2] = 0; n++;
  linie(PKT, n, null, 0.024, fn);
}
function kerze(x, O, Cl, H, Lo, z, farbe, hell, deck, breite, rand){
  const b = breite || 0.17, r = rand == null ? 1.1 : rand;
  if(!eb.ortho) hell *= sat((zv(x, (H+Lo)/2, z) - 1.8)/2.4);   // nahe der Kamera ausblenden — nie eine Farbfläche
  const ob = max(O, Cl), un = min(O, Cl);   // Docht nur ober- und unterhalb des Körpers
  if(H > ob) spr(x, (H+ob)/2, z-0.01, 0.018, max(0.01, (H-ob)/2), 0, farbe, hell*0.8, deck*0.6, 1, 2.2, 0);
  if(un > Lo) spr(x, (un+Lo)/2, z-0.01, 0.018, max(0.01, (un-Lo)/2), 0, farbe, hell*0.8, deck*0.6, 1, 2.2, 0);
  spr(x, (O+Cl)/2, z, b, max(0.045, abs(Cl-O)/2), 0, farbe, hell, deck, 1, r, 0);
}
function blitzBoost(t){ let b = 0; for(const f of BLITZE){ if(t >= f && t < f + 0.4) b = max(b, exp(-(t-f)*11)); } return b; }

/* --- Szenen je Akt: füllen F und die Geometrie-Puffer --- */
function szStilleChaos(t, F){
  const k = kamBei(t), xh = kopfX(t), yh = kursAus(W.kurs.y, xh)*kursAmp(xh, t);
  k.fok = t < 1.2 ? dist3(k.pos, [0,0,0]) : dist3(k.pos, [xh, yh, 0]);
  ebeneKamera(k);
  const chaos = t >= 1.2, lp = [0.8, 1.06];
  hintergrund(F, mix3([0.0005,0.0025,0.0036], [0.0007,0.0035,0.005], chaos?1:0), mix3(C.weissWarm, C.gold, 0.4), lp, chaos ? 0.28 : 0.2, chaos ? 0.5 : 0.6, 0);
  F.post.exp = K.sanft(prog(t, 0, 0.5));
  if(t >= D.linieZuenden){
    const p = K.ausExpo(prog(t, D.linieZuenden, 1.15)), Lh = 0.02 + 7.98*p;
    const xa = chaos ? max(-8, k.pos[0]-34) : -Lh, xb = chaos ? xh : Lh;
    kursZeichnen(t, xa, xb, (i, c)=>{
      const x = PKT[i*3];
      if(!chaos){ const e = exp(-(Lh-abs(x))*1.4)*(1-p*0.6); const m = mix3(C.weissWarm, C.gold, 0.25); c[0]=m[0]*(0.9+2.4*e); c[1]=m[1]*(0.9+2.4*e); c[2]=m[2]*(0.9+2.4*e); c[3]=0.7; return; }
      const d = xb - x, kopf = exp(-d*1.1), m = mix3(mix3(C.teal, C.tealHell, 0.6), mix3(C.weissWarm, C.gold, 0.3), exp(-d/6)), f = (0.5 + 2.8*kopf)*exp(-d/30);
      c[0]=m[0]*f; c[1]=m[1]*f; c[2]=m[2]*f; c[3]=0.7;
    });
    if(!chaos){ const e = 1.2 + 2.5*(1-p); [-Lh, Lh].forEach(x=>{ spr(x,0,0.01, 0.32,0.32, 0, C.weissWarm, e*0.35, 0, 3, 6, 1); spr(x,0,0.01, 0.05,0.05, 0, C.weissWarm, e, 0, 3, 3, 1); });
      for(const gy of [-2.4,-1.2,1.2,2.4]){ const q = 0.035*p*(abs(gy) > 2 ? 0.6 : 1); strecke(-Lh*1.1, gy, -0.2, Lh*1.1, gy, -0.2, sk(C.tealHell, q, 0), 0.01); } }
  }
  if(chaos){
    const flash = blitzBoost(t), cx = k.pos[0];
    for(const kz of W.kerzen){
      if(kz.x > xh || kz.x < cx-30 || kz.x > cx+40) continue;
      const fertig = kz.x + 1 <= xh, Cl = fertig ? kz.C : kursAus(W.kurs.y, xh)*kursAmp(xh, t), amp = kursAmp(kz.x, t);
      if(amp < 0.5) continue;
      const nahKopf = abs(kz.x + 0.5 - xh) < 1.5, hell = (0.32 + (nahKopf ? flash*2.6 : 0))*exp(-(xh-kz.x)/26);
      kerze(kz.x+0.5, kz.O, Cl, fertig?kz.H:max(kz.O,Cl)+0.05, fertig?kz.L:min(kz.O,Cl)-0.05, -0.06, Cl >= kz.O ? C.gruen : C.rot, hell, 0.35, 0.11, 0.9);
    }
    { let n = 0; for(let x = max(-8, cx-30); x < xh + 6 && n < 600; x += 0.2){ PKT[n*3] = x; PKT[n*3+1] = kursAus(W.kurs.y, x + 13)*1.35*kursAmp(x, t) - 0.6; PKT[n*3+2] = -4; n++; }
      linie(PKT, n, sk(C.tealHell, 0.22, 0.4), 0.03); }
    spr(xh, yh, 0.02, 0.4, 0.4, 0, mix3(C.weissWarm, C.gold, 0.3), 0.9, 0, 3, 6, 1);
    spr(xh, yh, 0.02, 0.06, 0.06, 0, C.weissWarm, 5, 0, 3, 3, 1);
    for(const z of W.ziffern){
      const x = z.x + z.dx*t; if(abs(x - cx) > 45) continue;
      spr(x, z.y + kursAus(W.kurs.ys, clamp(x,-9,100))*0.4, z.z, z.h*4, z.h, 0, (z.zelle%3) ? C.tealHell : C.weissWarm, z.a*(z.z > 0 ? 0.8 : 1.3), 0, 2, z.zelle, 1);
    }
    F.post.streak = 0.5; F.post.ca = 0.016;
  }
  staub(t, chaos ? k.tgt : [0,0,4], chaos ? [16,10,16] : [18,11,16], chaos ? 0.55 : 0.75, mix3(C.weissWarm, C.gold, 0.5), lp);
}
function szVerlust(t, F){
  const k = kamBei(t), sg = D.effekte.sog, tau = zeitlupeTau(min(t, sg[0])), tb = D.bruchTau;   // GEÄNDERT (2026-10-16): friert vor dem Sog ein
  const sog = K.ein2(prog(t, sg[0], sg[1])), cp = k.pos, zieh = (x, y, z, f)=> [lerp(x, cp[0], sog*f), lerp(y, cp[1], sog*f), lerp(z, cp[2], sog*f)];
  ebeneKamera(k);
  const lp = [0.62, 1.08];
  hintergrund(F, [0.0008,0.0035,0.0052], mix3(C.weissWarm, C.rot, 0.35), lp, 0.3, 0.55, 0);
  const uw = K.sanft(prog(t, 4.45, 5.0)); F.post.uw = uw; F.post.sat = lerp(D.look.saettigung, 0.78, uw); F.post.streak = 0.3;
  // die Tiefe: der Markt läuft weiter (scharf nach dem Rack-Focus)
  linie(W.fern, 160, sk(C.tealHell, 0.5, 0.5), 0.14);
  W.ziffern.forEach((z, i)=>{ if(z.z > 0 || i % 3) return; spr(z.x*0.5-12, z.y, z.z, z.h*4, z.h, 0, C.tealHell, z.a*0.5, 0, 2, z.zelle, 1); });
  // Stop-Linie: intakt, dann Bruch
  const sicht = tan(16*PI/180)*L.aspI*dist3(k.pos, [0,0,0]);
  for(const s of W.striche){ if(tau < s.tb){ strecke(s.x0, 0, 0, s.x1, 0, 0, sk(C.gold, 0.9, 0.5), 0.03); } }
  for(const s of W.scherben){
    if(tau < s.tb) continue;
    const d = tau - s.tb, x = s.cx + s.vx*d, y = s.vy*d - 1.2*d*d, z = s.vz*d, th = s.w*d + s.ph*0.1;
    const cs = cos(th), sn = sin(th), kd = s.ax;   // Rodrigues für (1,0,0)
    const rx = cs + s.ax*s.ax*(1-cs), ry = s.az*sn + s.ay*kd*(1-cs), rz = -s.ay*sn + s.az*kd*(1-cs);
    const glanz = 1 + 3*pow(abs(sin(th*1.3 + s.ph)), 16);
    const f = 0.9 + 0.08*s.ph/6, a0 = zieh(x-rx*s.hl, y-ry*s.hl, z-rz*s.hl, f), a1 = zieh(x+rx*s.hl, y+ry*s.hl, z+rz*s.hl, f);
    strecke(a0[0], a0[1], a0[2], a1[0], a1[1], a1[2], sk(C.gold, glanz*(1 + 2*sog), 0.6), 0.028);
  }
  if(tau >= tb){ const d = tau - tb;
    for(const f of W.funken){ if(d > f.life) continue; const e = (1-exp(-3.5*d))/3.5, q = 1 - d/f.life;
      const z3 = zieh(f.vx*e, f.vy*e - 1.5*d*d, f.vz*e, 0.88); spr(z3[0], z3[1], z3[2], f.g, f.g, 0, mix3(C.rot, C.weissWarm, q), 2.2*q*q, 0, 0, 0, 1); } }
  // SL-Beschriftung am rechten Bildrand
  const lx = min(7.4, sicht*0.78 + k.tgt[0]), ld = max(0, tau - tb - 0.03);
  spr(lx, 0.24 - 3*ld*ld, -0.02, 0.11*4, 0.11, -ld*1.6, C.gold, 0.5*(1 - sat(ld*4)), 0, 2, Z_SL, 0);
  // die Kerze: fällt durch den Stop
  const Cl = tau < tb ? 3.2 - (3.2/tb)*tau : -1.6*(1 - exp(-(tau-tb)*5.5));
  kerze(0, 3.2, Cl, 3.42, Cl - 0.22, 0.05, C.rot, 0.62*(1 - sog), 0.94*(1 - sog), 0.34, 1.35);
  spr(0, Cl, 0.1, 0.7, 0.35, 0, C.rot, 0.55*(1 - sog), 0, 3, 4, 1);
  F.post.exp = 1 + 1.6*sog*sog;
  if(tau >= tb && tau < tb + 0.08){ const q = 1 - (tau-tb)/0.08; spr(0, 0, 0.12, 1.1, 0.12, 0, C.weissWarm, 2.4*q, 0, 3, 4, 1); }
  staub(tau*6, k.tgt, [12,9,12], 0.45, mix3(C.weissWarm, C.tealHell, 0.4), lp, 0.8);
}
// NEU (2026-10-16): der Trade aus D.trade — Match-Transition, Zonen, Long-Box, Kerzen bis ins Ziel
function chartZeichnen(t, alpha){
  const T = W.chart, b = D.beats, t0 = D.akte.disziplin[0], ty = eb.kam.tgt[1];
  const farbe = { gold:sk(C.gold, 1.2, 0.5), hell:sk(C.weissWarm, 0.32, 0.3), fein:sk(C.tealHell, 0.16, 0) };
  // Linien fliegen aus dem Objektiv herein und rasten ein (Fortsetzung der Scherben aus dem Verlust)
  T.linien.forEach((l, j)=>{
    const fl = T.flug[j % T.flug.length], q = K.aus3(prog(t, t0 + 0.02*j, t0 + 0.6 + 0.02*j)); if(q <= 0) return;
    const w = 1 - q, ox = fl[0]*3.2*w, oy = (ty - l.y)*w + fl[1]*1.2*w, oz = (0.6 + fl[2]*1.4)*w, sx = fl[3]*1.6*w, sy = fl[4]*1.2*w;   // Start in der Bildmitte, nah vor der Kamera
    const c = l.art === "gold" ? farbe.gold : l.art === "hell" ? farbe.hell : farbe.fein, g = (1 + 5*w)*alpha;
    strecke(l.x0 + ox + sx, l.y + oy + sy, oz, l.x1 + ox - sx, l.y + oy - sy, oz, [c[0]*g, c[1]*g, c[2]*g, c[3]], l.art === "fein" ? 0.012 : 0.018);
    if(l.label) spr(l.x0 - 0.16, l.y + 0.12, 0, 0.2, 0.1, 0, C.weissWarm, 0.5*q*alpha, 0, 2, Z_LABEL[l.label], 0);
  });
  // Zonen als Glasflächen, gestaffelt
  T.zonen.forEach((z, j)=>{
    const q = K.aus3(prog(t, t0 + 0.05 + 0.08*j, t0 + 0.55 + 0.08*j)); if(q <= 0) return;
    const c = z.art === "angebot" ? C.rot : z.art === "lila" ? C.lila : mix3(C.tealHell, C.silber, 0.4);
    const hy = (z.y1 - z.y0)/2*q, my = (z.y0 + z.y1)/2;
    spr((z.x0 + z.x1)/2, my, -0.08, (z.x1 - z.x0)/2, max(0.005, hy), 0, c, (z.art === "angebot" ? 0.32 : 0.24)*alpha, 0.2, 1, 0.45, 0);
    if(z.label) spr(z.x1 - 0.25, my, -0.06, 0.2, 0.1, 0, C.weissWarm, 0.45*q*alpha, 0, 2, Z_LABEL[z.label], 0);
  });
  spr(-T.hw + 0.6, T.hh - 0.05, 0, 0.62, 0.155, 0, C.weissWarm, 0.38*K.aus3(prog(t, t0 + 0.6, t0 + 1.1))*alpha, 0, 2, Z_PAAR, 0);
  // Kerzen: vor dem Entry als Welle vom Sweep aus, im Trade Kerze für Kerze bis ins Ziel
  const fT = T.iE + (T.iZ - T.iE + 1)*K.sanft(prog(t, 8.2, D.zielErreicht));
  for(const kz of T.kerzen){
    const imTrade = kz.i >= T.iE;
    if(imTrade && kz.i >= fT) break;
    const w0 = abs(kz.x - T.sx)*0.045, q = imTrade ? sat((fT - kz.i)*1.5) : K.aus3(prog(t, t0 + w0, t0 + 0.3 + w0));
    if(q <= 0) continue;
    const up = kz.C >= kz.O;
    const c = imTrade ? (up ? mix3(C.gold, C.weissWarm, 0.25) : mix3(C.tealHell, C.silber, 0.3)) : (up ? C.silber : mix3(C.tealHell, C.silber, 0.25));
    kerze(kz.x, kz.O, lerp(kz.O, kz.C, q), lerp(kz.O, kz.H, q), lerp(kz.O, kz.L, q), 0, c, (imTrade ? 1.1 : (up ? 0.9 : 0.55))*alpha, up ? 0.6 : 0.85, T.dx*0.34, up ? 0.35 : 0.5);
  }
  // Long-Box: zieht sich auf den ersten Beat auf und füllt sich mit dem Kursverlauf mit Licht
  const qb = K.aus3(prog(t, b[0] - 0.05, b[0] + 0.5)); if(qb <= 0) return;
  const xr = lerp(T.xE, T.xZ, qb), gw = T.xZ - T.xE, gold = sk(C.gold, 1.5*alpha, 0.5);
  strecke(T.xE, T.yE, 0.02, xr, T.yE, 0.02, gold, 0.022);
  strecke(T.xE, T.yZiel, 0.02, xr, T.yZiel, 0.02, sk(C.gold, 1.2*alpha, 0.5), 0.022);
  for(let x = T.xE; x < xr; x += 0.18) strecke(x, T.yS, 0.02, min(x + 0.1, xr), T.yS, 0.02, sk(C.rot, 0.9*alpha, 0.4), 0.016);
  strecke(T.xE, lerp(T.yE, T.yS, qb), 0.02, T.xE, lerp(T.yE, T.yZiel, qb), 0.02, gold, 0.016);
  if(qb >= 1) strecke(T.xZ, T.yS, 0.02, T.xZ, T.yZiel, 0.02, sk(C.gold, 0.8*alpha, 0.4), 0.014);
  spr((T.xE + xr)/2, (T.yE + T.yZiel)/2, -0.04, (xr - T.xE)/2, (T.yZiel - T.yE)/2, 0, C.ldn, 0.07*alpha, 0.12, 1, 0.3, 0);   // Ziel-Fläche (blau wie im Chart)
  spr((T.xE + xr)/2, (T.yE + T.yS)/2, -0.04, (xr - T.xE)/2, (T.yE - T.yS)/2, 0, C.rot, 0.07*alpha, 0.12, 1, 0.3, 0);
  const pf = sat((fT - T.iE)/(T.iZ - T.iE + 1));
  if(pf > 0){
    const xf = T.xE + gw*pf;
    spr((T.xE + xf)/2, (T.yE + T.yZiel)/2, -0.03, gw*pf/2, (T.yZiel - T.yE)/2, 0, C.gold, 0.12*alpha, 0.1, 1, 0.6, 0);
    for(let x = T.xE; x < xf - 0.05; x += 0.16){   // gestrichelte Diagonale Entry → Ziel
      const k1 = (x - T.xE)/gw, k2 = min(x + 0.09 - T.xE, gw*pf)/gw;
      strecke(x, lerp(T.yE, T.yZiel, k1), 0.03, T.xE + gw*k2, lerp(T.yE, T.yZiel, k2), 0.03, sk(C.weissWarm, 0.5*alpha, 0.3), 0.01);
    }
    const kz = T.kerzen.find(k=> k.i === min(T.iZ, floor(fT)));
    if(kz && t < D.zielErreicht + 0.1) spr(kz.x, kz.C, 0.05, 0.3, 0.3, 0, C.gold, 1.1*alpha, 0, 3, 6, 1);
  }
  // Preis-Etiketten rechts der Box
  [[T.yZiel, 0, C.gold], [T.yE, 1, C.weissWarm], [T.yS, 2, C.rot]].forEach(([y, z, c], j)=>{
    const q = K.aus3(prog(t, b[0] + 0.3 + j*0.08, b[0] + 0.7 + j*0.08));
    spr(T.xZ + 0.42, y, 0.02, 0.4, 0.1, 0, c, 0.75*q*alpha, 0, 2, Z_PREIS + z, 0);
  });
  // Ziel erreicht: Lichtblitz an der Zielkante, die Box glüht kurz auf
  const gz = t >= D.zielErreicht ? exp(-(t - D.zielErreicht)*3) : 0;
  if(gz > 0.01){
    spr(T.xZ, T.yZiel, 0.1, 1.6, 0.06, 0, C.weissWarm, 2.2*gz*alpha, 0, 3, 4, 1); spr(T.xZ, T.yZiel, 0.1, 0.14, 0.14, 0, C.weissWarm, 4.5*gz*alpha, 0, 3, 3, 1);
    spr(T.bx, T.by, -0.03, gw/2, (T.yZiel - T.yE)/2, 0, C.gold, 0.35*gz*alpha, 0, 1, 0.9, 0);
  }
}
function szDisziplin(t, F){
  const k = kamBei(t); ebeneKamera(k);
  const A = D.akte.aufstieg[0], t0 = D.akte.disziplin[0], z = prog(t, A, 13.5), aufst = t >= A;
  const lp0 = [0.5, 1.12];
  let lp = lp0, li = 0.2, kern = 0;
  if(aufst){ const s = aufSchirm(eb.VP, W.eq.licht), m = K.sanft(prog(t, A, A + 0.8)); lp = [lerp(lp0[0], s[0], m), lerp(lp0[1], s[1], m)];
    li = lerp(0.2, 1.5, K.ein2(prog(t, A + 0.2, 13.5))); kern = 0.5*li; }
  hintergrund(F, [0.0005,0.003,0.0042], aufst ? mix3(C.gold, C.weissWarm, 0.3) : mix3(C.weissWarm, C.tealHell, 0.4), lp, li, aufst ? 0.22 : 0.3, kern);
  // Lichtbänder in den Session-Farben streichen durch (London, New York)
  const bw = L.asp*cos(1.15) + sin(1.15), b1 = prog(t, 7.4, 9.0), b2 = prog(t, 8.7, 10.3);
  F.bg.b1 = [lerp(-0.4, bw+0.4, b1), 0.26, 0.022*sin(PI*b1), 1.15]; F.bg.b1c = C.ldn;
  F.bg.b2 = [lerp(-0.4, bw+0.4, b2), 0.26, 0.018*sin(PI*b2), 1.15]; F.bg.b2c = C.nyc;
  chartZeichnen(t, aufst ? lerp(1, 0.8, z) : 1);
  if(aufst) equityZeichnen(t, z);
  staub(t, k.tgt, aufst ? [lerp(16,90,z), lerp(10,50,z), lerp(14,60,z)] : [16,10,14], aufst ? 0.4 : 0.3, mix3(C.weissWarm, C.gold, 0.4), lp, aufst ? 1 : 0.5);
  const bl = D.effekte.blitz, bz = t >= bl[0] && t < bl[1] ? sin(PI*prog(t, bl[0], bl[1])) : 0;   // 1 Frame Weiß vor der Stille
  const glut = 0.45*K.ein2(1 - prog(t, t0, t0 + 0.3));                                              // Nachglühen des Match-Cuts
  F.post.exp = (1 + 1.3*K.ein2(prog(t, 13.3, 13.6)))*(1 + 5*bz) + glut; F.post.streak = aufst ? 0.55 : 0.4;
}
function equityZeichnen(t, z){
  const E = W.eq, p = prog(t, D.akte.aufstieg[0] + 0.25, 13.45), f = (E.n-1)*pow(p, 1.25);
  if(f <= 0) return;
  const kmax = min(E.n-1, floor(f)), fr = f - kmax;
  let n = 0;
  for(let i=0;i<=kmax;i++){ PKT[n*3] = E.x[i]; PKT[n*3+1] = E.y[i]; PKT[n*3+2] = 0; n++; }
  const hx = kmax < E.n-1 ? lerp(E.x[kmax], E.x[kmax+1], fr) : E.x[kmax], hy = kmax < E.n-1 ? lerp(E.y[kmax], E.y[kmax+1], fr) : E.y[kmax];
  if(kmax < E.n-1){ PKT[n*3] = hx; PKT[n*3+1] = hy; PKT[n*3+2] = 0; n++; }
  linie(PKT, n, null, 0.07, (i, c)=>{ const q = 0.8 + 2.4*exp(-(f - i)/5); c[0] = C.gold[0]*q; c[1] = C.gold[1]*q; c[2] = C.gold[2]*q; c[3] = 0.6; });
  // Pulse der Staccato-Schläge lassen die Trades am Kopf aufleuchten
  const boost = {};
  for(const s of STACCATO){ if(s > t || t - s > 0.5) continue; const ps = prog(s, D.akte.aufstieg[0] + 0.25, 13.45), idx = round((E.n-1)*pow(ps, 1.25)); boost[idx] = (boost[idx] || 0) + 2.2*exp(-(t-s)*9); }
  for(let i=1;i<=kmax;i++){ const r = E.rs[i-1], c = r > 0 ? C.gruen : C.rot; spr(E.x[i], E.y[i], 0.02, 0.11, 0.11, 0, c, 0.6 + (boost[i] || 0), 0, 0, 0, 1); }
  spr(hx, hy, 0.05, 0.9, 0.9, 0, C.gold, 1.1, 0, 3, 5, 1); spr(hx, hy, 0.05, 0.12, 0.12, 0, C.weissWarm, 5, 0, 3, 3, 1);
  const li = K.ein2(prog(t, D.akte.aufstieg[0] + 0.2, 13.55)), Lp = E.licht;
  spr(Lp[0], Lp[1], Lp[2], 30, 30, 0, C.gold, 0.35*li, 0, 3, 8, 1);   // groß + steil: keine sichtbare Sprite-Kante
  spr(Lp[0], Lp[1], Lp[2], 2.2, 2.2, 0, C.weissWarm, 3.5*li, 0, 3, 3, 1);
}
function szTitel(t, F, r){
  const k = kamBei(t); ebeneKamera(k);
  hintergrund(F, [0.0012,0.0035,0.0045], C.gold, [0.5, 0.5], 0.07, 0, 0);
  staub(t, [0,0,2], [12,8,10], 0.4, mix3(C.gold, C.weissWarm, 0.5), [0.5, 0.5], 0.45);
  F.post.streak = 0.75; F.post.stc = mix3(C.gold, C.weissWarm, 0.3);
  const hit = exp(-max(0, t - 14.2)*5); F.post.exp = 1 + 0.25*hit;
  if(!r) return;
  ebeneOrtho();
  const Tt = D.texte.titel, sw = prog(t, Tt.von, Tt.von + Tt.sweep), hx = lerp(r.left - 0.1*r.width, r.right + 0.1*r.width, K.ausExpo(sw));
  const by = r.bottom + 0.1*r.height, fade = 1 - K.sanft(prog(t, Tt.von + Tt.sweep, 15.9));
  if(fade > 0){ let n = 0;
    for(let x = r.left - 0.1*r.width; x < hx && n < 400; x += 6){ PKT[n*3] = x; PKT[n*3+1] = by; PKT[n*3+2] = 0; n++; }
    PKT[n*3] = hx; PKT[n*3+1] = by; PKT[n*3+2] = 0; n++;
    linie(PKT, n, null, 1.6, (i, c)=>{ const q = (0.15 + 2.6*exp(-(hx - PKT[i*3])/(0.12*r.width)))*fade; c[0] = C.gold[0]*q; c[1] = C.gold[1]*q; c[2] = C.gold[2]*q; c[3] = 0.5; });
    const kopf = 1 - K.sanft(prog(t, Tt.von + Tt.sweep*0.7, Tt.von + Tt.sweep + 0.35));
    spr(hx, by, 0, r.width*0.45, 2.4, 0, C.gold, 2.2*kopf, 0, 3, 5, 0);
    spr(hx, by, 0, 9, 9, 0, C.weissWarm, 5*kopf, 0, 3, 3, 0);
  }
  const atem = 0.85 + 0.15*sin((t - 14.2)*2.2);
  spr((r.left + r.right)/2, (r.top + r.bottom)/2, 0, r.width*0.62, r.height*1.25, 0, C.gold, 0.06*atem*K.aus3(prog(t, 14.2, 14.8)), 0, 3, 3, 0);
  if(t > 16.85){ const a = K.sanft(prog(t, 16.9, 17.15))*(1 - K.sanft(prog(t, 17.2, 17.6)));
    spr(L.w/2, (r.top + r.bottom)/2, 0, L.w*1.1, L.h*0.8, 0, mix3(C.gold, C.weissWarm, 0.5), 0.45*a, 0, 3, 6, 0); F.post.exp *= 1 + 0.25*a; }
}

/* --- Zeichnen eines Bildes --- */
function F_neu(){ const lk = D.look; return { bg:{ haze:[0,0,0], lc:[0,0,0], lp:[0.5,0.5], l:[0,0,0], b1:[0,1,0,0], b1c:[0,0,0], b2:[0,1,0,0], b2c:[0,0,0] },
  post:{ exp:1, bloom:lk.bloom, streak:lk.streak, stc:[0.55,0.75,1], uw:0, sat:lk.saettigung, vig:lk.vignette*(L.hoch?1.25:1), ca:lk.ca, korn:lk.korn }, leer:false }; }
function szene(t, titelRect){
  nLV = nLI = nS = nEb = 0; eb = null;
  const F = F_neu(), a = D.akte;
  if(t < a.verlust[0]) szStilleChaos(t, F);
  else if(t < a.disziplin[0]) szVerlust(t, F);
  else if(t < a.drop[0]) szDisziplin(t, F);
  else if(t < a.titel[0]) F.leer = true;
  else if(t < 17.6) szTitel(t, F, titelRect);
  else F.leer = true;
  return F;
}
function bewegung(t){   // Bewegungsunschärfe aus der Kamerafahrt (Verschluss ~1/100 s)
  if(t >= D.akte.drop[0]) return [0,0];
  const a = kamRoh(t), b = kamRoh(t - 0.012);
  if(a.shot !== b.shot) return [0,0];
  const P = M.neu(), V = M.neu(), V1 = M.neu(), V0 = M.neu();
  vpAus(a, P, V, V1); vpAus(b, P, V, V0);
  const p1 = aufSchirm(V1, a.tgt), p0 = aufSchirm(V0, a.tgt);
  let vx = (p1[0]-p0[0])*0.83, vy = (p1[1]-p0[1])*0.83; const l = hypot(vx, vy);
  if(l > 0.035){ vx *= 0.035/l; vy *= 0.035/l; }
  return l < 0.0004 ? [0,0] : [vx, vy];
}
function zeichne(g, F, t){
  const gl = g.gl, out = g.fmt.out;
  gl.disable(gl.DEPTH_TEST);
  if(F.leer){ gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, g.w, g.h); gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT); return; }
  const voll = ()=>{ gl.bindBuffer(gl.ARRAY_BUFFER, g.bVoll); for(let i=1;i<6;i++) gl.disableVertexAttribArray(i); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLES, 0, 3); };
  const U = (p, n, v)=>{ const l = p.u[n]; if(l == null) return; if(typeof v === "number") gl.uniform1f(l, v); else if(v.length === 2) gl.uniform2fv(l, v); else if(v.length === 3) gl.uniform3fv(l, v); else if(v.length === 4) gl.uniform4fv(l, v); else gl.uniformMatrix4fv(l, false, v); };
  const tex = (p, n, unit, t2)=>{ gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t2); if(p.u[n] != null) gl.uniform1i(p.u[n], unit); };
  const ziel = (r)=>{ gl.bindFramebuffer(gl.FRAMEBUFFER, r ? r.f : null); gl.viewport(0, 0, r ? r.w : g.w, r ? r.h : g.h); };
  // Szene
  ziel(g.S); gl.disable(gl.BLEND);
  const b = F.bg, pb = g.pBg; gl.useProgram(pb);
  U(pb,"uRes",[g.w,g.h]); U(pb,"uT",t); U(pb,"uOut",out); U(pb,"uHaze",b.haze); U(pb,"uLC",b.lc); U(pb,"uL",b.l); U(pb,"uLP",b.lp);
  U(pb,"uB1",b.b1); U(pb,"uB2",b.b2); U(pb,"uB1C",b.b1c); U(pb,"uB2C",b.b2c); voll();
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.bindBuffer(gl.ARRAY_BUFFER, g.bLV); gl.bufferSubData(gl.ARRAY_BUFFER, 0, LV.subarray(0, nLV*LV_ST));
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.bLI); gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, LI.subarray(0, nLI));
  gl.bindBuffer(gl.ARRAY_BUFFER, g.bSV); gl.bufferSubData(gl.ARRAY_BUFFER, 0, SV.subarray(0, nS*4*SP_ST));
  const attrs = (buf, lay, st)=>{ gl.bindBuffer(gl.ARRAY_BUFFER, buf); lay.forEach(([n, o], i)=>{ gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, n, gl.FLOAT, false, st*4, o*4); }); };
  for(let e=0;e<nEb;e++){
    const E = EB[e], l1 = e+1 < nEb ? EB[e+1].l0 : nLI, s1 = e+1 < nEb ? EB[e+1].s0 : nS;
    const common = (p)=>{ U(p,"uVP",E.VP); U(p,"uV",E.V); U(p,"uWS",E.ws); U(p,"uPx",2/g.h); U(p,"uFok",E.fok); U(p,"uBl",E.bl); U(p,"uOrtho",E.ortho); U(p,"uOut",out); };
    if(l1 > E.l0){ const p = g.pLin; gl.useProgram(p); common(p); U(p,"uAsp",[g.w/g.h,1]);
      attrs(g.bLV, [[3,0],[3,3],[3,6],[1,9],[4,10],[1,14]], LV_ST); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.bLI); gl.drawElements(gl.TRIANGLES, l1-E.l0, gl.UNSIGNED_SHORT, E.l0*2); }
    if(s1 > E.s0){ const p = g.pSpr; gl.useProgram(p); common(p); U(p,"uRe",E.re); U(p,"uUp",E.up); tex(p,"uTex",0,g.atlas);
      attrs(g.bSV, [[3,0],[2,3],[2,5],[1,7],[4,8],[3,12]], SP_ST); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.bSI); gl.drawElements(gl.TRIANGLES, (s1-E.s0)*6, gl.UNSIGNED_SHORT, E.s0*12); }
  }
  gl.disable(gl.BLEND);
  // Bloom (halbe Auflösung abwärts) + anamorpher Streifen
  const pass = (p, quelle, ziel2, txs)=>{ ziel(ziel2); gl.useProgram(p); tex(p,"uS",0,quelle.t); U(p,"uTx",txs); voll(); };
  gl.useProgram(g.pHell); U(g.pHell,"uThr",D.look.schwelle*out); pass(g.pHell, g.S, g.B[0], [0.5/g.S.w, 0.5/g.S.h]);
  for(let i=1;i<g.B.length;i++) pass(g.pRunter, g.B[i-1], g.B[i], [0.5/g.B[i-1].w, 0.5/g.B[i-1].h]);
  pass(g.pStreak, g.B[1], g.St0, [1.5/g.St0.w, 0]); pass(g.pStreak, g.St0, g.St1, [4.5/g.St0.w, 0]); pass(g.pStreak, g.St1, g.St0, [13/g.St0.w, 0]);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
  gl.useProgram(g.pHoch); U(g.pHoch,"uK",1);
  for(let i=g.B.length-1;i>0;i--) pass(g.pHoch, g.B[i], g.B[i-1], [0.5/g.B[i].w, 0.5/g.B[i].h]);
  gl.disable(gl.BLEND);
  // Zusammensetzen: Bewegungsunschärfe, Aberration, Bloom, Tonemapping, Grading, Vignette, Korn
  const p = g.pComp, P = F.post; ziel(null); gl.useProgram(p);
  tex(p,"uS",0,g.S.t); tex(p,"uBl",1,g.B[0].t); tex(p,"uSt",2,g.St0.t);
  U(p,"uRes",[g.w,g.h]); U(p,"uVel",bewegung(t)); U(p,"uT",t); U(p,"uIn",1/out); U(p,"uBS",P.bloom*0.22); U(p,"uSS",P.streak*0.5); U(p,"uExp",P.exp);
  U(p,"uCA",P.ca); U(p,"uKorn",P.korn); U(p,"uVig",P.vig); U(p,"uUW",P.uw); U(p,"uSat",P.sat);
  U(p,"uSchatten",[0.0,0.001,0.0016]); U(p,"uLichter",[1.06,1.0,0.9]); U(p,"uStC",P.stc);
  const e = fx(t); U(p,"uZoom",e.zoom); U(p,"uGl",e.gl); U(p,"uLeak",e.leak); U(p,"uWv",t < D.akte.drop[0] ? 1 : 0);
  voll();
}

/* ---------- 6 TEXT (DOM) ---------------------------------------------------- */
const SVG_TON_AN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
const SVG_TON_AUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
const SVG_WEITER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5.5 15.5 12 9 18.5"/></svg>';
function satzDesTages(){ return D.saetze[tagDesJahres() % D.saetze.length]; }
function woerter(s){ const t = s.split(/\.\s+/).map(x=> x.trim()).filter(Boolean).map(x=> /[.!?]$/.test(x) ? x : x + "."); return t.length > 3 ? [t[0], t[1], t.slice(2).join(" ")] : t; }
function datenzeile(){
  try{
    const tr = (typeof STATE !== "undefined" && STATE.trades) || [];
    if(tr.some(x=> String(x.id || "").indexOf("demo-") === 0)) return "";
    const n = tr.filter(x=> x.area === "live").length;
    return n > 0 ? D.datenzeile.replace("{n}", String(n + 1)) : "";
  }catch(e){ return ""; }
}
function domBauen(){
  const r = document.createElement("div");
  r.className = "intro"; r.id = "introRoot";
  r.innerHTML = `<div class="intro-stage" aria-hidden="true">
    <canvas class="intro-canvas"></canvas>
    <div class="intro-safe">
      <div class="intro-slot intro-slot-a"><div class="intro-txt intro-a"></div></div>
      <div class="intro-slot intro-slot-b"><div class="intro-txt intro-b"></div></div>
      <div class="intro-slot intro-slot-c"><div class="intro-c"></div></div>
      <div class="intro-slot intro-slot-t"><div class="intro-t">
        <div class="intro-title"><span class="t1"></span><span class="t2"></span></div>
        <div class="intro-sweep"></div><div class="intro-motto"></div><div class="intro-daten"></div>
      </div></div>
    </div>
    <div class="intro-bar top"></div><div class="intro-bar bot"></div>
    <div class="intro-photo"><i></i><b></b></div><div class="intro-wisch"></div>
  </div>
  <div class="intro-ctl">
    <button type="button" class="intro-btn intro-ton"></button>
    <button type="button" class="intro-btn intro-skip">Überspringen ${SVG_WEITER}</button>
  </div>`;
  document.body.insertBefore(r, document.body.firstChild);   // zuerst im Tab-Fokus
  const q = (s)=> r.querySelector(s);
  const el = { root:r, canvas:q(".intro-canvas"), safe:q(".intro-safe"), a:q(".intro-a"), b:q(".intro-b"), c:q(".intro-c"), t:q(".intro-t"), title:q(".intro-title"),
    t1:q(".t1"), t2:q(".t2"), sweep:q(".intro-sweep"), motto:q(".intro-motto"), daten:q(".intro-daten"), barT:q(".intro-bar.top"), barB:q(".intro-bar.bot"),
    photo:q(".intro-photo"), wisch:q(".intro-wisch"), photoI:q(".intro-photo i"), photoB:q(".intro-photo b"), ctl:q(".intro-ctl"), ton:q(".intro-ton"), skip:q(".intro-skip") };
  const satz = satzDesTages();
  el.a.textContent = satz.A; el.b.textContent = satz.B; el.motto.textContent = satz.motto;
  el.t1.textContent = D.titel[0]; el.t2.textContent = D.titel[1];
  el.cw = woerter(satz.C).map(w=>{ const s = document.createElement("span"); s.textContent = w; el.c.appendChild(s); return s; });
  el.cBeats = el.cw.length === 1 ? [D.beats[1]] : el.cw.length === 2 ? [D.beats[0], D.beats[2]] : D.beats.slice(0, 3);
  requestAnimationFrame(()=> r.classList.add("is-on"));
  return el;
}
function css(n, p, v){ const c = n._c || (n._c = {}); if(c[p] !== v){ c[p] = v; n.style.setProperty(p, v); } }
function layoutMessen(){
  const w = innerWidth, h = innerHeight, hoch = h > w*1.1;
  const lb = hoch ? round(h*0.035) : max(0, round((h - w/2.39)/2));
  const sInh = (h - 2*lb)/h;
  L = { w, h, hoch, lb, sInh, asp:w/h, aspI:w/(h - 2*lb) };
  const el = S.el; el.root.classList.toggle("is-hoch", hoch); el.root.style.setProperty("--lb", lb + "px");
  // Titel so groß wie möglich, ohne dass er bei maximaler Laufweite abgeschnitten wird
  const box = el.safe.getBoundingClientRect(), ti = el.title;
  const lsMax = D.texte.titel.lsBis*(hoch ? 0.72 : 1) + 0.02; ti.style.fontSize = "100px"; ti.style.letterSpacing = lsMax + "em"; ti.style.paddingLeft = lsMax + "em";
  const tw = max(el.t1.getBoundingClientRect().width, el.t2.getBoundingClientRect().width, hoch ? 0 : ti.scrollWidth);
  let fs = 100*(box.width*0.84)/(tw || 1);
  fs = min(fs, hoch ? 60 : 92, box.height*(hoch ? 0.085 : 0.15));
  ti.style.fontSize = floor(fs) + "px"; ti._c = null;
  S.titelRect = null;
}
function texte(t){
  const el = S.el, Tx = D.texte, ruhig = S.art === "ruhig";
  const blurTxt = (n, k, aus, st)=> css(n, "filter", (k < 1 || aus > 0) ? `blur(${((1-k)*st + aus*6).toFixed(2)}px)` : "none");
  // A: von unscharf zu scharf, leicht zurückweichend (Laufweite nicht animieren: würde den Zeilenumbruch verschieben)
  { const a = Tx.A, e = ruhig ? 0 : huelle(t, a.von, a.bis, a.ein, a.aus), k = K.ausExpo(prog(t, a.von, a.von + a.ein*1.8)), aus = prog(t, a.bis - a.aus, a.bis);
    css(el.a, "opacity", e.toFixed(3)); if(e > 0){ blurTxt(el.a, k, aus, 16); css(el.a, "transform", `scale(${lerp(1.06, 1, k).toFixed(4)})`); } }
  // B: Maske von oben, schwer und langsam, wächst in Zeitlupe
  { const b = Tx.B, e = ruhig ? 0 : huelle(t, b.von, b.bis, b.ein, b.aus), k = K.aus3(prog(t, b.von, b.von + 0.9)), aus = prog(t, b.bis - b.aus, b.bis);
    css(el.b, "opacity", e.toFixed(3));
    if(e > 0){ const m = (k*130 - 15).toFixed(1); css(el.b, "-webkit-mask-image", `linear-gradient(180deg,#000 ${m}%,transparent ${(+m + 18).toFixed(1)}%)`); css(el.b, "mask-image", `linear-gradient(180deg,#000 ${m}%,transparent ${(+m + 18).toFixed(1)}%)`);
      css(el.b, "transform", `translateY(${((1-k)*-10).toFixed(2)}px) scale(${lerp(1, 1.025, prog(t, b.von, b.bis)).toFixed(4)})`); blurTxt(el.b, 1, aus, 0); } }
  // C: Wörter einzeln auf den Beat — knapp und präzise
  { const c = Tx.C, aus = ruhig ? 1 : 1 - K.sanft(prog(t, c.bis - c.aus, c.bis)), an = t > el.cBeats[0] - 0.1 && t < c.bis;
    css(el.c, "opacity", an ? "1" : "0");
    el.cw.forEach((s, i)=>{ const bt = el.cBeats[i], k = K.ausExpo(prog(t, bt - 0.02, bt + c.ein)); const e = k*aus;
      css(s, "opacity", e.toFixed(3)); css(s, "transform", `translateY(${((1-k)*12).toFixed(2)}px) scale(${lerp(1.08, 1, k).toFixed(4)})`); css(s, "filter", k < 1 ? `blur(${((1-k)*8).toFixed(2)}px)` : "none"); }); }
  // Titel, Motto, Datenzeile
  const ti = Tx.titel;
  if(ruhig){
    const e = K.sanft(prog(t, 0.1, 0.7)); css(el.t, "opacity", e.toFixed(3)); css(el.title, "letter-spacing", "0.34em"); css(el.title, "padding-left", "0.34em");
    css(el.motto, "opacity", e.toFixed(3)); css(el.daten, "opacity", (el.daten.textContent ? e*0.8 : 0).toFixed(3)); return;
  }
  const sicht = t >= ti.von && t < 17.5;
  css(el.t, "opacity", sicht ? "1" : "0");
  if(!sicht) return;
  if(!el.datenGesetzt){ el.datenGesetzt = true; el.daten.textContent = datenzeile(); }
  const sw = prog(t, ti.von, ti.von + ti.sweep), auf = prog(t, ti.bis, ti.bis + 0.5);
  const ls = (lerp(ti.lsVon, ti.lsBis, K.aus3(prog(t, ti.von, ti.bis))) + 0.14*K.ein2(auf))*(L.hoch ? 0.72 : 1);
  css(el.title, "letter-spacing", ls.toFixed(4) + "em"); css(el.title, "padding-left", ls.toFixed(4) + "em");
  const m = (lerp(-10, 115, K.ausExpo(sw))).toFixed(1);
  const maske = sw >= 1 ? "none" : `linear-gradient(90deg,#000 ${(+m - 12).toFixed(1)}%,transparent ${m}%)`;
  css(el.title, "-webkit-mask-image", maske); css(el.title, "mask-image", maske);
  css(el.title, "--glanz", lerp(130, -30, K.aus3(prog(t, ti.von + 0.05, ti.von + 1.2))).toFixed(1) + "%");
  css(el.title, "opacity", (1 - K.sanft(auf)).toFixed(3));
  css(el.title, "filter", auf > 0 ? `blur(${(auf*14).toFixed(2)}px) brightness(${(1 + auf*1.2).toFixed(2)})` : "none");
  const mo = Tx.motto, mk = K.aus3(prog(t, mo.von, mo.von + mo.ein)), da = Tx.daten, dk = K.aus3(prog(t, da.von, da.von + da.ein));
  css(el.motto, "opacity", (mk*(1 - K.sanft(auf))).toFixed(3)); css(el.motto, "filter", mk < 1 || auf > 0 ? `blur(${((1-mk)*8 + auf*10).toFixed(2)}px)` : "none"); css(el.motto, "transform", `translateY(${((1-mk)*8).toFixed(2)}px)`);
  css(el.daten, "opacity", (dk*0.75*(1 - K.sanft(auf))).toFixed(3));
  // Ohne WebGL: der Lichtschweif als einfache CSS-Linie
  if(!S.g){ const r = titelRect(), on = sw > 0 && sw < 1;
    css(el.sweep, "opacity", on ? "1" : "0");
    if(on && r){ const tr = el.t.getBoundingClientRect(), hx = lerp(r.left - 0.1*r.width, r.right + 0.1*r.width, K.ausExpo(sw)) - tr.left;
      css(el.sweep, "transform", `translate(${(hx - tr.width).toFixed(1)}px, ${(r.bottom - tr.top + 0.1*r.height).toFixed(1)}px)`); } }
}
function titelRect(){
  if(S.titelRect && S.titelRectT === S.frameNr) return S.titelRect;
  const a = S.el.t1.getBoundingClientRect(), b = S.el.t2.getBoundingClientRect();
  S.titelRect = { left:min(a.left, b.left), right:max(a.right, b.right), top:min(a.top, b.top), bottom:max(a.bottom, b.bottom) };
  S.titelRect.width = S.titelRect.right - S.titelRect.left; S.titelRect.height = S.titelRect.bottom - S.titelRect.top; S.titelRectT = S.frameNr;
  return S.titelRect;
}
function balken(t){
  const k = S.art === "ruhig" ? 0 : K.inOut3(prog(t, 0, 0.9))*(1 - K.inOut3(prog(t, 16.85, 17.4)));
  css(S.el.barT, "transform", `translateY(${(-(1-k)*100).toFixed(2)}%)`); css(S.el.barB, "transform", `translateY(${((1-k)*100).toFixed(2)}%)`);
}
function heroMessen(){
  try{
    if(typeof STATE === "undefined" || STATE.view !== "start" || STATE.viewingTrade) return null;
    const h = document.querySelector("#app .start-hero"); if(!h) return null;
    const r = h.getBoundingClientRect(); if(r.width < 60 || r.bottom < 40 || r.top > innerHeight - 60) return null;
    const vor = getComputedStyle(h, "::before"), nach = getComputedStyle(h, "::after"), cs = getComputedStyle(h);
    return { el:h, radius:parseFloat(cs.borderTopLeftRadius) || 0, oben:parseFloat(vor.top)/r.height, unten:parseFloat(vor.bottom)/r.height,
      bild:vor.backgroundImage, groesse:vor.backgroundSize, lage:vor.backgroundPosition, tf:vor.transform, nach:nach.backgroundImage };
  }catch(e){ return null; }
}
// Übergang: Titel löst sich in Licht auf, das Foto der Startseite kommt aus dem Licht und legt sich auf den Hero
function uebergang(t){
  const el = S.el, hellModus = document.documentElement.getAttribute("data-theme") !== "dark";
  if(S.art === "ruhig"){ const a = 1 - K.sanft(prog(t, 1.6, D.ruhigDauer)); css(el.root, "background-color", `rgba(0,0,0,${a.toFixed(3)})`); css(el.safe, "opacity", a.toFixed(3)); if(t >= 1.6) freigeben(); return; }
  css(el.canvas, "opacity", (1 - K.sanft(prog(t, 17.25, 17.55))).toFixed(3));
  if(t < 16.95){ css(el.photo, "opacity", "0"); css(el.wisch, "opacity", "0"); return; }
  if(!S.hero && !S.heroGeprueft){ S.heroGeprueft = true; S.hero = heroMessen();
    if(S.hero){ const h = S.hero, i = el.photoI; i.style.top = (h.oben*100) + "%"; i.style.bottom = (h.unten*100) + "%"; i.style.backgroundImage = h.bild;
      i.style.backgroundSize = h.groesse; i.style.backgroundPosition = h.lage; i.style.transform = h.tf === "none" ? "" : h.tf; el.photoB.style.backgroundImage = h.nach; } }
  /* GEÄNDERT (2026-10-16): Whip-Wipe — eine Lichtkante reißt horizontal über das Bild und legt das Foto frei */
  const ein = 1, wk = K.inOut3(prog(t, 16.98, 17.3)), mp = lerp(-20, 125, wk), hell = 1 - K.aus3(prog(t, 17.0, 17.45));
  const maske = wk >= 1 ? "none" : `linear-gradient(90deg,#000 ${(mp - 9).toFixed(1)}%,transparent ${(mp + 1).toFixed(1)}%)`;
  css(el.photo, "-webkit-mask-image", maske); css(el.photo, "mask-image", maske);
  css(el.wisch, "opacity", (sin(PI*prog(t, 16.98, 17.34))*0.95).toFixed(3)); css(el.wisch, "transform", `translateX(${(L.w*(mp - 4)/100).toFixed(1)}px)`);
  css(el.photo, "filter", hell > 0.01 ? `brightness(${(1 + 1.1*hell).toFixed(3)}) blur(${(hell*8).toFixed(2)}px)` : "none");
  const z = K.inOut3(prog(t, 17.3, 17.9)), raus = K.sanft(prog(t, 17.72, D.dauer));
  let x = 0, y = 0, w = L.w, h = L.h, rad = 0;
  if(S.hero){ const r = S.hero.el.isConnected ? S.hero.el.getBoundingClientRect() : null;
    if(r){ x = lerp(0, r.left, z); y = lerp(0, r.top, z); w = lerp(L.w, r.width, z); h = lerp(L.h, r.height, z); rad = S.hero.radius*z; } }
  // Am Ende auf die echte Hero-Karte überblenden (deckungsgleich), damit Schnell-Buttons und Session-Kachel weich erscheinen
  css(el.photo, "opacity", (S.hero ? ein*(1 - K.sanft(prog(t, 17.88, D.dauer))) : ein*(1 - raus)).toFixed(3));
  css(el.photo, "left", x.toFixed(1) + "px"); css(el.photo, "top", y.toFixed(1) + "px"); css(el.photo, "width", w.toFixed(1) + "px"); css(el.photo, "height", h.toFixed(1) + "px");
  css(el.photo, "border-radius", rad.toFixed(1) + "px"); css(el.photoB, "opacity", z.toFixed(3));
  // Grund der Ebene: dunkel bleibt schwarz, hell läuft über warmes Licht in die helle Seite
  let rgb = [0,0,0];
  if(hellModus){ const lh = hexLin(D.farben.lichtHell).map(v=> pow(v, 1/2.2)*255), seite = [245,245,247]; rgb = mix3(mix3([0,0,0], lh, K.sanft(prog(t, 17.0, 17.45))), seite, K.sanft(prog(t, 17.45, 17.85))); }
  css(el.root, "background-color", `rgba(${rgb.map(v=>round(v)).join(",")},${(1 - raus).toFixed(3)})`);
  css(el.safe, "opacity", (1 - raus).toFixed(3));
  if(t >= 17.72) freigeben();
}

/* ---------- 7 ABLAUF ---------------------------------------------------------- */
let S = null;   // laufendes Intro (null = keins)
function vorbereiten(plan){
  if(S) return false;
  try{
    plan = plan || planNachEntsperren();
    if(!plan) return false;
    const e = ladeEinst();
    S = { art:plan.art, bildT:plan.bildT, tonAn:e.ton && plan.art !== "bild", timers:[], hoeren:[], korr:0, frameNr:0, dts:[], cpu:[], stats:{} };
    S.el = domBauen();
    if(S.tonAn){   // AudioContext in derselben Geste wie das Entsperren (iOS erlaubt Ton nur nach einer Geste)
      try{
        const AC = window.AudioContext || window.webkitAudioContext;
        if(navigator.audioSession){ try{ S.altSession = navigator.audioSession.type; navigator.audioSession.type = "ambient"; }catch(_){} }   // Stummschalter respektieren, Musik nicht abwürgen
        S.ctx = new AC({ latencyHint:"interactive" });
        if(S.ctx.resume) S.ctx.resume();
        const sb = S.ctx.createBufferSource(); sb.buffer = S.ctx.createBuffer(1, 1, 22050); sb.connect(S.ctx.destination); sb.start(0);
      }catch(err){ S.ctx = null; }
    }
    if(typeof uiHoldStart === "function") uiHoldStart();
    document.documentElement.classList.add("intro-open");
    const sh = document.getElementById("appShell"); if(sh) sh.inert = true;
    return true;
  }catch(err){ console.warn("Intro: Vorbereitung fehlgeschlagen", err); aufraeumen(false); return false; }
}
function hoer(el, ev, fn, opt){ el.addEventListener(ev, fn, opt); S.hoeren.push([el, ev, fn, opt]); }
function starten(){
  if(!S || S.laeuft) return;
  try{
    S.laeuft = true;
    if(document.visibilityState === "hidden"){ abbrechen(); return; }
    const el = S.el;
    el.root.classList.add("is-live", "art-" + S.art);
    layoutMessen();
    if(S.art !== "ruhig"){
      try{ S.g = glAnlegen(el.canvas); }catch(err){ console.warn("Intro: WebGL nicht nutzbar", err); S.g = null; }
      if(!S.g && S.art !== "bild") S.art = "kurz";
      el.root.classList.toggle("ohne-gl", !S.g);
    }
    S.startAb = S.art === "kurz" ? D.kurzAb : S.art === "bild" ? S.bildT : 0;
    S.ende = S.art === "ruhig" ? D.ruhigDauer : D.dauer;
    S.skala = 1; groesse();
    const d = new Date(); W = baueWelt(d.getFullYear()*10000 + (d.getMonth()+1)*100 + d.getDate(), L.hoch); S.weltHoch = L.hoch;
    // Bedienung
    tonKnopf();
    hoer(el.skip, "click", (e)=>{ e.stopPropagation(); ueberspringen(); });
    hoer(el.ton, "click", (e)=>{ e.stopPropagation(); S.tonAn = !S.tonAn; const ei = ladeEinst(); ei.ton = S.tonAn; speichereEinst(ei); tonKnopf(); if(S.A) tonStumm(S.A, !S.tonAn); });
    hoer(el.root, "click", (e)=>{ if(e.target.closest(".intro-ctl")) return; if(performance.now() - S.real0 < 400) return; ueberspringen(); });
    hoer(document, "keydown", tasten, true);
    hoer(document, "visibilitychange", ()=>{ if(document.visibilityState === "hidden") abbrechen(); });
    hoer(window, "pagehide", ()=> abbrechen());
    hoer(window, "resize", ()=>{ if(!S) return; S.gezeigt = null; layoutMessen(); groesse(); if(S.weltHoch !== L.hoch){ W = baueWelt(d.getFullYear()*10000 + (d.getMonth()+1)*100 + d.getDate(), L.hoch); S.weltHoch = L.hoch; } });
    if(S.g) hoer(el.canvas, "webglcontextlost", (e)=>{ e.preventDefault(); abbrechen(); });
    // Ton
    if(S.ctx && S.art !== "bild"){
      try{
        if(S.art === "ruhig"){ S.A = tonRuhig(S.ctx); }
        else { S.A = baueTon(S.ctx, S.ctx.currentTime + 0.06, S.startAb); }
        if(!S.tonAn) tonStumm(S.A, true);
      }catch(err){ console.warn("Intro: Ton nicht verfügbar", err); S.A = null; }
    }
    S.real0 = performance.now();
    if(S.art !== "bild") S.timers.push(setTimeout(()=> beenden(), D.obergrenze*1000));
    S.timers.push(setTimeout(()=>{ if(S && S.el) S.el.ctl.classList.add("is-on"); }, 800));
    S.raf = requestAnimationFrame(schleife);
  }catch(err){ console.warn("Intro: Start fehlgeschlagen", err); abbrechen(); }
}
function tonRuhig(ctx){   // reduzierte Bewegung: nur ein weicher Akkord
  const A = { ctx, t0:ctx.currentTime + 0.05, startAb:0, r:mulberry32(5) }; A.T = s=> A.t0 + s;
  const m = ctx.createGain(); sv(m.gain, 0, A.t0); lr(m.gain, 0.06, A.t0 + 0.6); st(m.gain, 0, A.t0 + 1.4, 0.5);
  A.stumm = ctx.createGain(); A.master = m; m.connect(A.stumm); A.stumm.connect(ctx.destination);
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900; lp.connect(m);
  [110, 164.81, 220, 277.18].forEach(f=>{ const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = f; o.connect(lp); o.start(A.t0); o.stop(A.t0 + 3.5); });
  A.plan = []; A.idx = 0; return A;
}
function tonKnopf(){ const b = S.el.ton; b.innerHTML = S.tonAn ? SVG_TON_AN : SVG_TON_AUS; b.setAttribute("aria-label", S.tonAn ? "Ton ausschalten" : "Ton einschalten"); b.setAttribute("aria-pressed", S.tonAn ? "false" : "true"); b.title = S.tonAn ? "Ton aus" : "Ton an"; b.hidden = !S.ctx; }
function groesse(){
  if(!S.g) return;
  const dpr = min(window.devicePixelRatio || 1, 2);
  let w = round(L.w*dpr*S.skala), h = round(L.h*dpr*S.skala);
  const grenze = 3.6e6; if(w*h > grenze){ const f = sqrt(grenze/(w*h)); w = round(w*f); h = round(h*f); }
  w = max(8, round(w/8)*8); h = max(8, round(h/8)*8);   // gerade Größen für die Bloom-Kette
  if(S.g.w === w && S.g.h === h) return;
  S.el.canvas.width = w; S.el.canvas.height = h; S.g.w = w; S.g.h = h; rtsAnlegen(S.g, w, h);
}
function tasten(e){
  if(!S) return;
  const inCtl = e.target && e.target.closest && e.target.closest(".intro-ctl");
  if(e.key === "Tab") return;                                   // Fokus darf zu den Knöpfen wandern
  e.stopPropagation();
  if(e.key === "Escape"){ e.preventDefault(); ueberspringen(); return; }
  if(e.key === " " || e.key === "Enter" || e.key === "Spacebar"){
    if(inCtl) return;                                           // Knopf selbst auslösen lassen
    e.preventDefault();
    if(e.repeat || !S.real0 || performance.now() - S.real0 < 350) return;   // gehaltene Entsperr-Taste nicht als Überspringen werten
    ueberspringen();
  }
}
function zeit(now){
  if(S.art === "bild") return S.bildT;
  let t = S.startAb + (now - S.real0)/1000;
  const A = S.A;
  if(A && A.ctx.state === "running" && !S.ohneAudioUhr){   // Das Bild folgt dem Ton: sanft auf die Audio-Uhr nachführen
    const tc = A.startAb + (A.ctx.currentTime - A.t0);   // reine Audio-Uhr
    if(t - tc > 0.5) S.ohneAudioUhr = true;   // Ton hängt (überlastetes Gerät): Bild läuft auf der Echtzeit weiter, statt mit hängen zu bleiben
    else { const d = tc - (A.ctx.outputLatency || 0) - (t + S.korr); if(abs(d) > 0.15) S.korr += d; else S.korr += d*0.06; }   // Ziel: was gerade zu hören ist (inkl. Bluetooth-Latenz)
  }
  return t + S.korr;
}
function schleife(now){
  if(!S || !S.raf || S.endet) return;   // nach dem Überspringen nur noch die CSS-Ausblendung, kein Rendern mehr
  S.raf = requestAnimationFrame(schleife);
  try{
    S.frameNr++;
    const t = zeit(now);
    messen(now);
    if(t >= S.ende){ beenden(); return; }
    if(S.A && S.art !== "ruhig") tonPlanen(S.A, t + 0.9);
    if(S.art === "bild" && S.gezeigt === t) return;   // Standbild: nur neu zeichnen, wenn sich etwas ändert
    S.gezeigt = t;
    const c0 = performance.now(); bild(t); if(S) S.cpu.push(performance.now() - c0);
  }catch(err){ console.warn("Intro: Fehler im Ablauf", err); abbrechen(); }
}
function bild(t){
  S.t = t;
  balken(t);
  texte(t);
  if(S.g){ const F = szene(t, t >= D.akte.titel[0] && t < 17.6 ? titelRect() : null); zeichne(S.g, F, t); }
  uebergang(t);
}
// Frametime in den ersten ~0,5 s messen; bei Bedarf die Render-Auflösung senken
function messen(now){
  const el = (now - S.real0)/1000;
  if(S.letzt != null) S.dts.push(now - S.letzt);
  S.letzt = now;
  if(!S.g || S.art === "bild") return;
  if(!S.mess && el > 0.15) S.mess = { ab:S.dts.length, bis:el + 0.5 };
  if(S.mess && el > S.mess.bis){
    const f = S.dts.slice(S.mess.ab).sort((a,b)=>a-b), med = f[f.length >> 1] || 0;
    (S.stats.messungen || (S.stats.messungen = [])).push({ skala:S.skala, medianMs:+med.toFixed(2) });
    S.mess = { ab:S.dts.length, bis:el + 0.5, fertig:false };
    if(med > 18.5 && S.skala > 0.6 && S.stats.messungen.length < 3){ S.skala = S.skala > 0.8 ? 0.75 : 0.56; groesse(); }
    else S.mess.bis = 1e9;
  }
}
function freigeben(){   // Startseite übernimmt: Einstieg (Reveal, Count-up) und Glow genau einmal
  if(!S || S.freigegeben || S.art === "bild") return;
  S.freigegeben = true;
  const sh = document.getElementById("appShell"); if(sh) sh.inert = false;
  try{ if(typeof window.designReplayEnter === "function") window.designReplayEnter(); }catch(e){}
  if(sh){ sh.classList.remove("app-shell-glow"); void sh.offsetWidth; sh.classList.add("app-shell-glow"); setTimeout(()=> sh.classList.remove("app-shell-glow"), 1100); }
}
function ueberspringen(){
  if(!S || S.endet) return;
  if(!S.laeuft || S.art === "bild"){ aufraeumen(false); return; }
  S.endet = true;
  if(S.A) try{ tonAusblenden(S.A, D.ton.ausblenden); }catch(e){}
  freigeben();
  S.el.root.classList.add("is-out");
  S.timers.push(setTimeout(()=> aufraeumen(false, true), 420));
}
function beenden(){ aufraeumen(true); }
function abbrechen(){ aufraeumen(false); }
// Räumt restlos auf: Schleife, Timer, Listener, WebGL-Kontext, DOM; Ton nach dem Nachklang schließen
function aufraeumen(nachklang, ausgeblendet){
  const s = S; if(!s) return;
  S = null;
  if(s.raf) cancelAnimationFrame(s.raf); s.raf = 0;
  s.timers.forEach(clearTimeout);
  s.hoeren.forEach(([el, ev, fn, opt])=> el.removeEventListener(ev, fn, opt));
  const dts = s.dts.slice(1).sort((a,b)=>a-b);
  INTRO.statistik = { art:s.art, dauerSek:s.real0 ? +((performance.now() - s.real0)/1000).toFixed(2) : 0, audioUhr:!!s.A && !s.ohneAudioUhr, gl:s.g ? (s.g.v2 ? "webgl2" : "webgl") : "kein", hdr:s.g ? s.g.fmt.out === 1 : false, bilder:s.frameNr,
    frametimeMs:dts.length ? { median:+dts[dts.length >> 1].toFixed(2), p95:+dts[floor(dts.length*0.95)].toFixed(2) } : null,
    cpuMs:(c=>c.length ? { median:+c[c.length >> 1].toFixed(2), p95:+c[floor(c.length*0.95)].toFixed(2) } : null)(s.cpu.slice().sort((a,b)=>a-b)), skala:s.skala, messungen:s.stats.messungen || [] };
  if(s.g) glFreigeben(s.g);
  if(s.el && s.el.root) s.el.root.remove();
  document.documentElement.classList.remove("intro-open");
  const sh = document.getElementById("appShell"); if(sh) sh.inert = false;
  if(!s.freigegeben && s.art !== "bild"){ try{ if(typeof window.designReplayEnter === "function") window.designReplayEnter(); }catch(e){} }
  if(navigator.audioSession && s.altSession != null){ try{ navigator.audioSession.type = s.altSession; }catch(_){} }
  if(s.A || s.ctx){ const A = s.A, ctx = s.ctx;
    if(nachklang) setTimeout(()=>{ try{ ctx.close(); }catch(e){} }, D.ton.nachklang*1000);
    else if(ausgeblendet) setTimeout(()=>{ try{ ctx.close(); }catch(e){} }, 60);
    else { try{ if(A) tonAusblenden(A, 0.03); }catch(e){} setTimeout(()=>{ try{ ctx.close(); }catch(e){} }, 50); } }
  W = null;
  if(typeof uiHoldRelease === "function") uiHoldRelease();
}

/* --- Einstellungen im Modal „Einstellungen“ --- */
function einstellungenHtml(){
  const e = ladeEinst();
  return `<div class="field-group intro-set">
    <label class="fg-label">Intro nach dem Entsperren <span class="intro-set-hint">· nur dieses Gerät</span></label>
    ${chipGroupHtml("introModus", MODI.map(m=>m[0]), e.modus, { labels:Object.fromEntries(MODI) })}
    <div class="intro-set-row">
      <span class="intro-set-label">Ton</span>
      ${chipGroupHtml("introTon", ["an","aus"], e.ton ? "an" : "aus", { labels:{ an:"An", aus:"Aus" } })}
      <button type="button" class="btn btn-sm" id="introPlayBtn">Intro jetzt abspielen</button>
    </div>
    ${INTRO_LIVE ? "" : `<div class="intro-set-note">Vorschau: Nach dem Entsperren läuft das Intro erst nach der Freischaltung automatisch. Zum Testen die Seite mit <code>?intro=vorschau</code> öffnen oder hier abspielen.</div>`}
  </div>`;
}
function einstellungenVerdrahten(root){
  const box = root && root.querySelector(".intro-set"); if(!box) return;
  box.addEventListener("click", (ev)=>{
    const b = ev.target.closest("button[data-group]");
    if(b){ const e = ladeEinst(); if(b.dataset.group === "introModus") e.modus = b.dataset.value; else e.ton = b.dataset.value === "an";
      speichereEinst(e); syncChipGroup(b.closest("[data-chipgroup]"), b.dataset.value, false); return; }
    if(ev.target.closest("#introPlayBtn")){ if(typeof closeSettingsModal === "function") closeSettingsModal(); abspielen(); }
  });
}
// „Intro jetzt abspielen“: volle Fassung (bzw. ruhig), unabhängig vom Modus — muss im Klick laufen (Ton)
function abspielen(){
  if(S) return;
  if(!vorbereiten({ art:ruhigGewuenscht() ? "ruhig" : "voll", bildT:0 })) return;
  S.el.root.classList.add("is-live");
  S.timers.push(setTimeout(starten, 420));
}

return {
  vorbereiten:()=> vorbereiten(), geplant:()=> !!S && !S.laeuft, starten, aktiv:()=> !!S, abspielen, ueberspringen,
  einstellungenHtml, einstellungenVerdrahten, tonOffline, statistik:null, drehbuch:D,
  bild:(t)=>{ if(S && S.art === "bild"){ S.bildT = t; S.titelRect = null; } },   // Test: anderes Standbild
  zustand:()=> S ? { art:S.art, t:S.t, laeuft:!!S.laeuft, gl:!!S.g, skala:S.skala } : null
};
})();
