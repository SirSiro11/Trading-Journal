/* js/strategie.js — Strategie-Reiter und Erkenntnis-Formular */
/* =========================================================================
   STRATEGIE
   Statisches Nachschlagewerk zum eigenen Entry-Modell — reine Anzeige,
   keine Daten in STATE. Inhalt 1:1 nach Vorgabe übernommen.
   ========================================================================= */
const STRAT_IMG_LIMIT = "img/strategie/limit.png";

const STRAT_IMG_CONFIRMATION = "img/strategie/confirmation.png";
const STRAT_IMG_SWEEP = "img/strategie/sweep.png";
const STRAT_IMG_FLIP = "img/strategie/flip.png";
const STRAT_IMG_CONTINUATION = "img/strategie/continuation.png";
const STRAT_IMG_COUNTER_M5 = "img/strategie/counter-m5.png";
const STRAT_IMG_COUNTER_FT = "img/strategie/counter-ft.png";

const STRATEGY_ENTRIES = [
  { key:"limit", icon:"🎯", name:"Limit Entry", thumb: STRAT_IMG_LIMIT },
  { key:"confirmation", icon:"✅", name:"Confirmation Entry", thumb: STRAT_IMG_CONFIRMATION },
  { key:"sweep", icon:"🧹", name:"Sweep Entry", thumb: STRAT_IMG_SWEEP },
  { key:"flip", icon:"🔄", name:"Flip Entry", thumb: STRAT_IMG_FLIP },
  { key:"continuation", icon:"➡️", name:"Continuation Entry", thumb: STRAT_IMG_CONTINUATION },
  { key:"counter", icon:"↩️", name:"Counter Trend Entry", thumb: STRAT_IMG_COUNTER_M5 }
];

