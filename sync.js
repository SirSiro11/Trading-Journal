/* sync.js — Google-Drive-Sync über den Cloud-Run-Proxy (Pull/Push/Konflikt) */
/* =========================================================================
   GOOGLE DRIVE SYNC (über eigenen Cloud-Proxy)
   Das Journal spricht nie direkt mit Google — stattdessen mit einer eigenen,
   kleinen Cloud-Funktion (journalProxy), die den Google-Zugriff dauerhaft im
   Hintergrund hält (per Refresh Token, serverseitig). Dadurch entfällt jeder
   Login-Dialog im Browser komplett, auf jedem Gerät gleichermaßen — die App
   ist praktisch immer "verbunden", ohne dass je ein Nutzer etwas bestätigen
   müsste.
   Baut auf dem "letzte Änderung / letztes Backup"-Tracking oben auf: ein
   erfolgreicher Push zählt genauso als "gesichert" (markBackedUp()) wie ein
   manueller JSON-Export — das Header-Badge greift also weiterhin.
   ========================================================================= */
const GDRIVE_PROXY_URL = "https://journalproxy-1078170007474.europe-west3.run.app";
const GDRIVE_PROXY_KEY = "eSBG3zYoWXvwXRF2Qv5VCRZokk2oaeur";

let gdrivePushTimer = null;
let gdriveBusy = false;          // verhindert überlappende Pull/Push-Aufrufe
let gdriveLastPullAt = 0;        // für den Pull bei Rückkehr in die App (visibilitychange)
const GDRIVE_REPULL_MIN_MS = 60 * 1000;

// Welchen Cloud-Stand (savedAt) hat DIESES Gerät zuletzt gesehen? Ist der Stand in der
// Cloud beim Push neuer als das, hat zwischenzeitlich ein anderes Gerät geschrieben —
// dann darf nicht blind überschrieben werden (Konflikt, siehe gdrivePush).
function getDriveSeenAt(){
  const v = parseInt(localStorage.getItem(LS_DRIVE_SEEN), 10);
  if(v) return v;
  // Gerät, das schon vor Einführung der Konfliktprüfung synchronisiert hat: Zeitpunkt des
  // letzten erfolgreichen Sync/Backups als Näherung, sonst gäbe es einmalig einen Fehlalarm.
  return getLastBackupAt() || 0;
}
function setDriveSeenAt(ts){ try{ localStorage.setItem(LS_DRIVE_SEEN, String(ts)); }catch(e){} }

async function gdriveFetchRemote(){
  const res = await fetch(GDRIVE_PROXY_URL, { method:"GET", headers:{ "X-Journal-Key": GDRIVE_PROXY_KEY } });
  if(res.status === 404) return null; // noch keine Cloud-Datei
  if(!res.ok) throw new Error("Proxy antwortete mit " + res.status);
  return expandPayloadShots(await res.json()); // GEÄNDERT (Stufe 2): kompaktes Format entpacken
}

