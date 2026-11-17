/* musik.js — Lo-Fi-Hintergrundmusik, live erzeugt mit Web Audio (keine Audiodateien) */
/* =========================================================================
   MUSIK  —  NEU (2026-11-17)
   Lo-Fi Beats, die der Browser selbst komponiert: Rhodes-Akkorde (FM), Bass,
   Boom-Bap-Drums mit Swing, gelegentliche Melodie, Vinyl-Knistern und Tape-Leiern.
   Tonart, Tempo und Akkordfolgen werden je Sitzung zufällig gewählt, Muster
   wechseln laufend — es wiederholt sich nie genau. Keine Dateien, keine Rechte-
   fragen, läuft offline.
   Aufbau:
     1 Einstellungen der Musik (hier tunen)
     2 Hilfen         — Zufall, Noten, Rausch- und Hallpuffer
     3 Klangerzeuger  — Mischpult, Rhodes, Bass, Kick, Snare, Hi-Hat, Vinyl
     4 Komponist      — Takt- und Schrittplanung
     5 Ablauf         — Start nach dem Intro, Pause im Hintergrund, Ein-/Ausblenden
     6 Bedienung      — Header-Knopf, Abschnitt im Modal „Einstellungen“
   Einstellung je Gerät: tj_musik_v1 { an, lautstaerke (0–1), stimmung ("lofi" | "ruhig") }
   Schnittstelle: MUSIK.vorbereiten() (in einer Geste!), MUSIK.starten(), MUSIK.umschalten(),
   MUSIK.einstellungenHtml(), MUSIK.einstellungenVerdrahten(root), MUSIK.zustand(),
   MUSIK.offline(sek, opt) (Test: rendert ohne Lautsprecher in einen AudioBuffer)
   ========================================================================= */