// Ausführliche Detailbeschreibung je Entry-Art, im Kartenmodal angezeigt.
// Generisches Block-Schema: images (1 oder 2 Diagramme) + blocks (Reihenfolge = Anzeige).
// Block-Typen: {t:"p", h:<html>} · {t:"h3", h:<text>} · {t:"ul"|"ol", items:[...]} ·
// {t:"table", head:[...], rows:[[...],...]}
const STRATEGY_ENTRY_DETAILS = {
  limit: {
    title: "Limit Entry",
    images: [STRAT_IMG_LIMIT],
    blocks: [
      { t:"p", h:"Beim Limit Entry legen wir unsere Order in die Zone und lassen uns vom Markt abholen. Es gibt keine Bestätigung auf der kleinen Zeiteinheit — wir vertrauen ausschließlich auf die Qualität der Zone. Deshalb hat der Limit Entry die höchste Anforderung an das Setup: nur erlaubt, wenn alle sechs Kriterien erfüllt sind — und nur pro Trend, also mit dem Order Flow." },
      { t:"h3", h:"Wann Limit" },
      { t:"ul", items:[
        "Die Zone erfüllt alle sechs Kriterien (6/6)",
        "Wir handeln mit dem Order Flow, nicht dagegen",
        "Die Zone hat vorher sauber Liquidität abgegriffen",
        "Die Zone liegt an einem Level (32er Flip, 50er, 71er)",
        "Es gibt eine Early Zone bzw. ein Inducement davor"
      ]},
      { t:"h3", h:"Vorteil / Nachteil" },
      { t:"ul", items:[
        "<b>Vorteil:</b> Wir müssen nicht am Chart sitzen — Order liegt, Alarm reicht",
        "<b>Nachteil:</b> Keine Bestätigung — bricht die Zone, sind wir sofort falsch"
      ]},
      { t:"h3", h:"Ablauf" },
      { t:"ol", items:[
        "Limit an die Zone, SL über bzw. unter die komplette Zone — Docht mitnehmen",
        "TP in die nächste Liquidität, Struktur-Low oder nächste Zone"
      ]},
      { t:"p", h:"Beide markierten Bereiche sind Supply auf M15 und erfüllen alle Kriterien. Weil der Order Flow short läuft, sind beide als Limit handelbar – zuerst die obere Zone, später die tiefere als eigenständiger Trade. Der Stop liegt jeweils über der kompletten Zone, das Ziel ist die Liquidität darunter. Genau das meint Pro Trend: Die Order liegt nur dort, wo wir mit der Bewegung laufen. Gegen den Order Flow gibt es kein Limit – dort braucht es eine Bestätigung." }
    ]
  },

  confirmation: {
    title: "Confirmation Entry",
    images: [STRAT_IMG_CONFIRMATION],
    blocks: [
      { t:"p", h:"Der CE ist der Standard-Entry. Wir warten, bis der Preis unsere Zone erreicht, und steigen erst ein, wenn auf der kleineren Zeiteinheit die Struktur wechselt — der Change of Character (ChoCh) also gegen die Bewegung bricht, die in die Zone hineingelaufen ist." },
      { t:"h3", h:"Ablauf" },
      { t:"ol", items:[
        "Der Preis erreicht den HTF-POI",
        "Innerhalb der Zone bildet sich ein höheres Hoch (bei Short) bzw. tieferes Tief (bei Long)",
        "Das relevante Tief bestimmen — der äußerste Punkt der letzten Bewegung",
        "Bruch dieses Tiefs = ChoCh, angesetzt an der äußersten Kante",
        "Retracement in den entstandenen LTF-Orderblock / Retest-Bereich",
        "Entry nach Bestätigung des Orderblocks"
      ]},
      { t:"p", h:"<b>Wann Pflicht:</b> immer dann, wenn ein Kriterium fehlt — kein Abgriff, Trendlinie über der Zone, Struktur schon vorher gebildet, Zone „nicht so nice“. Dann kein Limit, sondern Bestätigung abwarten." },
      { t:"p", h:"<b>Nachteil:</b> Wir verpassen Trades, wenn der neue Orderblock nicht mehr angetestet wird." },
      { t:"p", h:"Die Struktur ist short, der korrektive Anstieg zeigt Schwäche und baut Liquidität auf. Der Markt holt die LQs vom letzten internen Hoch, läuft in die valide POI und liefert dort den Change of Character. Der Einstieg liegt im Retest-Bereich, der SL über der Zone, das Ziel 3–4R in Richtung Liquidität, Struktur-Low oder nächster Zone." }
    ]
  },

  sweep: {
    title: "Sweep Entry",
    images: [STRAT_IMG_SWEEP],
    blocks: [
      { t:"p", h:"Beim Sweep Entry warten wir darauf, dass der Markt ein Hoch oder Tief mit einem Docht abgreift und der Body wieder zurück auf die andere Seite schließt. Der Abgriff selbst ist unsere Bestätigung: Die Liquidität, die uns hätte gefährlich werden können, ist weg. Genau deshalb ist der SE der Entry mit dem saubersten Stop." },
      { t:"h3", h:"Kriterien" },
      { t:"ul", items:[
        "Ein klar sichtbares Level wird abgegriffen: letztes Hoch/Tief, Equal Highs/Lows, Trendline, Asia-Hoch/-Tief oder eine normale Supply / Demand",
        "Der Abgriff ist ein Docht, kein Body Close jenseits des Levels",
        "Der Body Close kommt zurück in die Zone bzw. zurück über das Level",
        "Danach kommt die Reaktion — im besten Fall direkt mit Momentum"
      ]},
      { t:"p", h:"<b>Doji-Regel:</b> Doji-Kerzen werden so gut wie immer gesweept — genau dort lohnt es sich, den Einstieg zu suchen." },
      { t:"h3", h:"Ablauf" },
      { t:"ol", items:[
        "Über dem letzten Hoch bzw. unter dem letzten Tief liegen die Stops — oder eine Zone",
        "Der Markt greift mit dem Docht ab, der Body schließt zurück",
        "Entry nach dem Abgriff, SL über dem Docht — darüber liegt nichts mehr"
      ]},
      { t:"p", h:"Wenn eine Zone selbst keine Liquidität gesweept hat, wird sie häufig selbst gezogen. Dann ist der SE die einzige Art, diese Zone überhaupt zu handeln — und zwar erst nach dem Abgriff, nicht davor." },
      { t:"p", h:"Der Markt läuft in die Zone und nimmt mit dem Docht die Hochs darüber mit — die Stops der Trader, die zu früh eingestiegen sind, werden getriggert. Erst danach kommt der Change of Character — und darunter liegt der Einstieg. Der Stop gehört über den Docht des Abgriffs: Die Liquidität darüber ist geholt, deshalb ist genau das die sicherste Stelle für den SL — und der Grund, warum der Sweep Entry das beste CRV aller Bestätigungs-Entrys liefert." }
    ]
  },

  flip: {
    title: "Flip Entry",
    images: [STRAT_IMG_FLIP],
    blocks: [
      { t:"p", h:"Eine Flip Zone ist erst einmal nichts anderes als eine Supply oder Demand. Der Unterschied liegt darin, wie sie entsteht: Sie ist die Zone, die eine gegenüberliegende Zone durchbrochen hat. Der Flip Entry ist der Einstieg für die Situation, in der der Trade nicht abholt — statt hinterherzulaufen, wird die Zone gehandelt, die den Bruch verursacht hat." },
      { t:"h3", h:"Kriterien für eine Flip Zone" },
      { t:"ol", items:[
        "Der Markt muss die zu brechende Zone vorher antesten",
        "Die gebrochene Zone muss vorher zu etwas geführt haben (HH bzw. TT)",
        "Der Bruch passiert mit Momentum, nicht schleichend",
        "Der Körper der M15-Kerze schließt außerhalb der geflippten Zone — bei M5-Zonen reicht der Docht",
        "Beim Bruch werden SLs abgegriffen — das ist unsere Liquidität"
      ]},
      { t:"table", head:["Geflippte Zone","Einstieg"], rows:[
        ["H4","M15"], ["M15","M5"], ["M5","M1 / M2"]
      ]},
      { t:"p", h:"Ist die Flip Zone zu groß für ein sauberes CRV, geht es eine Ebene tiefer, um sie zu refinen — aber nur, wenn das Bild dort ebenfalls sauber ist. Der stärkste Flip ist der <b>Trendline-Flip</b>: Bruch der Trendlinie, dann Retest. Bei Trendlinien gibt es fast immer Momentum." },
      { t:"p", h:"Der Trade oben wird nicht abgeholt. Stattdessen bricht der Markt die Demand aus der aktuellen Range und greift dabei die Stops darunter ab. Die Zone, die zum Bruch geführt hat, ist die Flip Zone — dort liegt der Einstieg, der SL darüber und das Ziel in Richtung der nächsten Liquidität." }
    ]
  },

  continuation: {
    title: "Continuation Entry",
    images: [STRAT_IMG_CONTINUATION],
    blocks: [
      { t:"p", h:"Der Continuation Entry ist kein neuer Trade im eigentlichen Sinn, sondern die Fortsetzung eines Trades, der bereits läuft. Trade 1 bleibt drin, der SL wird angepasst, und in der nächsten Zone in Trendrichtung wird eine zweite Position nachgelegt — so wird das volle Potenzial einer Bewegung ausgeschöpft, ohne eine einzelne Position über 10R halten zu müssen." },
      { t:"h3", h:"Kriterien" },
      { t:"ul", items:[
        "Trade 1 läuft und hat bereits einen Bruch in unsere Richtung gemacht",
        "Es gibt einen sauberen BOS — das ist die Bestätigung der Struktur",
        "Aus dem Impuls ist eine neue, valide Zone entstanden",
        "Vor der neuen Zone liegt wieder Liquidität (LQs vom letzten internen Hoch bzw. Tief)",
        "Die Imbalance ist vorhanden — fehlt sie, ist es kein Conti"
      ]},
      { t:"p", h:"<b>Wichtig:</b> Ohne neue Zone kein Conti. Läuft der Markt einfach nur durch, ohne eine saubere Zone zu hinterlassen, fehlt das Kriterium — dann bleibt es bei Trade 1. Der Entry wird in die neue Zone gelegt, sobald der BOS steht. SL über die neue Zone, TP wieder 3–4R in Richtung Liquidität, Struktur-Low oder nächste Zone." },
      { t:"p", h:"Trade 1 aus der oberen POI bleibt drin, der SL wandert auf Break-Even oder wird angepasst. Nach dem BOS entsteht eine neue Zone mit frischer Liquidität davor — dort wird die zweite Entry reingelegt, um die Fortsetzung der Bewegung mitzunehmen." }
    ]
  },

  counter: {
    title: "Counter Trend Entry",
    images: [STRAT_IMG_COUNTER_M5, STRAT_IMG_COUNTER_FT],
    blocks: [
      { t:"p", h:"Counter heißt: Extern sind wir long, gehandelt wird der interne Schenkel short — oder umgekehrt. Die Gegenbewegung wird bis zur nächsten Zone mitgenommen, statt gegen die große Richtung zu kämpfen. Das ist der Entry mit der geringsten Trefferwahrscheinlichkeit — deshalb gilt hier immer: halbes Risiko, mehr Bestätigung, klar begrenztes Ziel." },
      { t:"h3", h:"Regeln für Counter Trades" },
      { t:"ul", items:[
        "Niemals mit Limit — Counter wird ausschließlich bestätigt gehandelt",
        "Der erste ChoCh nach dem Tap wird nicht gehandelt — er muss erst abgegriffen werden",
        "Ziel ist der 50-%-Bereich des Schenkels — nicht die große Bewegung",
        "Kommt der Einstieg selbst schon vom 50 %, wird der Trade ausgelassen",
        "Nur bis zum 32er zurückgelaufen? Aggressive Trendfortsetzung — kein Counter",
        "Risiko halbieren (0,5 %)"
      ]},
      { t:"h3", h:"Die Fibo-Level in der Praxis" },
      { t:"table", head:["Level","Bedeutung"], rows:[
        ["32er","aggressive Trendfortsetzung — für einen Counter bleibt zu wenig Weg"],
        ["50er","Hauptlevel: Ziel und Kriterium zum Nachziehen der Struktur"],
        ["71er","tiefes Retracement — bevorzugter Bereich für Gegenbewegungen"]
      ]},
      { t:"h3", h:"Zwei Varianten aus dem Chart" },
      { t:"h3", h:"Counter Trend Trade M5" },
      { t:"p", h:"Extern ist der Markt long (Pro long). Er läuft in die Counter Zone auf M15 und liefert dort auf M5 den Change of Character — das ist der M5-CE. Ab da ist der Orderflow intern short. Das Ziel liegt im 50-%-Bereich des Schenkels. Kommt der Einstieg selbst schon vom 50 %, wird der Trade nicht genommen — der Weg zum Ziel wäre zu kurz und das CRV stimmt nicht mehr." },
      { t:"h3", h:"Counter Trend Trade First Tap M1" },
      { t:"p", h:"Der Markt tappt zum ersten Mal in die Counter Zone (First Tap). Was dann fast immer kommt, ist ein Fake CE — ein Change of Character, der nur Liquidität einsammelt und nicht hält. Deshalb: auf den ersten ChoCh warten, der muss erst abgegriffen werden. Erst der darauffolgende, echte CE ist der Einstieg, verfeinert auf M1/M2. So wird genau die Stelle umgangen, an der die meisten Counter Trades ausgestoppt werden." }
    ]
  }
};