// Übernimmt einen Cloud-Stand lokal — OHNE markDataChanged/Auto-Push. Der lokale
// "letzte Änderung"-Zeitstempel wird auf savedAt der Cloud gesetzt, damit beide Seiten
// als identisch gelten (vorher löste jeder Pull 4 s später einen sinnlosen Push aus, der
// savedAt hochzählte und auf allen anderen Geräten wieder einen Pull provozierte).
function applyRemoteState(remote){
  STATE.trades = migrateTrades(Array.isArray(remote.trades) ? remote.trades : []);
  if(remote.config) STATE.config = Object.assign(JSON.parse(JSON.stringify(DEFAULT_CONFIG)), remote.config);
  if(Array.isArray(remote.insights)) STATE.insights = remote.insights;
  STATE.dayConfirmations = Array.isArray(remote.dayConfirmations) ? remote.dayConfirmations : [];
  // Cloud-Stand eines noch nicht aktualisierten Geräts hat kein "news"-Feld — dann lokale News behalten.
  if(remote.news && Array.isArray(remote.news.events)) STATE.news = pruneNewsStore(sanitizeNewsStore(remote.news));
  const cloudHadAltlasten = backtestRemovedCount > 0 || strukturRemovedCount > 0;
  persistLocalData(); // Trades + Erkenntnisse + Bild-Speicher gemeinsam
  safeSetItem(LS_CONFIG, JSON.stringify(STATE.config));
  safeSetItem(LS_DAYCONFIRM, JSON.stringify(STATE.dayConfirmations));
  safeSetItem(LS_NEWS, JSON.stringify(STATE.news));
  const savedAt = remote.savedAt || Date.now();
  localStorage.setItem(LS_LASTCHANGE, String(savedAt));
  setDriveSeenAt(savedAt);
  markBackedUp();
  if(gdrivePushTimer){ clearTimeout(gdrivePushTimer); gdrivePushTimer = null; }
  // Lagen in der Cloud noch Altlasten (Backtest-Einträge oder das entfernte Feld
  // "struktur"), wird der bereinigte Stand zurückgeschrieben — sonst würde jedes
  // Gerät sie bei jedem Pull erneut wegwerfen und die Cloud-Datei bliebe alt.
  if(cloudHadAltlasten) markDataChanged();
  // Ein Cloud-Stand von einem noch nicht aktualisierten Gerät bringt die alte
  // Kategorien-Konfiguration mit — deshalb hier erneut angleichen.
  migrateStrategyCategories();
}

// Schreibt den aktuellen lokalen Stand über den Proxy nach Google Drive.
// force=true überspringt die Konfliktprüfung (nur nach ausdrücklicher Nutzerentscheidung).
// GEÄNDERT: Sync-Statuswechsel (syncing/verbunden/Fehler) zeichnen nicht mehr die ganze
// Ansicht neu — das ließ kurz nach dem Speichern die aktuelle Seite ein zweites Mal
// "einladen". Aktualisiert werden nur Backup-Badge und die Sync-Anzeigen der Startseite.
function refreshSyncUi(){
  updateBackupBadge();
  if(STATE.view !== "start" || STATE.viewingTrade) return;
  const bar = document.querySelector(".start-status");
  if(!bar) return;
  bar.outerHTML = renderStartStatusbar();
  const alertHtml = renderStartSyncAlert();
  const oldAlert = document.querySelector(".start-alert");
  if(oldAlert){ if(alertHtml) oldAlert.outerHTML = alertHtml; else oldAlert.remove(); }
  else if(alertHtml){ const bento = document.querySelector(".start-bento"); if(bento) bento.insertAdjacentHTML("afterbegin", alertHtml); }
  wireStartSync();
}