const MUSIK = (function(){
"use strict";

/* ---------- 1 EINSTELLUNGEN DER MUSIK ---------------------------------------- */
const K = {
  bpm: [70, 82],                       // Tempo je Sitzung zufällig in diesem Bereich
  swing: 0.6,                          // 0,5 = gerade; höher = mehr „Lean“ auf den Off-Sechzehnteln
  tonarten: [53, 51, 56, 50, 55, 52],  // Grundton (MIDI): F, Es, As, D, G, E
  // Akkordfolgen (Stufe in Halbtönen über dem Grundton, Akkordtyp) — je Takt ein Akkord
  folgen: [
    [[2,"m9"],[7,"d9"],[0,"M9"],[9,"m9"]],      // ii – V – I – vi
    [[0,"M9"],[9,"m9"],[2,"m9"],[7,"d13"]],     // I – vi – ii – V
    [[5,"M9"],[4,"m7"],[2,"m9"],[0,"M9"]],      // IV – iii – ii – I
    [[5,"M9"],[5,"m9"],[0,"M9"],[9,"m7"]],      // IV – iv – I – vi
    [[9,"m9"],[5,"M9"],[0,"M9"],[7,"d9"]]       // vi – IV – I – V
  ],
  akkorde: { M9:[0,4,7,11,14], m9:[0,3,7,10,14], m7:[0,3,7,10], d9:[0,4,10,14], d13:[0,4,10,14,21] },
  lage: { keys:[52, 76], bass:[33, 45], melodie:[70, 84] },   // Tonumfang (MIDI)
  mix: { drums:0.85, keys:0.8, bass:0.42, melodie:0.42, hall:0.8, knistern:0.05, rauschen:0.006 },
  lautMax: 0.55,                       // Pegel bei Lautstärke 100 %
  einblenden: 5, ausblenden: 0.8, zurueck: 1.5   // Sekunden
};
const KEYS_MUSTER = [   // [Sechzehntel, Dauer in Sechzehnteln, Anschlag]
  [[0,14,0.9]],
  [[0,6,0.9],[6,10,0.75]],
  [[0,9,0.9],[10,6,0.7]],
  [[0,3,0.85],[3,13,0.8]],
  [[2,14,0.85]]
];
const BASS_MUSTER = [   // R = Grundton, Q = Quinte, O = Oktave
  [[0,5,"R",1],[7,2,"R",0.7],[10,5,"R",0.85]],
  [[0,8,"R",1],[11,4,"Q",0.8]],
  [[0,3,"R",1],[3,4,"R",0.6],[10,3,"O",0.7],[14,2,"Q",0.6]],
  [[0,12,"R",1]]
];
const KICK_MUSTER = [
  [[0,1],[10,0.85]],
  [[0,1],[7,0.6],[10,0.85]],
  [[0,1],[10,0.8],[11,0.55]],
  [[0,1],[9,0.8]],
  [[0,1],[3,0.5],[10,0.85]]
];
const PENTA = [0, 2, 4, 7, 9];          // Dur-Pentatonik für die Melodie
const MEL_SCHRITTE = [2, 3, 6, 8, 9, 11, 14];

/* ---------- 2 HILFEN -------------------------------------------------------- */
function mulberry32(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function wahl(P, arr){ return arr[Math.floor(P.rnd() * arr.length)]; }
function mtof(m){ return 440 * Math.pow(2, (m - 69) / 12); }
function inLage(n, [lo, hi]){ while(n < lo) n += 12; while(n >= hi) n -= 12; return n; }
function knoten(c, wert){ const g = c.createGain(); if(wert !== undefined) g.gain.value = wert; return g; }
function saettigung(k){ const n = 1024, kurve = new Float32Array(n), norm = Math.tanh(k); for(let i = 0; i < n; i++){ const x = i / (n - 1) * 2 - 1; kurve[i] = Math.tanh(k * x) / norm; } return kurve; }
function rauschPuffer(c, rnd, sek){ const b = c.createBuffer(1, Math.ceil(c.sampleRate * sek), c.sampleRate), d = b.getChannelData(0); for(let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1; return b; }
// Knistern: vereinzelte Knackser unterschiedlicher Stärke, als Schleife
function knisterPuffer(c, rnd){
  const b = c.createBuffer(1, Math.ceil(c.sampleRate * 3.7), c.sampleRate), d = b.getChannelData(0);
  for(let i = 0; i < d.length; i++){
    if(rnd() < 0.00045){ const a = (rnd() < 0.12 ? 1 : 0.35) * (0.4 + rnd() * 0.6) * (rnd() < 0.5 ? -1 : 1); const len = 2 + Math.floor(rnd() * 6);
      for(let j = 0; j < len && i + j < d.length; j++) d[i + j] += a * Math.pow(0.55, j); }
  }
  return b;
}
// Hall: Stereo-Impulsantwort aus abklingendem Rauschen
function hallPuffer(c, rnd, sek){
  const len = Math.ceil(c.sampleRate * sek), b = c.createBuffer(2, len, c.sampleRate), vor = Math.floor(c.sampleRate * 0.018);
  for(let k = 0; k < 2; k++){ const d = b.getChannelData(k); for(let i = vor; i < len; i++) d[i] = (rnd() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
  return b;
}

/* ---------- 3 KLANGERZEUGER ---------------------------------------------------- */
function graphBauen(P){
  const c = P.ctx;
  // Summe → Sättigung (Tape) → Tiefpass (warm, „Lo-Fi“) → Kompressor → Fader → Ausgang
  P.master = knoten(c, 0.0001);
  const komp = c.createDynamicsCompressor();
  komp.threshold.value = -20; komp.knee.value = 12; komp.ratio.value = 3; komp.attack.value = 0.012; komp.release.value = 0.25;
  const tp = c.createBiquadFilter(); tp.type = "lowpass"; tp.frequency.value = 7000; tp.Q.value = 0.45;
  const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 32; hp.Q.value = 0.5;
  const sat = c.createWaveShaper(); sat.curve = saettigung(1.6); sat.oversample = "2x";
  P.summe = knoten(c, 0.75);
  P.summe.connect(sat); sat.connect(hp); hp.connect(tp); tp.connect(komp); komp.connect(P.master); P.master.connect(c.destination);
  // Hall
  const hall = c.createConvolver(); hall.buffer = hallPuffer(c, P.rnd, 2.4);
  P.hallIn = c.createBiquadFilter(); P.hallIn.type = "lowpass"; P.hallIn.frequency.value = 3200;
  const hallAus = knoten(c, K.mix.hall);
  P.hallIn.connect(hall); hall.connect(hallAus); hallAus.connect(P.summe);
  // Ducking: Keys, Bass und Melodie weichen der Kick kurz aus (Pumpen)
  P.duck = knoten(c, 1); P.duck.connect(P.summe);
  P.drums = knoten(c, K.mix.drums); P.drums.connect(P.summe);
  P.drumHall = knoten(c, 0.18); P.drumHall.connect(P.hallIn);
  P.keys = knoten(c, K.mix.keys); P.keys.connect(P.duck);
  const keysHall = knoten(c, 0.3); P.keys.connect(keysHall); keysHall.connect(P.hallIn);
  P.bass = knoten(c, K.mix.bass); P.bass.connect(P.duck);
  P.mel = knoten(c, K.mix.melodie); P.mel.connect(P.duck);
  const melHall = knoten(c, 0.5); P.mel.connect(melHall); melHall.connect(P.hallIn);
  // Tremolo auf den Keys (Rhodes-typisch)
  const trem = c.createOscillator(); trem.frequency.value = 4.3;
  const tremG = knoten(c, K.mix.keys * 0.12); trem.connect(tremG); tremG.connect(P.keys.gain); trem.start(0);
  // Tape-Leiern: langsame Tonhöhenschwankung (Cent) für alle tonalen Stimmen
  const wow = c.createOscillator(); wow.frequency.value = 0.47;
  P.wow = knoten(c, 9); wow.connect(P.wow); wow.start(0);
  const flutter = c.createOscillator(); flutter.frequency.value = 5.9;
  const flutterG = knoten(c, 2.2); flutter.connect(flutterG); flutterG.connect(P.wow); flutter.start(0);
  // Rauschen und Vinyl
  P.rausch = rauschPuffer(c, P.rnd, 1.3);
  const kn = c.createBufferSource(); kn.buffer = knisterPuffer(c, P.rnd); kn.loop = true;
  const knHp = c.createBiquadFilter(); knHp.type = "highpass"; knHp.frequency.value = 900;
  const knG = knoten(c, K.mix.knistern); kn.connect(knHp); knHp.connect(knG); knG.connect(P.summe); kn.start(0);
  const rs = c.createBufferSource(); rs.buffer = P.rausch; rs.loop = true;
  const rsBp = c.createBiquadFilter(); rsBp.type = "bandpass"; rsBp.frequency.value = 3800; rsBp.Q.value = 0.4;
  const rsG = knoten(c, K.mix.rauschen); rs.connect(rsBp); rsBp.connect(rsG); rsG.connect(P.summe); rs.start(0);
  P.panOk = typeof c.createStereoPanner === "function";
}
// Rhodes: FM (Träger + Modulator 1:1) mit abklingendem Index = weicher Anschlag mit „Bark“
function rhodes(P, ziel, midi, t, dauer, vel){
  const c = P.ctx, f = mtof(midi);
  const car = c.createOscillator(); car.frequency.value = f;
  const mod = c.createOscillator(); mod.frequency.value = f;
  const modG = c.createGain();
  modG.gain.setValueAtTime(f * (0.9 + vel * 1.4), t);
  modG.gain.exponentialRampToValueAtTime(f * 0.12, t + 0.8);
  mod.connect(modG); modG.connect(car.frequency);
  P.wow.connect(car.detune);
  const amp = c.createGain(), a = 0.14 * vel;
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(a, t + 0.007);
  amp.gain.setTargetAtTime(a * 0.28, t + 0.01, 0.55);
  amp.gain.setTargetAtTime(0.0001, t + dauer, 0.14);
  car.connect(amp); amp.connect(ziel);
  const ende = t + dauer + 1;
  car.start(t); mod.start(t); car.stop(ende); mod.stop(ende);
  car.onended = ()=>{ try{ P.wow.disconnect(car.detune); }catch(_){} };
}
function bass(P, midi, t, dauer, vel){
  const c = P.ctx, f = mtof(midi);
  const o1 = c.createOscillator(); o1.frequency.value = f;
  const o2 = c.createOscillator(); o2.type = "triangle"; o2.frequency.value = f;
  const o2G = knoten(c, 0.22);
  const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 520; lp.Q.value = 0.6;
  const amp = c.createGain(), a = 0.5 * vel;
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(a, t + 0.014);
  amp.gain.setTargetAtTime(a * 0.75, t + 0.02, 0.3);
  amp.gain.setTargetAtTime(0.0001, t + dauer, 0.05);
  o1.connect(lp); o2.connect(o2G); o2G.connect(lp); lp.connect(amp); amp.connect(P.bass);
  const ende = t + dauer + 0.4;
  o1.start(t); o2.start(t); o1.stop(ende); o2.stop(ende);
}
function kick(P, t, vel){
  const c = P.ctx;
  const o = c.createOscillator();
  o.frequency.setValueAtTime(118, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.11);
  const amp = c.createGain();
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(0.8 * vel, t + 0.004);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  o.connect(amp); amp.connect(P.drums);
  o.start(t); o.stop(t + 0.5);
  if(!P.ohneBeat){ const g = P.duck.gain; g.setValueAtTime(1, t); g.linearRampToValueAtTime(0.7, t + 0.018); g.setTargetAtTime(1, t + 0.03, 0.13); }
}
function rauschen(P, t, dauer){
  const s = P.ctx.createBufferSource(); s.buffer = P.rausch;
  s.start(t, P.rnd() * 0.8); s.stop(t + dauer); return s;
}
function snare(P, t, vel){
  const c = P.ctx;
  const n = rauschen(P, t, 0.4);
  const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1750; bp.Q.value = 0.7;
  const amp = c.createGain();
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(0.55 * vel, t + 0.003);
  amp.gain.setTargetAtTime(0.0001, t + 0.01, 0.055);
  n.connect(bp); bp.connect(amp); amp.connect(P.drums); amp.connect(P.drumHall);
  const o = c.createOscillator(); o.type = "triangle";
  o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
  const oa = c.createGain();
  oa.gain.setValueAtTime(0.0001, t); oa.gain.exponentialRampToValueAtTime(0.28 * vel, t + 0.003); oa.gain.setTargetAtTime(0.0001, t + 0.01, 0.035);
  o.connect(oa); oa.connect(P.drums);
  o.start(t); o.stop(t + 0.3);
}
function hihat(P, t, vel, offen){
  const c = P.ctx;
  const n = rauschen(P, t, offen ? 0.45 : 0.12);
  const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 7200;
  const amp = c.createGain();
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(0.34 * vel, t + 0.002);
  amp.gain.setTargetAtTime(0.0001, t + 0.004, offen ? 0.09 : 0.016);
  n.connect(hp); hp.connect(amp);
  if(P.panOk){ const pan = c.createStereoPanner(); pan.pan.value = 0.28; amp.connect(pan); pan.connect(P.drums); }
  else amp.connect(P.drums);
}

/* ---------- 4 KOMPONIST --------------------------------------------------------- */
function neueSitzung(P){
  P.bpm = K.bpm[0] + P.rnd() * (K.bpm[1] - K.bpm[0]);
  P.schrittDauer = 60 / P.bpm / 4;
  P.swingVersatz = (K.swing - 0.5) * 2 * P.schrittDauer;
  P.grund = wahl(P, K.tonarten);
  P.folge = wahl(P, K.folgen);
}
function playerAnlegen(ctx, opt){
  const P = { ctx, rnd:mulberry32((opt.seed >>> 0) || 1), ohneBeat:opt.stimmung === "ruhig", naechste:0, schritt:0, taktNr:-1 };
  graphBauen(P);
  neueSitzung(P);
  P.startTakt = 0;
  return P;
}
function voicing(P, stufe, typ){
  const wurzel = P.grund + stufe;
  const noten = K.akkorde[typ].map(iv => inLage(wurzel + iv, K.lage.keys));
  return Array.from(new Set(noten)).sort((a, b)=> a - b);
}
function taktPlanen(P, takt){
  if(P.neuMischen){ P.neuMischen = false; neueSitzung(P); P.startTakt = takt; P.drumsAusBis = takt + 1; P.nachMischen = true; }
  const rel = takt - P.startTakt;                 // Takte seit Beginn bzw. seit „Neu mischen“
  if(rel > 0 && rel % 8 === 0 && P.rnd() < 0.35){ const andere = K.folgen.filter(f => f !== P.folge); P.folge = wahl(P, andere); }
  const [stufe, typ] = P.folge[(takt - P.startTakt) % 4];
  P.akkord = voicing(P, stufe, typ);
  P.bassGrund = inLage(P.grund + stufe, K.lage.bass);
  P.keysMuster = wahl(P, KEYS_MUSTER);
  P.bassMuster = wahl(P, BASS_MUSTER);
  if(rel % 2 === 0) P.kickMuster = wahl(P, KICK_MUSTER);
  // Ruhige Stellen: die ersten 2 Takte nur Keys + Vinyl; alle 16 Takte evtl. 2 Takte Pause der Drums
  if(rel % 16 === 0 && rel > 0 && P.rnd() < 0.35) P.drumsAusBis = takt + 2;
  P.drumsAus = (rel < 2 && !P.nachMischen)   /* nach „Neu mischen“ nur 1 Takt Pause (drumsAusBis) */ || (P.drumsAusBis !== undefined && takt < P.drumsAusBis);
  P.fill = rel % 8 === 7;
  // Melodie: gelegentlich 1–3 Töne aus der Pentatonik
  P.melodie = [];
  if(rel >= 2 && P.rnd() < 0.4){
    const n = 1 + Math.floor(P.rnd() * 3);
    const schritte = Array.from(new Set(Array.from({ length:n }, ()=> wahl(P, MEL_SCHRITTE)))).sort((a, b)=> a - b);
    schritte.forEach(s => P.melodie.push([s, 2 + Math.floor(P.rnd() * 5), inLage(P.grund + wahl(P, PENTA) + 12 * Math.floor(P.rnd() * 2), K.lage.melodie), 0.5 + P.rnd() * 0.25]));
  }
}
function schrittPlanen(P, schritt, t){
  const s = schritt % 16, takt = Math.floor(schritt / 16);
  if(s === 0) taktPlanen(P, takt);
  const sd = P.schrittDauer;
  const tt = t + (s % 2 ? P.swingVersatz : 0);
  const mensch = ()=> (P.rnd() - 0.5) * 0.008;
  // Keys (leicht gebrochen angeschlagen)
  for(const [st, dau, vel] of P.keysMuster){
    if(st !== s) continue;
    const strum = 0.008 + P.rnd() * 0.014;
    P.akkord.forEach((n, i)=> rhodes(P, P.keys, n, tt + i * strum, dau * sd, Math.min(1, vel * (0.85 + P.rnd() * 0.25))));
  }
  for(const [st, dau, ton, vel] of P.bassMuster){
    if(st !== s) continue;
    const n = P.bassGrund + (ton === "Q" ? 7 : ton === "O" ? 12 : 0);
    bass(P, n, tt + 0.004, dau * sd, vel * (P.ohneBeat ? 0.8 : 1));
  }
  for(const [st, dau, n, vel] of P.melodie){ if(st === s) rhodes(P, P.mel, n, tt, dau * sd, vel); }
  if(P.ohneBeat || P.drumsAus) return;
  // Drums
  for(const [st, vel] of P.kickMuster){ if(st === s) kick(P, tt + mensch(), vel); }
  if(s === 4 || s === 12) snare(P, tt + 0.006 + mensch(), 0.9);
  else if((s === 7 || s === 15) && P.rnd() < 0.18) snare(P, tt + mensch(), 0.22);
  else if(P.fill && s >= 13 && P.rnd() < 0.55) snare(P, tt + mensch(), 0.2 + (s - 13) * 0.12);
  if(s % 2 === 0){
    if(s === 14 && P.rnd() < 0.25) hihat(P, tt + mensch(), 0.55, true);
    else if(P.rnd() > 0.08) hihat(P, tt + mensch(), (s % 4 === 0 ? 0.75 : 0.5) * (0.8 + P.rnd() * 0.3), false);
  }else if(P.rnd() < 0.12) hihat(P, tt + mensch(), 0.28, false);
}

/* ---------- 5 ABLAUF ------------------------------------------------------------- */
const LS_MUSIK = "tj_musik_v1";
const STANDARD = { an:false, lautstaerke:0.5, stimmung:"lofi" };
function ladeEinst(){
  try{ const e = JSON.parse(localStorage.getItem(LS_MUSIK) || "null"); if(e && typeof e === "object") return { ...STANDARD, ...e }; }catch(_){}
  return { ...STANDARD };
}
function speichereEinst(e){ try{ localStorage.setItem(LS_MUSIK, JSON.stringify(e)); }catch(_){} }
function zielPegel(e){ return K.lautMax * Math.pow(Math.max(0, Math.min(1, e.lautstaerke)), 1.7); }

let L = null;   // laufende Wiedergabe: { ctx, P, timer, warte, pause }
function kontextAnlegen(){
  if(L) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if(!AC) return false;
  try{
    // iPhone: „ambient“ folgt dem Stummschalter und mischt sich mit anderer Wiedergabe
    if(navigator.audioSession){ try{ if(navigator.audioSession.type === "auto") navigator.audioSession.type = "ambient"; }catch(_){} }
    const ctx = new AC({ latencyHint:"playback" });
    if(ctx.resume) ctx.resume();
    const sb = ctx.createBufferSource(); sb.buffer = ctx.createBuffer(1, 1, 22050); sb.connect(ctx.destination); sb.start(0);
    L = { ctx, P:null, timer:0, warte:0, pause:0 };
    return true;
  }catch(err){ console.warn("Musik: Audio nicht verfügbar", err); L = null; return false; }
}
// Muss in einer Nutzer-Geste laufen (Entsperren, Klick) — iOS gibt Ton nur dann frei
function vorbereiten(){ return ladeEinst().an ? kontextAnlegen() : false; }
function fader(P, ziel, dauer){
  const g = P.master.gain, t = P.ctx.currentTime;
  g.cancelScheduledValues(t);
  g.setValueAtTime(Math.max(g.value, 0.0001), t);
  g.exponentialRampToValueAtTime(Math.max(ziel, 0.0001), t + dauer);
}
function tick(){
  const P = L && L.P; if(!P) return;
  const jetzt = L.ctx.currentTime;
  if(P.naechste < jetzt - 0.05) P.naechste = jetzt + 0.05;   // Timer kam zu spät: nicht alles auf einmal nachholen
  let n = 0;
  while(P.naechste < jetzt + 0.3 && n++ < 64){ schrittPlanen(P, P.schritt, P.naechste); P.naechste += P.schrittDauer; P.schritt++; }
}
function laufen(){ if(L && !L.timer){ L.timer = setInterval(tick, 50); tick(); } }
function anhalten(){ if(L && L.timer){ clearInterval(L.timer); L.timer = 0; } }
// Nach dem Entsperren: wartet, bis das Intro vorbei ist, und blendet dann weich ein
function starten(){
  const e = ladeEinst();
  if(!e.an || !L || L.P) return;
  clearTimeout(L.warte);
  if(typeof INTRO !== "undefined" && INTRO.aktiv()){ L.warte = setTimeout(starten, 400); return; }
  if(document.visibilityState === "hidden") return;   // startet bei Rückkehr (visibilitychange)
  if(L.ctx.state !== "running" && L.ctx.resume) L.ctx.resume();
  L.P = playerAnlegen(L.ctx, { seed:Date.now(), stimmung:e.stimmung });
  L.P.naechste = L.ctx.currentTime + 0.15;
  fader(L.P, zielPegel(e), K.einblenden);
  laufen();
  knopfAktualisieren();
}
function stoppen(){
  if(!L) return;
  const l = L; L = null;
  clearTimeout(l.warte); clearTimeout(l.pause); if(l.timer) clearInterval(l.timer);
  if(l.P) try{ fader(l.P, 0.0001, K.ausblenden); }catch(_){}
  setTimeout(()=>{ try{ l.ctx.close(); }catch(_){} }, (l.P ? K.ausblenden + 0.25 : 0) * 1000);
  knopfAktualisieren();
}
function setzeAn(an){
  const e = ladeEinst(); e.an = an; speichereEinst(e);
  if(an){ if(kontextAnlegen()) starten(); } else stoppen();
  knopfAktualisieren();
}
function umschalten(){ setzeAn(!ladeEinst().an); }
// Im Hintergrund pausieren (spart Akku, iOS würde sonst abwürgen), bei Rückkehr weich weiter
document.addEventListener("visibilitychange", ()=>{
  if(!L) return;
  if(document.visibilityState === "hidden"){
    if(!L.P) return;
    anhalten(); fader(L.P, 0.0001, 0.25);
    clearTimeout(L.pause); L.pause = setTimeout(()=>{ try{ if(L && L.ctx.suspend) L.ctx.suspend(); }catch(_){} }, 320);
    return;
  }
  clearTimeout(L.pause);
  if(!L.P){ starten(); return; }
  const weiter = ()=>{
    if(!L || !L.P || L.ctx.state !== "running") return false;
    if(L.P.naechste < L.ctx.currentTime) L.P.naechste = L.ctx.currentTime + 0.05;
    fader(L.P, zielPegel(ladeEinst()), K.zurueck); laufen(); return true;
  };
  const p = L.ctx.resume ? L.ctx.resume() : null;
  if(p && p.then) p.then(()=>{
    if(weiter()) return;
    // iOS lässt den Ton manchmal erst nach der nächsten Berührung wieder zu
    const nachGeste = ()=>{ if(L && L.ctx.resume) L.ctx.resume().then(weiter).catch(()=>{}); };
    document.addEventListener("pointerdown", nachGeste, { once:true, capture:true });
  }).catch(()=>{}); else weiter();
});

// Test: rendert ohne Lautsprecher (OfflineAudioContext) — z. B. MUSIK.offline(30).then(buf => …)
function offline(sek, opt){
  opt = opt || {};
  const sr = opt.sr || 44100;
  const c = new OfflineAudioContext(2, Math.ceil(sr * sek), sr);
  const P = playerAnlegen(c, { seed:opt.seed || 7, stimmung:opt.stimmung || "lofi" });
  P.master.gain.value = zielPegel({ lautstaerke: opt.lautstaerke !== undefined ? opt.lautstaerke : 0.7 });
  P.naechste = 0.05;
  while(P.naechste < sek - 0.3){ schrittPlanen(P, P.schritt, P.naechste); P.naechste += P.schrittDauer; P.schritt++; }
  return c.startRendering().then(buf => ({ buf, bpm:P.bpm, grund:P.grund }));
}

/* ---------- 6 BEDIENUNG -------------------------------------------------------- */
function knopfAktualisieren(){
  const b = document.getElementById("btnMusik"); if(!b) return;
  const an = ladeEinst().an, spielt = !!(L && L.P);
  b.classList.toggle("is-on", an);
  b.classList.toggle("is-playing", spielt);
  b.setAttribute("aria-pressed", an ? "true" : "false");
  b.title = an ? "Lo-Fi-Musik ausschalten" : "Lo-Fi-Musik einschalten";
}
(function knopfVerdrahten(){
  const b = document.getElementById("btnMusik"); if(!b) return;
  b.addEventListener("click", umschalten);
  knopfAktualisieren();
})();

function einstellungenHtml(){
  const e = ladeEinst();
  return `<div class="field-group intro-set musik-set">
    <label class="fg-label">Hintergrundmusik <span class="intro-set-hint">· Lo-Fi, live erzeugt · nur dieses Gerät</span></label>
    <div class="intro-set-row">
      <span class="intro-set-label">Musik</span>
      ${chipGroupHtml("musikAn", ["an","aus"], e.an ? "an" : "aus", { labels:{ an:"An", aus:"Aus" } })}
    </div>
    <div class="intro-set-row">
      <span class="intro-set-label">Stil</span>
      ${chipGroupHtml("musikStil", ["lofi","ruhig"], e.stimmung, { labels:{ lofi:"Lo-Fi Beats", ruhig:"Ohne Beat" } })}
      <button type="button" class="btn btn-sm" id="musikNeuBtn" title="Neue Tonart, neues Tempo, neue Akkorde">Neu mischen</button>
    </div>
    <div class="intro-set-row">
      <span class="intro-set-label">Lautstärke</span>
      <input type="range" class="musik-laut" id="musikLaut" min="0" max="100" step="1" value="${Math.round(e.lautstaerke * 100)}" aria-label="Lautstärke der Hintergrundmusik">
    </div>
    <div class="intro-set-note">Startet nach dem Entsperren (nach dem Intro) weich und pausiert, wenn die App im Hintergrund ist. Am iPhone folgt sie dem Stummschalter. An/Aus auch über den Knopf oben rechts.</div>
  </div>`;
}
function einstellungenVerdrahten(root){
  const box = root && root.querySelector(".musik-set"); if(!box) return;
  box.addEventListener("click", (ev)=>{
    const b = ev.target.closest("button[data-group]");
    if(b){
      const g = b.dataset.group, v = b.dataset.value;
      syncChipGroup(b.closest("[data-chipgroup]"), v, false);
      if(g === "musikAn"){ setzeAn(v === "an"); return; }
      if(g === "musikStil"){ const e = ladeEinst(); e.stimmung = v; speichereEinst(e); if(L && L.P) L.P.ohneBeat = v === "ruhig"; }
      return;
    }
    if(ev.target.closest("#musikNeuBtn")){
      if(L && L.P) L.P.neuMischen = true;
      else { setzeAn(true); const an = box.querySelector('[data-chipgroup="musikAn"]'); if(an) syncChipGroup(an, "an", false); }
    }
  });
  const laut = box.querySelector("#musikLaut");
  if(laut) laut.addEventListener("input", ()=>{
    const e = ladeEinst(); e.lautstaerke = Number(laut.value) / 100; speichereEinst(e);
    if(L && L.P && L.timer) fader(L.P, zielPegel(e), 0.08);
  });
}

return {
  vorbereiten, starten, umschalten, stoppen, einstellungenHtml, einstellungenVerdrahten, offline,
  zustand:()=> L ? { ctx:L.ctx.state, spielt:!!L.P, laeuft:!!L.timer, bpm:L.P ? +L.P.bpm.toFixed(1) : null, grund:L.P ? L.P.grund : null } : null
};
})();