function renderStrategie(){
  return `
    <div class="page-head">
      <h1>Strategie</h1>
      <p>Das eigene Entry-Modell als Nachschlagewerk — Voraussetzungen, alle Entry-Arten sowie SL/TP/Risiko und Checkliste.</p>
    </div>

    <div class="chip-group" style="margin-bottom:24px;">
      <button type="button" class="chip" data-stratjump="strat-entries">Entry-Arten</button>
      <button type="button" class="chip" data-stratjump="strat-voraussetzungen">Voraussetzungen</button>
      <button type="button" class="chip" data-stratjump="strat-sltp">SL, TP & Risiko</button>
      <button type="button" class="chip" data-stratjump="strat-invalidierung">Invalidierung & Checkliste</button>
    </div>

    <div class="section-title" id="strat-entries" style="margin-top:0;">Entry-Arten</div>
    <div class="strat-entry-grid">
      ${STRATEGY_ENTRIES.map(e => `
        <div class="strat-entry-card" data-stratentry="${e.key}" data-stratjump="strat-entry-detail" tabindex="0" role="button">
          <div class="strat-entry-thumb">${e.thumb ? `<img src="${e.thumb}" alt="" loading="lazy" decoding="async">` : e.icon}</div>
          <div class="strat-entry-card-body">
            <div class="strat-entry-name">${e.name}</div>
            <div class="strat-entry-hint">Antippen für Details</div>
          </div>
        </div>
      `).join("")}
    </div>

    <div class="strat-panel" id="strat-voraussetzungen">
      <h2>Voraussetzungen für einen Entry</h2>
      <p>Ein Entry ist kein Bauchgefühl und keine Kerze, die uns gerade gefällt. Der Entry ist der letzte Schritt einer Kette, die vorher komplett stehen muss: Struktur, relevante Zone, Liquidität. Das Entrymodell entscheidet nicht, <b>ob</b> wir handeln – das entscheiden die Zonenkriterien. Das Entrymodell entscheidet nur, <b>wie</b> wir in die Zone hineinkommen und wo unser Stop-Loss liegt. Genau daraus ergibt sich unser Chancen/Risiko-Verhältnis.</p>

      <h3>Reihenfolge vor jedem Entry</h3>
      <ol>
        <li>M15-Struktur bestimmen und das Fib anlegen</li>
        <li>Zonen mit Kriterien auf M15 an den Fib-Levels einzeichnen</li>
        <li>Alarm setzen und einen Plan haben</li>
        <li>Entry wählen</li>
      </ol>

      <h3>Die 6 Kriterien — wir wollen 6/6</h3>
      <ul>
        <li><b>BOS / ChoCh</b> — die Zone muss zu etwas geführt haben</li>
        <li><b>IMB</b> — offene Imbalance vor der Zone</li>
        <li><b>EZ / IND</b> — Early Zone bzw. Inducement davor</li>
        <li><b>LQs</b> — die Zone hat Liquidität abgegriffen</li>
        <li><b>GB</b> — Level-Konfluenz (Gannbox / Fibo 32, 50, 71)</li>
        <li><b>LQ als Ziel</b> — oberhalb bzw. unterhalb liegt Liquidität, in die wir laufen können</li>
      </ul>
    </div>

    <div class="strat-panel" id="strat-entry-detail">
      <div class="strat-quote">„Limit darfst du nur traden, wenn die Zonen-Kriterien alle gegeben sind. Ein Liquiditätsabgriff gehört halt auch dazu. Sobald Liquiditätsabgriffe fehlen oder irgendein Kriterium fehlt: einfach Finger davon lassen und mit einem CE bestätigen lassen.“</div>

      <table class="strat-table">
        <tr><th>Lage</th><th>Einstieg</th></tr>
        <tr><td>6/6, sauberer Abgriff vorhanden</td><td>Limit direkt in die Zone</td></tr>
        <tr><td>Ein Kriterium fehlt</td><td>Bestätigung abwarten (CE / SE)</td></tr>
        <tr><td>Kein Level, kein Abgriff, keine Bestätigung</td><td>kein Trade</td></tr>
      </table>
      <p>Der dritte Fall ist der wichtigste. „Kein Trade“ ist ein Ergebnis, kein verpasster Trade.</p>

      <h3>Valide Zone → Entry suchen auf</h3>
      <table class="strat-table">
        <tr><th>Valide Zone</th><th>Entry suchen auf</th></tr>
        <tr><td>H4</td><td>M15</td></tr>
        <tr><td>M15</td><td>M5 / M1</td></tr>
        <tr><td>M5</td><td>M1</td></tr>
      </table>

      <p><b>Passiv bleibt passiv:</b> Auf interner Basis liegt der Fokus darauf, die passivste Zone mitzunehmen, weil der Markt sie sehr häufig einfach nur antestet. Die Early Zone davor ist meistens nur die Liquidität dafür.</p>
      <p style="margin-bottom:0;"><b>Wo genau liegt der Entry in der Zone?</b> An der Zonenkante. Oder, wenn der Markt schon etwas weitergelaufen ist, am 71er-Level des Fibs — angelegt an dem Schenkel, der zum ChoCh geführt hat. Bei einer Doji-Kerze liegt der Einstieg über bzw. unter dem Doji, weil Dojis so gut wie immer gesweept werden.</p>
    </div>

    <div class="strat-panel" id="strat-sltp">
      <h2>SL, TP und Risiko</h2>

      <h3>Stop-Loss</h3>
      <p>Der Stop-Loss gehört über bzw. unter die Zone – so, dass der Docht mitgenommen wird. Immer das Low bzw. High mitnehmen. Ein Stop mitten in der Zone ist kein Stop, sondern eine Einladung.</p>
      <table class="strat-table">
        <tr><th>Entry-Art</th><th>Stop-Loss liegt</th></tr>
        <tr><td>Limit Entry</td><td>über / unter die komplette Zone</td></tr>
        <tr><td>Sweep Entry</td><td>über / unter den Docht des Abgriffs</td></tr>
        <tr><td>Confirmation Entry</td><td>über / unter den entstandenen Orderblock auf der kleinen Zeiteinheit</td></tr>
      </table>

      <h3>Take-Profit</h3>
      <p>Das Ziel ist immer Liquidität – nie eine Zahl. Konkret: das nächste Struktur-Hoch/-Tief, eine offene Imbalance oder die nächste Zone. Zielbereich 3R bis 5R – 3R müssen passen, sonst wird der Trade nicht genommen. Trades auf 10R oder 13R laufen zu lassen ist kein Bestandteil dieser Strategie – lieber jeden Tag saubere Gewinne mitnehmen und rational in den nächsten Trade gehen.</p>

      <h3>Break-Even</h3>
      <p>Nach dem Bruch in die richtige Richtung kann der SL nachgezogen werden. Aber Vorsicht: Sehr oft holt der Markt genau diesen BE ab und läuft danach in den TP. Wer zu früh auf BE zieht, nimmt sich die Trades selbst weg – die eigenen Zahlen sollten zeigen, ob BE überhaupt hilft.</p>

      <h3>Wie viel Risiko pro Trade?</h3>
      <table class="strat-table">
        <tr><th>Risiko</th><th>Wann</th></tr>
        <tr><td>1 % — volles Risiko</td><td>Alle Kriterien erfüllt, sauberer Liquiditätsabgriff, mit dem Order Flow, Zone an einem Level</td></tr>
        <tr><td>0,5 % — kleines Risiko</td><td>Counter Trade, Zone kommt vom 32er, Zone „nicht so nice“, weitere Zone darüber noch offen, CE ohne Abgriff</td></tr>
        <tr><td>0 % — kein Trade</td><td>CRV passt nicht, kein Level, ein Kriterium fehlt, keine Bestätigung</td></tr>
      </table>
      <p>Ein Verlust ist damit immer nur -1R, also -1 % oder -0,5 %. Ein Gewinner bringt 3 bis 5 %. Genau deshalb lässt sich ein SL akzeptieren, ohne beim nächsten Trade emotional zu werden. Mehrere SLs hintereinander sind normal – wichtig ist, den SL zu akzeptieren, nicht das System zu wechseln.</p>

      <h3>Handelszeit</h3>
      <p style="margin-bottom:0;">Handel bewusst erst ab 8–9 Uhr. In der Asia-Session lieber auf einen Abgriff warten, statt einzusteigen. Und: 5 Minuten vor PPI, CPI, FOMC und NFP wird nichts Neues eröffnet.</p>
    </div>

    <div class="strat-panel" id="strat-invalidierung">
      <h2>Invalidierung & Checkliste</h2>

      <h3>Wann ein Setup ungültig wird</h3>
      <ul>
        <li>Der Preis kommt aus einer relevanten Zone – dann ist unsere Zone nur noch Liquidität</li>
        <li>Der TP ist erreicht – das Setup ist abgearbeitet</li>
        <li>Die Ziel-Liquidität wurde bereits gezogen – es gibt nichts mehr zu holen</li>
        <li>Die Zone ist mitigiert und hat ihre Aufgabe erfüllt</li>
        <li>Body Close jenseits der Zone – die Zone ist gebrochen, nicht „fast gehalten“</li>
        <li>Fake BOS / Fake ChoCh erkannt – die Liquidität wird genutzt, nicht gestellt</li>
      </ul>
      <p><b>Die häufigsten Fehler:</b> Limit ohne Liquiditätsabgriff. Entry ohne Level. Struktur in jeder Kerze neu sehen. Blindes Reinstaffeln nach einem SL. Setup-Hopping, weil das eigene Modell gerade zwei Verlierer hatte.</p>

      <h3>Die 50-%-Regel</h3>
      <p>Eine Struktur bleibt so lange gültig, bis der Markt die Hälfte des letzten Schenkels zurückgeholt hat. Erst ab diesem Punkt wird sie nachgezogen – vorher nicht. Solange weniger als 50 % zurückgelaufen sind, ist das nur eine Korrektur innerhalb der laufenden Bewegung. In ungefähr jedem zehnten Fall holt der Markt trotzdem noch die passivste Zone ab, obwohl die neue Struktur längst steht – das ist eingepreist. Wer sauber identifiziert und erst nach 50 % nachzieht, fährt über viele Trades hinweg deutlich besser als jemand, der jede Kerze neu bewertet.</p>

      <h3>Checkliste vor jedem Entry</h3>
      <ul class="strat-checklist">
        <li>Externe Struktur auf M15 bestimmt</li>
        <li>Interner Schenkel und Fibo (32 / 50 / 71) eingezeichnet</li>
        <li>Zone ist nicht mitigiert</li>
        <li>Zone hat zu einem BOS / ChoCh geführt</li>
        <li>Offene Imbalance vor der Zone</li>
        <li>Early Zone / Inducement davor vorhanden</li>
        <li>Liquiditätsabgriff vor der Zone erfolgt</li>
        <li>Zone liegt an einem Level</li>
        <li>Liquidität als Ziel vorhanden</li>
        <li>CRV mindestens 3R</li>
        <li>Handelszeit passt, keine News in den nächsten Minuten</li>
        <li>Bei Counter: erster ChoCh wurde abgegriffen</li>
        <li>Risiko festgelegt: 1 % oder 0,5 %</li>
      </ul>

      <h3>Situation → Entrymodell</h3>
      <table class="strat-table">
        <tr><th>Situation</th><th>Entrymodell</th></tr>
        <tr><td>6/6, Abgriff vorhanden</td><td>Limit Entry</td></tr>
        <tr><td>Kriterium fehlt</td><td>Confirmation Entry</td></tr>
        <tr><td>Level wird abgegriffen</td><td>Sweep Entry</td></tr>
        <tr><td>Zone wird mit Momentum gebrochen</td><td>Flip Entry</td></tr>
        <tr><td>Trade läuft, neue Zone entsteht</td><td>Continuation Entry</td></tr>
        <tr><td>Gegen den Order Flow</td><td>Counter mit halbem Risiko</td></tr>
        <tr><td>Nichts davon trifft zu</td><td>kein Trade</td></tr>
      </table>

      <div class="strat-quote" style="margin-bottom:0;">„Sobald irgendein Kriterium fehlt: einfach Finger davon lassen und mit einem CE bestätigen lassen.“</div>
    </div>
  `;
}