async function gdrivePush(force){
  if(gdriveBusy){ scheduleDriveAutoPush(); return; }
  gdriveBusy = true;
  STATE.driveStatus = "syncing"; refreshSyncUi();
  try{
    if(!force){
      // Konfliktprüfung: Hat ein anderes Gerät seit unserem letzten Abgleich geschrieben?
      const remote = await gdriveFetchRemote();
      const remoteSavedAt = remote ? (remote.savedAt || 0) : 0;
      if(remote && remoteSavedAt > getDriveSeenAt()){
        STATE.driveStatus = "conflict";
        STATE.driveConflictRemote = remote;
        STATE.driveError = "";
        gdriveBusy = false;
        refreshSyncUi();
        toast("⚠ In der Cloud liegt ein neuerer Stand von einem anderen Gerät — bitte auf der Startseite entscheiden.", null, null, 8000);
        return;
      }
    }
    const payload = buildBackupPayload();
    const res = await fetch(GDRIVE_PROXY_URL, {
      method: "POST",
      headers: { "X-Journal-Key": GDRIVE_PROXY_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if(!res.ok) throw new Error("Proxy antwortete mit " + res.status);
    setDriveSeenAt(payload.savedAt);
    markBackedUp();
    STATE.driveLastSyncAt = Date.now();
    STATE.driveStatus = "connected";
    STATE.driveError = "";
    STATE.driveConflictRemote = null;
  }catch(err){
    STATE.driveStatus = "error";
    STATE.driveError = err.message || String(err);
  }
  gdriveBusy = false;
  refreshSyncUi();
}

// Gleicht lokal und Cloud ab: neuerer Stand gewinnt (Vergleich über "savedAt" im
// Backup bzw. den lokalen "letzte Änderung"-Zeitstempel).
async function gdrivePull(){
  if(gdriveBusy) return;
  let pulledData = false;
  gdriveBusy = true;
  STATE.driveStatus = "syncing"; refreshSyncUi();
  try{
    const remote = await gdriveFetchRemote();
    gdriveLastPullAt = Date.now();
    if(!remote){
      gdriveBusy = false;
      await gdrivePush(true); // noch keine Cloud-Datei -> aktuellen Stand als erste Version anlegen
      return;
    }
    const remoteSavedAt = remote.savedAt || 0;
    const localChangedAt = getLastChangeAt();
    if(remoteSavedAt > localChangedAt){
      applyRemoteState(remote);
      pulledData = true;
      toast("Neuester Stand geladen.");
    }else if(localChangedAt > remoteSavedAt){
      // Lokal ist neuer. Wenn wir den Cloud-Stand aber noch nie gesehen haben (frisches Gerät,
      // z. B. mit Demo-Daten, während die Cloud längst echte Daten hat), ist das ein Konflikt.
      if(remoteSavedAt > getDriveSeenAt()){
        STATE.driveStatus = "conflict";
        STATE.driveConflictRemote = remote;
        STATE.driveError = "";
        gdriveBusy = false;
        refreshSyncUi();
        return;
      }
      gdriveBusy = false;
      await gdrivePush(); // lokal neuer -> hochladen (kümmert sich selbst um Status/Render)
      return;
    }else{
      setDriveSeenAt(remoteSavedAt);
    }
    STATE.driveLastSyncAt = Date.now();
    STATE.driveStatus = "connected";
    STATE.driveError = "";
    STATE.driveConflictRemote = null;
  }catch(err){
    STATE.driveStatus = "error";
    STATE.driveError = err.message || String(err);
  }
  gdriveBusy = false;
  // Neue Daten aus der Cloud -> Ansicht neu zeichnen (ohne Fade); sonst nur den Status.
  if(pulledData) render(); else refreshSyncUi();
}

// Konfliktauflösung (Buttons auf der Startseite): Cloud-Stand übernehmen (lokale
// Änderungen gehen verloren) oder lokalen Stand hochladen (Cloud wird überschrieben).
async function gdriveResolveConflict(useRemote){
  if(useRemote){
    const remote = STATE.driveConflictRemote || await gdriveFetchRemote();
    if(remote){ applyRemoteState(remote); toast("Cloud-Stand übernommen."); }
    STATE.driveConflictRemote = null;
    STATE.driveStatus = "connected";
    STATE.driveLastSyncAt = Date.now();
    render();
  }else{
    STATE.driveConflictRemote = null;
    await gdrivePush(true);
  }
}

// Wird nach jeder lokalen Änderung aufgerufen (siehe markDataChanged), stößt einen
// verzögerten Push an, statt bei jeder einzelnen Änderung sofort zu synchronisieren.
function scheduleDriveAutoPush(){
  if(gdrivePushTimer) clearTimeout(gdrivePushTimer);
  gdrivePushTimer = setTimeout(()=>{ gdrivePushTimer = null; gdrivePush(); }, 4000);
}

// Kommt die App wieder in den Vordergrund (Tab-Wechsel, iPhone entsperrt), den Cloud-
// Stand nachladen — sonst laufen zwei parallel offene Geräte auseinander, bis eines
// neu geladen wird. Nicht, wenn gerade ein eigener Push ansteht (der hat Vorrang).
document.addEventListener("visibilitychange", ()=>{
  if(document.visibilityState !== "visible") return;
  if(document.getElementById("appShell").style.display === "none") return; // noch gesperrt
  if(gdrivePushTimer || gdriveBusy || STATE.driveStatus === "conflict") return;
  if(Date.now() - gdriveLastPullAt < GDRIVE_REPULL_MIN_MS) return;
  gdrivePull();
});