function wireStrategie(){
  document.querySelectorAll("[data-stratentry]").forEach(el=>{
    el.addEventListener("click", ()=>{
      const key = el.dataset.stratentry;
      if(STRATEGY_ENTRY_DETAILS[key]){ openStrategyEntryModal(key); return; }
      // Für Entry-Arten ohne eigenes Detail-Modal (noch) zum bestehenden Übersichtsbereich springen.
      const target = document.getElementById(el.dataset.stratjump);
      if(target) target.scrollIntoView({ behavior:"smooth", block:"start" });
    });
  });
  document.querySelectorAll("[data-stratjump]:not([data-stratentry])").forEach(el=>{
    el.addEventListener("click", ()=>{
      const target = document.getElementById(el.dataset.stratjump);
      if(target) target.scrollIntoView({ behavior:"smooth", block:"start" });
    });
  });
}

// Rendert einen einzelnen Content-Block des Detail-Modals (siehe Schema-Kommentar
// bei STRATEGY_ENTRY_DETAILS). h-Werte enthalten bewusst erlaubtes Inline-HTML (<b>)
// aus fest hinterlegten Strings — keine Nutzereingabe, daher kein escHtml auf h/items.
function renderStrategyBlock(b){
  switch(b.t){
    case "p": return `<p>${b.h}</p>`;
    case "h3": return `<h3>${b.h}</h3>`;
    case "ul": return `<ul>${b.items.map(x=>`<li>${x}</li>`).join("")}</ul>`;
    case "ol": return `<ol>${b.items.map(x=>`<li>${x}</li>`).join("")}</ol>`;
    case "table": return `<table class="strat-table">
      <tr>${b.head.map(x=>`<th>${x}</th>`).join("")}</tr>
      ${b.rows.map(r=>`<tr>${r.map(x=>`<td>${x}</td>`).join("")}</tr>`).join("")}
    </table>`;
    default: return "";
  }
}

function openStrategyEntryModal(key){
  const d = STRATEGY_ENTRY_DETAILS[key];
  if(!d) return;
  const root = document.getElementById("modalRoot");
  root.innerHTML = `
  <div class="modal-backdrop" id="stratEntryBackdrop">
    <div class="modal strat-modal">
      <div class="modal-header-row">
        <div><h2>${escHtml(d.title)}</h2></div>
        <button type="button" class="icon-btn" id="stratEntryCloseBtn" title="Schließen" aria-label="Schließen">✕</button>
      </div>

      <div class="strat-modal-img-row" style="grid-template-columns:repeat(${d.images.length},1fr);">
        ${d.images.map(src=>`<img class="strat-modal-img" src="${src}" alt="${escAttr(d.title)}" decoding="async">`).join("")}
      </div>

      <div class="strat-modal-content">
        ${d.blocks.map(renderStrategyBlock).join("")}
      </div>

      <div class="modal-footer" style="justify-content:flex-end;">
        <button class="btn btn-primary" id="stratEntryCloseBtn2">Schließen</button>
      </div>
    </div>
  </div>`;

  const backdrop = document.getElementById("stratEntryBackdrop");
  backdrop.addEventListener("click", (e)=>{ if(e.target===backdrop) closeStrategyEntryModal(); });
  document.getElementById("stratEntryCloseBtn").addEventListener("click", closeStrategyEntryModal);
  document.getElementById("stratEntryCloseBtn2").addEventListener("click", closeStrategyEntryModal);
}

function closeStrategyEntryModal(){
  document.getElementById("modalRoot").innerHTML = "";
}

function wireInsightListClicks(){
  const emptyAdd = document.querySelector("[data-emptyaddinsight]");
  if(emptyAdd) emptyAdd.addEventListener("click", ()=> openInsightModal(null));
  document.querySelectorAll("[data-insightedit]").forEach(el=>{
    el.addEventListener("click", ()=>{
      const ins = STATE.insights.find(x=>x.id===el.dataset.insightedit);
      if(ins) openInsightModal(ins);
    });
  });
  document.querySelectorAll("[data-insightdel]").forEach(btn=>{
    btn.addEventListener("click", async (e)=>{
      e.stopPropagation();
      if(!await uiConfirm("Direkt danach kannst du das Löschen noch einige Sekunden rückgängig machen.", { title:"Diese Erkenntnis löschen?", okText:"Löschen", danger:true })) return;
      const idx = STATE.insights.findIndex(x=>x.id===btn.dataset.insightdel);
      if(idx < 0) return;
      const deleted = STATE.insights[idx];
      STATE.insights.splice(idx, 1);
      saveInsights();
      render();
      toast("Erkenntnis gelöscht.", "Rückgängig", ()=>{
        if(STATE.insights.some(x=>x.id===deleted.id)) return;
        STATE.insights.splice(Math.min(idx, STATE.insights.length), 0, deleted);
        saveInsights();
        render();
        toast("Erkenntnis wiederhergestellt.");
      }, 7000);
    });
  });
  document.querySelectorAll("[data-insightshotref]").forEach(el=>{
    el.addEventListener("click",(e)=>{
      e.stopPropagation(); // verhindert, dass der Klick zusätzlich die Erkenntnis zum Bearbeiten öffnet
      const [insId, idx] = el.dataset.insightshotref.split(":");
      const ins = STATE.insights.find(x=>x.id===insId);
      if(ins) openLightbox(ins.screenshots[parseInt(idx,10)]);
    });
  });
}

/* ---------- Erkenntnis-Modal (Hinzufügen/Bearbeiten) ---------- */
function openInsightModal(existing){
  STATE.insightEditingId = existing ? existing.id : null;
  STATE.insightDraft = existing ? JSON.parse(JSON.stringify(existing)) : emptyInsight();
  STATE.insightDraftSnapshot = JSON.stringify(STATE.insightDraft);
  renderInsightModal();
}

async function requestCloseInsightModal(){
  if(STATE.insightDraft && JSON.stringify(STATE.insightDraft) !== STATE.insightDraftSnapshot){
    const ok = await uiConfirm("Deine Eingaben in diesem Formular wurden noch nicht gespeichert.", { title:"Änderungen verwerfen?", okText:"Verwerfen", cancelText:"Weiter bearbeiten", danger:true });
    if(!ok) return;
  }
  closeInsightModal();
}

function closeInsightModal(){
  document.removeEventListener("paste", handleInsightPasteEvent);
  document.getElementById("modalRoot").innerHTML = "";
  STATE.insightDraft = null;
  STATE.insightEditingId = null;
}

function renderInsightModal(){
  const d = STATE.insightDraft;
  const isEdit = !!STATE.insightEditingId;
  const root = document.getElementById("modalRoot");
  root.innerHTML = `
  <div class="modal-backdrop" id="insightBackdrop">
    <div class="modal">
      <div class="modal-header-row">
        <div>
          <h2>${isEdit?"Erkenntnis bearbeiten":"Erkenntnis hinzufügen"}</h2>
          <div class="modal-sub">Learning aus dem Markt festhalten</div>
        </div>
        <button class="icon-btn" id="insightCloseBtn" title="Schließen" aria-label="Schließen">✕</button>
      </div>

      <div class="field-group">
        <label class="fg-label">Überschrift (optional)</label>
        <input type="text" id="i_titel" placeholder="Kurzer Titel, z. B. „Zu früh eingestiegen bei News“" value="${escAttr(d.titel||"")}">
      </div>

      <div class="field-group">
        <label class="fg-label">Datum</label>
        <input type="date" id="i_date" value="${d.date||""}">
      </div>

      <div class="field-group">
        <label class="fg-label">Erkenntnis</label>
        <textarea id="i_text" placeholder="Was hast du über den Markt oder dein System gelernt?" style="min-height:110px;">${escHtml(d.text||"")}</textarea>
      </div>

      <div class="field-group">
        <label class="fg-label">Screenshots ${(d.screenshots&&d.screenshots.length)?`(${d.screenshots.length})`:""}</label>
        <div class="shot-dropzone" id="insightDropzone" tabindex="0" role="group" aria-label="Screenshot per Strg+V einfügen, hineinziehen oder Datei auswählen">
          <div class="shot-dropzone-hint">
            <div style="font-size:22px; margin-bottom:6px;">⎘</div>
            <div><strong>Screenshot(s) einfügen</strong> — hier klicken und <kbd>Strg</kbd>+<kbd>V</kbd> (Mac: <kbd>⌘</kbd>+<kbd>V</kbd>)</div>
            <div style="margin-top:4px;">oder Bilder hierher ziehen, oder <label class="shot-filelabel" for="i_shot">Dateien auswählen</label></div>
          </div>
        </div>
        <input type="file" id="i_shot" accept="image/*" multiple style="display:none;">
        <div class="shot-url-row">
          <input type="url" class="shot-url-input" id="i_shoturl" aria-label="Bild-URL" placeholder="…oder Bild-URL einfügen (z. B. TradingView-Snapshot-Link) und Enter drücken">
          <button type="button" class="btn btn-sm" id="insightAddShotUrlBtn">Hinzufügen</button>
        </div>
        <div class="shot-url-hint">Spart Speicher: ein Link braucht rund 80 Byte statt ~150 KB. TradingView-Links (…/x/ID/) werden automatisch in die direkte Bildadresse umgewandelt.</div>
        ${(d.screenshots&&d.screenshots.length) ? `
        <div class="shot-gallery">
          ${d.screenshots.map((src,i)=>`
            <div class="shot-thumb">
              <img src="${escAttr(src)}" data-editinsightshotref="${i}" title="Zum Vergrößern klicken" alt="Screenshot ${i+1} vergrößern" role="button" tabindex="0">
              <button type="button" class="shot-remove" data-insightremoveshot="${i}" title="Entfernen">✕</button>
            </div>
          `).join("")}
        </div>` : ""}
      </div>

      <div class="modal-footer is-sticky">
        <button class="btn btn-ghost" id="insightCancelBtn">Abbrechen</button>
        <button class="btn btn-primary" id="insightSaveBtn">${isEdit?"Speichern":"Erkenntnis speichern"}</button>
      </div>
    </div>
  </div>`;
  wireInsightModal();
}

function wireInsightModal(){
  const backdrop = document.getElementById("insightBackdrop");
  backdrop.addEventListener("click",(e)=>{ if(e.target===backdrop) requestCloseInsightModal(); });
  document.getElementById("insightCloseBtn").addEventListener("click", requestCloseInsightModal);
  document.getElementById("insightCancelBtn").addEventListener("click", requestCloseInsightModal);

  document.getElementById("i_titel").addEventListener("input",(e)=>{ STATE.insightDraft.titel = e.target.value; });
  document.getElementById("i_date").addEventListener("input",(e)=>{ STATE.insightDraft.date = e.target.value; });
  document.getElementById("i_text").addEventListener("input",(e)=>{ STATE.insightDraft.text = e.target.value; });

  const shotInput = document.getElementById("i_shot");
  shotInput.addEventListener("change",(e)=>{
    const files = Array.from(e.target.files || []);
    if(files.length) handleInsightImageFiles(files);
    shotInput.value = "";
  });

  const dropzone = document.getElementById("insightDropzone");
  if(dropzone){
    dropzone.addEventListener("click",(e)=>{
      if(e.target.closest(".shot-filelabel")) return;
      dropzone.focus({preventScroll:true});
    });
    dropzone.addEventListener("dragover",(e)=>{ e.preventDefault(); dropzone.classList.add("dragover"); });
    dropzone.addEventListener("dragleave",()=> dropzone.classList.remove("dragover"));
    dropzone.addEventListener("drop",(e)=>{
      e.preventDefault();
      dropzone.classList.remove("dragover");
      const files = Array.from(e.dataTransfer.files || []).filter(f=>f.type.startsWith("image/"));
      if(files.length) handleInsightImageFiles(files);
    });
  }
  const iUrlInput = document.getElementById("i_shoturl");
  const iUrlBtn = document.getElementById("insightAddShotUrlBtn");
  const addInsightUrl = ()=>{
    if(!iUrlInput) return;
    const url = (iUrlInput.value||"").trim();
    if(!url) return;
    iUrlInput.value = "";
    addInsightShotFromUrl(url);
  };
  if(iUrlBtn) iUrlBtn.addEventListener("click", addInsightUrl);
  if(iUrlInput) iUrlInput.addEventListener("keydown",(e)=>{
    if(e.key === "Enter"){ e.preventDefault(); addInsightUrl(); }
  });

  document.addEventListener("paste", handleInsightPasteEvent);

  document.querySelectorAll("[data-insightremoveshot]").forEach(btn=>{
    btn.addEventListener("click",(e)=>{
      e.stopPropagation();
      const i = parseInt(btn.dataset.insightremoveshot, 10);
      STATE.insightDraft.screenshots.splice(i,1);
      renderInsightModal();
    });
  });

  // Klick auf ein Vorschaubild vergrößert es (gleiche Lightbox wie bei Trades),
  // unabhängig vom "Entfernen"-Button daneben.
  document.querySelectorAll("[data-editinsightshotref]").forEach(img=>{
    img.addEventListener("click", ()=>{
      const i = parseInt(img.dataset.editinsightshotref, 10);
      openLightbox(STATE.insightDraft.screenshots[i]);
    });
  });

  document.getElementById("insightSaveBtn").addEventListener("click", saveInsightDraft);
}

function handleInsightPasteEvent(e){
  if(!STATE.insightDraft) return;
  const items = (e.clipboardData && e.clipboardData.items) || [];
  const files = [];
  for(const item of items){
    if(item.type && item.type.startsWith("image/")){
      const file = item.getAsFile();
      if(file) files.push(file);
    }
  }
  if(files.length){ e.preventDefault(); handleInsightImageFiles(files); }
}

async function handleInsightImageFiles(files){
  if(!(await confirmImageUpload())) return;
  if(!STATE.insightDraft.screenshots) STATE.insightDraft.screenshots = [];
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
        STATE.insightDraft.screenshots.push(canvas.toDataURL("image/jpeg", 0.72));
        remaining--;
        if(remaining===0) renderInsightModal();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function saveInsightDraft(){
  const d = STATE.insightDraft;
  d.titel = document.getElementById("i_titel").value || "";
  d.date = document.getElementById("i_date").value || d.date;
  d.text = document.getElementById("i_text").value;
  if(!d.titel.trim() && !d.text.trim() && !(d.screenshots && d.screenshots.length)){
    const ta = document.getElementById("i_text");
    if(ta){ ta.focus(); ta.classList.add("has-error"); }
    toast("Bitte zuerst eine Erkenntnis, einen Titel oder einen Screenshot eintragen.");
    return;
  }
  d.updatedAt = Date.now();
  const idx = STATE.insights.findIndex(x=>x.id===d.id);
  if(idx>-1) STATE.insights[idx] = d; else STATE.insights.push(d);
  saveInsights();
  closeInsightModal();
  render();
  toast("Erkenntnis gespeichert.");
}

