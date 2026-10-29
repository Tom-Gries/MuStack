# Abnahmeliste – StackFriends V1

> Übernommener fachlicher Abnahmestand aus dem früheren gemeinsamen Entwicklungsprojekt. Die damaligen Testzahlen und Befehle dokumentieren historische Prüfungen. Aktuelle Start-, Test- und Git-Befehle für die getrennten Repositories stehen in der [Projektanleitung](../README.md). Der gemeinsame Anwendungstest liegt jetzt unter `tests/integration/split-apps.test.js` und wird mit `npm run test:integration` ausgeführt.

Aktuelle Repository-Aufteilung seit dem 29.10.2026: [MuStack](https://github.com/Tom-Gries/MuStack) enthält das Spiel, [MuStackAPI](https://github.com/Tom-Gries/MuStackAPI) die API und [MuStackShared](https://github.com/Tom-Gries/MuStackShared) die gemeinsamen Spielregeln. Beide Apps installieren `@stackfriends/shared` aus dem öffentlichen Shared-Repository mit derselben festen, vollständigen Commit-SHA. Der aktuelle Ablauf für Regeländerungen ist in der [Projektanleitung](../README.md#gemeinsame-spielregeln) beschrieben.

Stand: 28.10.2026. Status: **in Umsetzung – spielbarer Stand zur Prüfung**.

Diese Datei ist unsere gemeinsame Arbeitsliste für die erste spielbare Version. Eine Checkbox wird erst abgehakt, wenn die Funktion umgesetzt und durch die unten genannte Evidenz geprüft wurde. Abgehakte Regelpunkte bezeichnen automatisierte Prüfungen des Spielzustands. Sie ersetzen keine abschließende Browser-, Touch- oder Cloudabnahme. Ein offener Punkt kann bereits umgesetzt sein; seine vollständige Abnahme steht dann noch aus.

Die Spielregeln aus unserem Gespräch stehen in den Abnahmepunkten. Die ursprünglichen Vorschläge wurden für diesen Stand als zentral anpassbare Umsetzungswerte gewählt. Präzisiert sind gemeinsame Teilzahlungen mit einzelnen Goldkarten, eine Karte je Paketklick, das Mitnehmen aller Karten oberhalb der gegriffenen Karte und die Warteschlange mehrerer Quellen.

## Aktueller Prüfstand und Evidenz

- `npm test`: am 28.10.2026 bestanden **189 Tests**, einschließlich Baum/Export, Gruppenkampf/Beute, Rattenteams, Messer/Kochen, Inhaltsupgrades, Essenstapeln und der getrennten Apps. Die Auswahl „gegriffene Karte plus alle darüber“, Quellen-Warteschlangen, Paketklicks, atomare Änderungen, Wiederholschutz und Neustartpersistenz bleiben abgedeckt. Für die Ordnertrennung prüfen `tests/frontend-proxy.test.js`, `tests/socket-tickets.test.js` und `tests/split-apps.test.js` Proxy, Sitzung, WebSocket-Tickets und die Synchronisierung zwischen zwei Anwendungen. Maßgeblich bleibt die aktuelle Testausgabe.
- `node backend/server/verify-atlas.js`: echte Atlas-Verbindung, konkurrierende Erstinitialisierung, atomare Versionsprüfung und Wiederholschutz wurden vor der Ordnertrennung erfolgreich mit einem temporären Testdokument geprüft. Die gemeinsame Spielwelt wurde dabei nicht verändert. Dieser historische Nachweis ersetzt keine erneute Prüfung des aktuellen Cloudzugangs.
- `node backend/server/benchmark.js`: vier WebSocket-Testclients mit isoliertem lokalem Dateistand; in Ruhe keine Zustandszugriffe, bei 50 Ziehvorschauen genau eine Speicherung der Endposition, bei einem Abbaudurchlauf eine Speicherung des Ergebnisses. Diese historischen Werte gelten für den damaligen lokalen Dateiadapter. Die aktuellen Befehle für die getrennten Repositories stehen in der [Projektanleitung](../README.md).
- `node backend/server/verify-connection.js`: zwei Verbindungen desselben Spielers blieben vor der Ordnertrennung 75 Sekunden ohne unerwarteten Verbindungsabbruch online. In dieser Ruhephase gab es 0 Zustandslesezugriffe und 0 Zustandsschreibzugriffe; native Pongs, 5-Sekunden-Anwendungslebenszeichen und 15 Anwesenheitsprüfungen wurden beobachtet. Nach bewusstem Schließen eines Tabs blieb der andere weitere 5,5 Sekunden online. Der Test verwendet einen isolierten lokalen Dateistand ohne Watcher, Vite und Redis; die Atlas-Welt bleibt unverändert.
- Entwicklungsneustarts: `npm run dev` verwendet `node --watch`. Änderungen an importierten Backend-/Spielmodulen starten den Prozess neu und trennen bestehende Verbindungen regulär. Für eine ruhige Sitzung während Backend-Arbeiten kann nach Beenden des bisherigen Starters `npm start` zusammen mit einem separaten `npm run dev:client` verwendet werden. Damit werden Backend-Änderungen erst beim manuellen Neustart geladen.
- Browserprüfung mit separater lokaler Testwelt: Mittlere Karte nahm genau die drei oberen Goldkarten mit, die drei unteren blieben liegen. Ein Paket gab pro Klick eine Karte frei; nach Verschieben und Neuladen blieben zwei Karten enthalten, nach dem dritten Klick verschwand es. Ein Mensch arbeitete Baum und Fels nacheinander ab; aktive Quelle, Fortschritt und Quellenanzahl waren sichtbar. Ein gezielt ausgelöster Kampf zeigte roten Rahmen, Gegner, Lebenspunkte und Schlaganzeige; danach war die Ratte entfernt, eine Goldbeute vorhanden und der Mensch bei 73 von 75 Leben. Die gemeinsame Atlas-Welt wurde für diese Abläufe nicht verändert.
- Browserprüfung der Einstellungen in separater lokaler Testwelt: Eine Kristallkarte wurde mit Name, Beschreibung, Symbol, Farbe und Verkaufswert angelegt. Eine Kombination aus einem Holz zu einem Kristall ohne Mensch in drei Sekunden und ein Kristallpaket mit einem Gold Preis, zwei Karten und ausschließlich Kristallen wurden gespeichert. Nach dem Rückweg zum Spiel erschienen das eigene Paket im Shop und die neue Kombination in der Rezeptanzeige. Die weiteren Prüfungen von Kauf, Öffnen, Löschen und Bildauswahl werden in Abschnitt 14 dokumentiert.
- Die Kristall-Testinhalte wurden anschließend auf Wunsch aus dem verwendeten lokalen Spielstand entfernt. Sie gehören nicht zum Standardkatalog. Der neue Spielbaum wurde im Browser über Basicpaket → Baum → Holz → Axt-Kombination bis zur direkten Bearbeitung geprüft. Der tatsächliche JSON-Download enthielt den damaligen Katalog mit 28 Karten, sieben Kombinationen und zwei Paketen. In einer isolierten Testwelt wurden 100 % Kuh-Beute mit zwei Fleisch gespeichert und nach Neuladen bestätigt. Die Teamdarstellung mit zwei Menschen und drei Ratten wurde mit kontrollierter Testuhr visuell geprüft.
- Noch offen: vollständiger gemeinsamer PC-Durchlauf, Handy-Querformat, Live-Deployment auf Vercel mit Redis, Ausfall-/Wiederverbindungsszenarien und Verbrauchsmessung der Cloudumgebung. Diese Punkte werden nicht als bestanden ausgewiesen.

## Ziel der ersten Version

Eine öffentliche, gemeinsame Spielwelt im Browser: Spieler erhalten eine Menschenkarte mit ihrem Namen, kaufen und öffnen Kartenpakete, verschieben und stapeln Karten, bauen Rohstoffe ab, stellen erste Gegenstände her und bekämpfen Ratten. Jeder darf auch die Menschenkarten anderer Spieler bewegen. Ratten bewegen sich selbst und sind nicht per Drag-and-drop verschiebbar.

Technische Vorgaben: Vite im Ordner `frontend/`, Node.js-API im Ordner `backend/`, getrennt auf Vercel veröffentlichbar, Speicherung in MongoDB Atlas. Das npm-Paket `@stackfriends/shared` aus dem eigenen Repository `shared/` enthält die gemeinsamen Spielregeln und Kartendefinitionen für beide Apps. PC ist Pflicht; Handy im Querformat ist ein ergänzendes Ziel.

## Für später vorgemerkt

Ein Totem zur Wiederbelebung und ein Kartenlimit mit Lagerfunktion folgen in einer späteren Version. Das Lager ist in V1 bereits herstellbar. Handy im Querformat bleibt ein Zusatzwunsch zur Pflichtabnahme am PC.

## Gewählte Details und erste Spielwerte

Die folgende Tabelle dokumentiert die verwendeten Werte. Sie stehen zentral in `shared/catalog.js`; spätere Spieltests können Änderungen begründen. Bereits bestätigte Vorgaben wie die Bauzeit des Sparschweins und die Stunde Feldwachstum bleiben erhalten.

| Thema | Umsetzung für diesen Stand |
| --- | --- |
| Paketinhalt | Ein Basicpaket enthält drei zufällige Karten. Duplikate sind möglich. |
| Paketpreis / Startgold | Basicpaket: 3 Gold. Die Welt erhält bei ihrer einmaligen Erstausstattung 9 sichtbare Goldkarten für drei Pakete. |
| Zufall pro gezogener Karte | Baum 33 %, Fels 33 %, Beerenbusch 32 %, Ratte 1 %, fruchtbarer Boden 1 %. Drei unabhängige Ziehungen je Paket. |
| Goldkarten | Eine Karte entspricht zunächst einem Gold. Ein Stapel kann mehrere Goldkarten enthalten. |
| Sparschwein-Details | Jeder Klick entnimmt genau eine Goldkarte, solange Gold enthalten ist. Füllstand sichtbar; Kapazität zunächst unbegrenzt. Reines Ziehen des Sparschweins löst keine Auszahlung aus. |
| Paket kaufen | Einzelne Goldkarten oder einen Goldstapel zum Shop ziehen. Gemeinsame Teilzahlungen senken den offenen Betrag von 3 auf 2 auf 1; bei vollständiger Zahlung entsteht genau ein Paket und der Preis beginnt wieder bei 3. Größere Stapel bezahlen nur den Restbetrag; überschüssige Goldkarten bleiben erhalten. Alternativ ein ausreichend gefülltes Sparschwein auf das gewünschte Shop-Paket ziehen: Es bezahlt genau den offenen Preis; ein Paket entsteht und restliches Guthaben bleibt im Schwein. Bei zu wenig Guthaben bleibt der Kauf ohne Abbuchung aus. Teilzahlungen werden mit der Welt gespeichert. |
| Paket öffnen | Ein Klick auf das gekaufte Paket zieht genau eine Karte. Die Restanzahl bleibt am Paket sichtbar und gespeichert. Nach dem dritten Klick verschwindet das leere Paket. Verschieben zieht keine Karte. Die optionale Öffnungsfläche öffnet nur den noch verbleibenden Inhalt. |
| Stapel bewegen / trennen | Jede gegriffene Karte nimmt alle Karten logisch darüber mit; darunterliegende Karten bleiben liegen. Am sichtbaren Kartennamen wird die Trennstelle gewählt. Die unterste Karte nimmt den ganzen Stapel mit, die oberste bewegt sich allein. Werkzeuge folgen ihren mitgenommenen Menschen; direkt gegriffene Werkzeuge werden allein abgelegt. Auch deutliche Kartenüberlappung gilt als Stapelziel, wenn der Mauszeiger knapp neben der Zielkarte liegt. |
| Gegner in einem Stapel | Auch auf Gegner dürfen Karten gelegt werden. Eine Ratte bleibt dabei von manuellem Verschieben ausgenommen; ein Mensch auf einer Ratte löst unmittelbar den Kampf aus. |
| Arbeitsstapel verschieben | Ein vollständiger Arbeitsstapel darf ohne Fortschrittsverlust bewegt werden. Entfernt man Mensch oder benötigte Zutaten, wird die aktuelle Aktion abgebrochen. |
| Grundtempo Abbau | Ein Durchlauf dauert 10 Sekunden. Jede Quelle erlaubt fünf Durchläufe und erzeugt je Durchlauf eine Karte. |
| Mehrere Quellen | Mensch und beliebig viele Bäume, Felsen oder Beerenbüsche bilden eine Warteschlange. Eine Quelle wird vollständig abgearbeitet, anschließend die nächste nach Stapelreihenfolge. Hinzufügen weiterer Quellen lässt die gerade laufende Quelle samt Fortschritt unverändert. Eine wartende Quelle darf entfernt werden, ohne den aktuellen Durchgang abzubrechen. Fremde Materialien verhindern den Arbeitsbeginn. |
| Baum | Pro Durchlauf 70 % Holz oder 30 % Stock. Nach fünf Durchläufen verschwindet der Baum. |
| Fels | Pro Durchlauf 80 % Stein oder 20 % Feuerstein. Nach fünf Durchläufen verschwindet der Fels. |
| Beerenbusch | Pro Durchlauf eine Beere. Nach fünf Durchläufen verschwindet der Busch. |
| Rezepte erkennen | Bei Bau- und Werkzeugrezepten starten Mensch und exakt passende Zutaten ein Rezept unabhängig von ihrer Stapelreihenfolge. Andere Zutaten verhindern den Start; ein ausgerüstetes Werkzeug zählt nicht als Zutat. Der Anbau aus Boden + Beere ist ein eigener Vorgang ohne Mensch. |
| Arbeitskraft | Ein Mensch bearbeitet jeweils eine Aktion. Zusätzliche Menschen beschleunigen dieselbe Aktion zunächst nicht. |
| Bauzeiten | Sparschwein fest 60 Sekunden; Lager zunächst 30 Sekunden, Axt und Spitzhacke jeweils 20 Sekunden. |
| Werkzeuge anziehen | Axt oder Spitzhacke auf einen freien Menschen ziehen. Das Werkzeug bleibt als angeheftete Karte sichtbar und kann wieder herausgezogen werden. |
| Werkzeugplätze | Ein Werkzeug je Mensch. Für einen Wechsel wird das bisherige Werkzeug zuerst abgelegt. Kein Verschleiß in V1. |
| Werkzeugwirkung | Axt halbiert die Zeit am Baum; Spitzhacke halbiert die Zeit am Fels. |
| Ratten | Menschen und Ratten greifen alle 2 Sekunden gleichzeitig an. Auch der zweite Rattenangriff zählt. Ratten sterben nach zwei Treffern; jeder Angriff verursacht 1 Schaden. Sie verfolgen den nächsten lebenden Menschen und kämpfen zunächst gegen einen Menschen. Ein am Namen herausgezogener Mensch kann den Kampfbereich verlassen. |
| Rattenbeute | Je besiegter Ratte ein Wurf: 40 % eine Goldkarte, 30 % ein Knochen, 20 % ein Fleisch, 10 % keine Beute. |
| Verkaufspreise und Ausnahmen | Baum, Fels, Beerenbusch, Holz, Stock, Stein, Feuerstein, Beere, Knochen und Fleisch: je 1 Gold. Paket und Boden: je 2. Feld, Sparschwein, Axt und Spitzhacke: je 3. Lager: 5. Menschen, Leichen, Gegner und Gold sind unverkäuflich. Ein gefülltes Sparschwein muss zuerst entleert werden. |
| Heilungsdetails | Beere auf einen lebenden Menschen ziehen: eine Beere heilt genau 1 Leben, höchstens bis 75. Ein Stapel heilender Nahrung wird in Stapelreihenfolge gegessen, bis 75 Leben erreicht sind oder das Essen aufgebraucht ist. Unterschiedliche Heilungsstärken verwenden die Katalogeffekte. Überschüssiges Essen bleibt am bisherigen Stapel und Ort erhalten. Bei vollen Lebenspunkten oder einer Leiche wird nichts verbraucht. Stapel mit nicht heilenden Karten behalten das normale Stapelverhalten. |
| Erdbeerfeld-Intervall | Boden und eine Beere werden nach einer Stunde Echtzeit in genau ein Feld umgewandelt. Die erste Ernte ist als Konkretisierung 24 Stunden nach Feldentstehung bereit; nach jeder Ernte beginnt ein neuer 24-Stunden-Zeitraum. Während das Feld erntereif ist, wächst keine zusätzliche Ernte nach. Das Feld bleibt nach dem Ernten bestehen. |
| Erdbeerfeld ernten | Den angezeigten erntereifen 10er-Beerenstapel per Drag-and-drop vom Feld auf die Spielfläche ziehen. Erst die bestätigte Entnahme startet den nächsten Erntezeitraum. |
| Abwesende Spieler | Ihre Menschenkarten bleiben in der Welt nutzbar. Solange andere Spieler anwesend sind, kann die Welt einschließlich dieser Menschen weiterlaufen. |
| Verbindungsabbruch | Anwesenheit wird über Lebenszeichen ermittelt. Spätestens 15 Sekunden nach dem letzten Lebenszeichen gilt ein Browser als getrennt; ab Ende seines Gültigkeitsfensters zählt keine Spielzeit mehr. |
| Gleichzeitiges Ziehen | Eine gezogene Karte beziehungsweise ein Stapel wird kurz für den ziehenden Spieler reserviert. Die Reservierung wird nach Loslassen oder Verbindungsverlust freigegeben. |
| Darstellung | Zunächst einheitliche, gut lesbare Karten mit Namen, Symbol, Zustandsanzeige und sichtbaren Fortschrittsbalken. |

## 1. Technische Grundlage und gemeinsame Welt

- [x] **V1-01.1:** Vite-Frontend und Node-Backend lassen sich anhand einer kurzen Anleitung lokal starten und bauen.
- [ ] **V1-01.2:** Alle Besucher landen automatisch in derselben Welt; es gibt keine Raumwahl und keine privaten Welten.
- [ ] **V1-01.3:** Zwei unabhängige Browser sehen dieselben Karten, Positionen, Stapel und Fortschritte.
- [x] **V1-01.4:** Gültigkeit von Käufen, Rezepten, Beute und Zeitabläufen wird vom Backend entschieden. Der Browser allein kann keine zusätzlichen Karten erzeugen.
- [x] **V1-01.5:** Die leere Welt wird auch bei zwei gleichzeitigen Erstbesuchen genau einmal angelegt. Gold für drei Pakete wird ausschließlich bei dieser Erstanlage vergeben.

Abnahme: Zwei Browser öffnen die Seite gleichzeitig und sehen nach dem Beitritt dieselbe Welt ohne doppelte Erstausstattung.

## 2. Name, Cookie und Menschenkarte

- [ ] **V1-02.1:** Ohne gültiges Spieler-Cookie erscheint vor dem Mitspielen eine Namensabfrage; leere Namen werden abgewiesen.
- [x] **V1-02.2:** Pro Name existiert genau ein Spieler mit genau einer zugehörigen Menschenkarte, die beim Tod zur Leiche wird. Die Karte zeigt diesen Namen an; der Tod erzeugt keine Ersatz-Menschenkarte.
- [x] **V1-02.3:** Neuladen und mehrere Tabs mit demselben Cookie erzeugen keinen zusätzlichen Menschen.
- [x] **V1-02.4:** Ein bereits vorhandener Name erzeugt auch ohne vorheriges Cookie keine weitere Menschenkarte. Auch gleichzeitige Beitritte erzeugen keine doppelten Namen oder Menschen.
- [x] **V1-02.5:** Jeder Spieler kann auch Menschenkarten anderer Spieler bewegen und für Aktionen einsetzen.
- [ ] **V1-02.6:** Ein neuer Mensch beginnt mit 75 von 75 Lebenspunkten; der aktuelle Wert ist für alle Mitspieler sichtbar.

Abnahme: Zwei unterschiedliche Namen erzeugen zwei Menschen; ein erneuter Besuch mit demselben Cookie erzeugt keinen dritten.

## 3. Karten, Drag-and-drop und Stapel

- [ ] **V1-03.1:** Alle Karten außer Gegnern sowie ungeöffnete Pakete lassen sich frei auf dem Spielfeld bewegen.
- [ ] **V1-03.2:** Alle Karten können aufeinander gestapelt werden, auch ohne gültiges Rezept. Ein ungültiger Stapel verbraucht nichts. Legt man einen Menschen auf eine Ratte, beginnt der definierte Kampf; die Ratte bleibt von manuellem Verschieben ausgenommen.
- [ ] **V1-03.3:** Wird die unterste Karte gegriffen, kann der ganze Stapel gemeinsam verschoben werden; die Reihenfolge bleibt erhalten.
- [ ] **V1-03.4:** Jeder Kartenname bleibt im Stapel zugänglich. Beim Greifen einer beliebigen Karte werden diese Karte und alle darüberliegenden Karten herausgetrennt und gemeinsam bewegt. Darunterliegende Karten bleiben liegen. Ein Werkzeug folgt seinem mitgenommenen Menschen; ein direkt gegriffenes Werkzeug bewegt sich allein.
- [ ] **V1-03.5:** Während des Ziehens bleibt die eigene Bewegung flüssig; andere Spieler sehen die Bewegung laufend und anschließend dieselbe Endposition.
- [ ] **V1-03.6:** Wenn zwei Spieler dieselbe Karte greifen, erhält nur einer die Kontrolle. Es entstehen keine Kopien, verlorenen Karten oder dauerhaft gesperrten Stapel.
- [ ] **V1-03.7:** Kauf, Verkauf, Füttern und Werkzeugbedienung verwenden Drag-and-drop. Gegner werden ausschließlich durch das Spiel bewegt. Klickausnahmen sind die einzelne Kartenentnahme aus einem Paket und die Goldentnahme aus dem Sparschwein. Reines Verschieben eines Pakets oder Sparschweins entnimmt nichts.

Abnahme: Browser A greift die unterste Karte und bewegt den vollständigen Stapel. Anschließend greift er eine mittlere Karte am Namen: Nur diese und die darüberliegenden Karten folgen, die unteren bleiben liegen. Browser B sieht dieselbe Auswahl und Endposition und kann danach beide Teilstapel weiterverwenden. Ein direkt gegriffenes angeheftetes Werkzeug wird allein abgelegt.

## 4. Gold und Basicpakete

- [ ] **V1-04.1:** Gold existiert als sichtbare, bewegliche und stapelbare Karte; es ist kein ausschließlich unsichtbarer Kontostand.
- [x] **V1-04.2:** Beim erstmaligen Anlegen erhält die gemeinsame Welt Gold für genau drei Basicpakete. Weitere Beitritte und Wiederverbindungen erzeugen kein Startgold.
- [x] **V1-04.3:** Einzelgold oder Goldstapel zahlt den noch offenen Paketpreis an. Vor vollständiger Zahlung entsteht kein Paket; die Teilzahlung bleibt erhalten. Sobald zusammen 3 Gold eingezahlt wurden, entsteht genau ein Paket, und der Shop beginnt die nächste Bestellung bei 3 Gold. Nur der Restbetrag wird verbraucht; überschüssiges Gold bleibt erhalten.
- [x] **V1-04.4:** Jeder Klick auf ein gekauftes Paket erzeugt genau eine zufällige Karte; Duplikate sind möglich. Die Restanzahl sinkt von drei auf zwei auf eins. Der dritte Klick entfernt das leere Paket. Zwischen den Klicks kann das Paket verschoben werden, ohne eine weitere Karte zu ziehen.
- [x] **V1-04.5:** Mögliche Inhalte sind Baum, Fels, Beerenbusch, Ratte und fruchtbarer Boden. Ratte und Boden sind sehr selten.
- [x] **V1-04.6:** Paketinhalt wird im Backend bestimmt und bleibt bei Wiederverbinden gleich. Gleichzeitiges Öffnen erzeugt keine zusätzliche Beute.
- [ ] **V1-04.7:** Preis und Chancen sind zentral anpassbar; alle Mitspieler sehen denselben Kauf und dieselben gezogenen Karten.
- [ ] **V1-04.8:** Der für alle gemeinsame Restpreis ist sichtbar. Drei einzeln eingezahlte Goldkarten senken ihn schrittweise bis zur vollständigen Zahlung. Nach dem Paket erscheint wieder 3 Gold als offener Betrag. Teilzahlungen bleiben nach Neuladen und für andere Spieler erhalten; zwei gleichzeitige Einzahlungen erzeugen keine doppelten Pakete.
- [ ] **V1-04.9:** Neu gekaufte Pakete liegen an freien Plätzen. Mehrere Käufe erzeugen keine nur optisch aufeinanderliegenden, voneinander unabhängigen Karten, die sich nicht als echter Stapel greifen lassen.
- [ ] **V1-04.10:** Der Paketrest bleibt nach Neuladen und Wiederverbinden erhalten. Wiederholung derselben Klickanfrage zieht keine zweite Karte. Gleichzeitige Klicks können zusammen höchstens den tatsächlich vorhandenen Restinhalt entnehmen. Die optionale Öffnungsfläche öffnet ausschließlich den verbleibenden Rest und erzeugt keine bereits gezogenen Karten erneut.
- [x] **V1-04.11:** Ein direkt zum Shop gezogenes Sparschwein bezahlt ein Paket aus gespeichertem Gold, sofern sein Guthaben mindestens den noch offenen Preis deckt. Nur dieser Restpreis wird abgebucht; Sparschwein und übriges Guthaben bleiben erhalten. Bei zu wenig Guthaben verändert sich nichts. Wiederholung derselben Anfrage und konkurrierende Käufe erzeugen keine zusätzlichen Pakete und keinen negativen Goldstand.

Abnahme: Spieler A zahlt ein einzelnes Gold ein, Spieler B sieht 2 Gold Restpreis und zahlt ein weiteres ein. Nach Neuladen steht noch 1 Gold offen. Die dritte Zahlung erzeugt genau ein Paket und setzt den Restpreis auf 3. Drei Startkäufe verbrauchen zusammen 9 Gold. Der erste Paketklick erzeugt eine Karte; nach Verschieben und Neuladen bleiben zwei Karten im Paket. Der zweite und dritte Klick erzeugen je eine weitere Karte, dann verschwindet das Paket. Die Wiederholung derselben Anfrage zieht keine weitere Karte. Drei Pakete ergeben insgesamt neun Karten. Nach einem Klick öffnet die optionale Öffnungsfläche genau die zwei restlichen Karten.

## 5. Abbau und Rohstoffe

- [ ] **V1-05.1:** Mensch + Baum startet automatisch einen zeitgesteuerten Abbau mit sichtbarem Fortschritt und erzeugt Holz oder Stöcke.
- [x] **V1-05.2:** Mensch + Fels erzeugt entsprechend Stein oder Feuerstein; Mensch + Beerenbusch erzeugt Beeren.
- [ ] **V1-05.3:** Erzeugte Rohstoffe erscheinen als eigene bewegliche Karten neben dem Arbeitsstapel und blockieren die Folgeaktion nicht.
- [x] **V1-05.4:** Der Mensch arbeitet automatisch weiter, bis die Quelle erschöpft ist; danach verschwindet nur die Quelle.
- [x] **V1-05.5:** Wegziehen eines notwendigen Beteiligten bricht den laufenden Durchgang ab, ohne einen vorzeitig fertigen Rohstoff zu erzeugen.
- [ ] **V1-05.6:** Eine Quelle und ein Mensch können nicht durch mehrere Browser gleichzeitig mehrfach für denselben Durchlauf abgerechnet werden.
- [ ] **V1-05.7:** Gleichartige Abbauprodukte werden als echter, gemeinsam beweglicher Stapel abgelegt. Unterschiedliche Produkte erhalten getrennte Plätze. Ein bereits wegbewegter Produktstapel zieht neue Erträge nicht zu seinem entfernten Ort.
- [x] **V1-05.8:** Ein Mensch arbeitet mehrere gleichartige oder gemischte Quellen im selben Stapel nacheinander vollständig ab. Er beginnt automatisch mit der nächsten Quelle; es läuft nur ein Durchgang je Mensch. Neu nachgelegte Quellen ändern die laufende Quelle und ihren Fortschritt nicht. Das Entfernen einer wartenden Quelle unterbricht die aktuelle Arbeit nicht; das Entfernen des Menschen oder der aktuellen Quelle bricht den laufenden Durchgang ab. Das passende Werkzeug bestimmt die Geschwindigkeit für jede Quelle neu.
- [ ] **V1-05.9:** Die gerade bearbeitete Quelle, der Fortschritt und die wartenden Quellen sind im Browser verständlich erkennbar. Der Wechsel zur nächsten Quelle wird für alle Mitspieler gleich dargestellt.

Abnahme: Jede der drei Quellen wird bis zur Erschöpfung bearbeitet; ein abgebrochener Durchlauf wird nicht als abgeschlossen ausgezahlt. Danach Mensch, Baum, Fels und Beerenbusch zu einem Stapel legen: Es läuft genau eine Aktion, jede Quelle verschwindet erst nach ihrer Erschöpfung, und die nächste beginnt automatisch. Während eines Durchgangs eine Quelle hinzufügen und eine wartende Quelle entfernen; der aktuelle Fortschritt bleibt erhalten. Den Menschen aus dem Arbeitsstapel ziehen; der laufende Durchgang endet ohne vorzeitigen Ertrag.

## 6. Erste Bau- und Herstellungsrezepte

| Ergebnis | Zutaten | Arbeitskraft | Bauzeit | Wirkung |
| --- | --- | --- | --- | --- |
| Sparschwein | 5 Gold + 2 Holz | Mensch; als Vorgabe bestätigt | 60 Sekunden; bestätigt | Gold hineinziehen, per Klick Gold ausgeben |
| Lager | 5 Holz + 5 Stein | Mensch | 30 Sekunden | Zunächst keine Wirkung; Kartenlimit folgt später |
| Axt | 5 Holz + 1 Stein | Mensch | 20 Sekunden | Ausrüstbar; schnellerer Baumabbau |
| Spitzhacke | 5 Holz + 2 Stein | Mensch | 20 Sekunden | Ausrüstbar; schnellerer Felsabbau |

- [ ] **V1-06.1:** Ein passender Zutatenstapel mit Arbeitskraft startet automatisch das richtige Rezept und zeigt Ergebnis sowie Restzeit an.
- [x] **V1-06.2:** Ein Zutatenstapel kann nicht gleichzeitig mehrere Rezepte auslösen. Fehlende oder unpassende Zutaten verbrauchen keine Karten.
- [x] **V1-06.3:** Nach Abschluss werden nur die Zutaten verbraucht; Mensch und ausgerüstetes Werkzeug bleiben bestehen, genau eine Ergebniskarte entsteht.
- [x] **V1-06.4:** Vor Abschluss entfernte Zutaten oder Arbeitskraft brechen den Bau ab. Bei diesem Abbruch gehen keine Zutaten verloren.
- [ ] **V1-06.5:** Das Sparschwein benötigt exakt 60 Sekunden aktive Weltzeit und nimmt anschließend Goldkarten per Drag-and-drop auf. Ein Klick lässt genau eine gespeicherte Goldkarte neben dem Schwein herausfallen. Reines Verschieben löst keine Auszahlung aus.
- [ ] **V1-06.6:** Das Lager ist herstellbar und beweglich. Ein Kartenlimit wird in V1 noch nicht eingeführt.
- [ ] **V1-06.7:** Einlagern und Entnehmen erhalten die Gesamtmenge aus frei liegendem und gespeichertem Gold. Gleichzeitige Einzahlungen und Klicks erzeugen weder Goldverluste noch doppelte Auszahlungen. Ein leeres Schwein zahlt nichts aus.

Abnahme: Jedes Rezept wird einmal abgeschlossen und einmal unterbrochen. Zutaten werden weder doppelt verbraucht noch dupliziert.

## 7. Werkzeuge anziehen und ablegen

- [ ] **V1-07.1:** Axt und Spitzhacke lassen sich per Drag-and-drop an einem Menschen ausrüsten; die Zuordnung ist sichtbar und für alle Spieler gleich.
- [x] **V1-07.2:** Eine ausgerüstete Axt verkürzt die Abbauzeit am Baum messbar.
- [x] **V1-07.3:** Eine ausgerüstete Spitzhacke halbiert die Abbauzeit am Fels von zehn auf fünf Sekunden.
- [ ] **V1-07.4:** Werkzeuge können per Drag-and-drop wieder abgelegt werden. Derselbe Gegenstand kann nicht an zwei Menschen gleichzeitig ausgerüstet sein.

Abnahme: Derselbe Abbauvorgang wird mit und ohne Axt verglichen. Der Vergleich wird auch für die Spitzhacke durchgeführt; jeweils nur das passende Werkzeug beschleunigt den Abbau.

## 8. Ratten und Kampf

- [x] **V1-08.1:** Eine aus einem Paket gezogene Ratte erscheint als Karte und bewegt sich langsam selbstständig auf den nächsten lebenden Menschen zu. Leichen sind kein Angriffsziel.
- [x] **V1-08.2:** Kein Spieler kann Ratten per Drag-and-drop verschieben.
- [x] **V1-08.3:** Sobald Ratte und Mensch nahe genug beieinander sind, beginnt automatisch ein Kampf. Der Kampfbereich besitzt einen sichtbaren roten Rahmen.
- [x] **V1-08.4:** Wird ein Mensch direkt zur Ratte gezogen, beginnt der Kampf ohne weiteres Annähern.
- [ ] **V1-08.5:** Treffer sind erkennbar; eine Ratte wird nach genau zwei Treffern besiegt und entfernt.
- [ ] **V1-08.6:** Gold, Knochen oder Fleisch können als Beutekarten erscheinen. Ein Rattentod wird auch bei mehreren Beobachtern nur einmal abgerechnet.
- [x] **V1-08.7:** Jeder tatsächliche Angriff einer Ratte verursacht genau 1 Schaden am betroffenen Menschen. Ein Mensch kann während eines Kampfs nicht zugleich abbauen oder bauen.
- [ ] **V1-08.8:** Alle Mitspieler sehen dieselben Rattenpositionen, Kämpfe, Treffer und Beutekarten.
- [ ] **V1-08.9:** Eine per Drag-and-drop gegebene Beere heilt genau 1 Lebenspunkt und wird dabei verbraucht. Die Heilung überschreitet 75 Leben nicht; bei vollen Lebenspunkten wird nichts verbraucht.
- [ ] **V1-08.10:** Lebenspunkte und Heilung bleiben nach Wiederverbinden erhalten. Zwei Spieler können dieselbe Beere nicht doppelt zur Heilung verwenden.
- [x] **V1-08.11:** Bei 0 Lebenspunkten wird der Mensch genau einmal zu einer Leichenkarte und beendet seine Arbeit beziehungsweise seinen Kampf. Lebenspunkte werden nicht negativ. Die Leiche kann keine Aktionen mehr ausführen und durch Beeren nicht wiederbelebt werden.
- [x] **V1-08.12:** Die Leiche bleibt dem bisherigen Namen zugeordnet. Wiederverbinden oder erneute Namenseingabe erzeugen weder einen neuen Menschen noch eine Wiederbelebung. Totem und Wiederbelebungsrezept sind für eine spätere Version vorgesehen.

Abnahme: Ein Kampf beginnt durch Annäherung der Ratte, ein zweiter durch Hinziehen des Menschen. Beide Ratten sterben nach jeweils zwei Treffern. Ein kontrollierter Rattenangriff ändert 75 Leben zu 74; eine Beere heilt anschließend auf 75. Zusätzliche Heilung überschreitet den Maximalwert nicht. Ein Mensch mit einem verbliebenen Leben wird durch einen Rattenangriff zur Leiche; Beere und erneuter Beitritt beleben ihn nicht wieder.

## 9. Kartenverkauf, fruchtbarer Boden und Erdbeerfeld

- [ ] **V1-09.1:** Karten können gegen sichtbare Goldkarten verkauft werden. Preise und verkaufbare Kartentypen sind zentral festgelegt und vor einem Verkauf erkennbar.
- [ ] **V1-09.2:** Verkauf funktioniert per Drag-and-drop. Jede verkaufte Karte wird genau einmal entfernt und erzeugt genau ihren festgelegten Goldwert, auch bei gleichzeitigem Zugriff.
- [ ] **V1-09.3:** Fruchtbarer Boden kann selten aus dem Basicpaket kommen und lässt sich bewegen und stapeln.
- [x] **V1-09.4:** Fruchtbarer Boden + eine Beere startet das Wachstum zu einem Erdbeerfeld. Kein Mensch muss im Stapel stehen oder dafür gebunden werden. Die Wachstumsdauer beträgt genau eine Stunde Echtzeit, einschließlich Offlinezeit.
- [x] **V1-09.5:** Nach der Wachstumsdauer entsteht genau ein Erdbeerfeld. Die eingesetzte Beere kann nicht zugleich gegessen oder verkauft werden. Werden Boden und Beere vor Abschluss getrennt, endet der laufende Wachstumsvorgang ohne Verbrauch der Zutaten.
- [x] **V1-09.6:** Ein Erdbeerfeld hält nach einem Tagesintervall genau eine Ernte mit zehn Beeren bereit, auch wenn niemand online ist. Mehrere Tage ohne Ernten erhöhen diese Menge nicht. Nach der bestätigten Entnahme sind die Beeren frei bewegliche Karten; dann beginnt ein neuer 24-Stunden-Zeitraum.
- [ ] **V1-09.7:** Wachstum und Ernte sind gespeichert. Mehrere Browser oder Wiederverbinden erzeugen weder zusätzliche Felder noch doppelte Tagesernten.
- [ ] **V1-09.8:** Dasselbe Feld kann nicht von zwei Spielern doppelt geerntet werden. Das Feld bleibt nach dem Ernten bestehen; es entstehen keine nachträglichen Ernten für verpasste Tage.

Abnahme: Kartenverkauf finanziert mindestens ein weiteres Paket. Mit einer kontrollierbaren Testuhr entsteht aus Boden und Beere nach einer Stunde ohne Mensch ein Feld. Nach sieben Tagen ohne Besuch steht weiterhin nur eine Ernte mit zehn Beeren bereit. Zwei gleichzeitig erntende Browser erhalten zusammen genau zehn Beeren. Direkt danach ist keine weitere Ernte möglich. Nach 24 weiteren Stunden sind erneut zehn Beeren bereit. Der Test benötigt kein reales Abwarten von Tagen.

## 10. Speichern, Wiederverbinden und Weltpause

- [ ] **V1-10.1:** MongoDB speichert Spieler, Karten, Ausrüstung, Positionen, Stapelreihenfolge, Quellenreste, Lebenspunkte, Leichen mit Namenszuordnung, Sparschweinguthaben, gemeinsame Paket-Teilzahlungen, laufende Aktionen, Kampfzustände sowie Wachstums- und Erntezeitpunkte der Felder.
- [ ] **V1-10.2:** Neuladen, Backend-Neustart und erneutes Verbinden stellen den bestätigten Weltzustand wieder her. Während einer Trennung wird der Verbindungsstatus angezeigt.
- [ ] **V1-10.3:** Solange mindestens ein Spieler anwesend ist, laufen Abbau, Bau, Rattenbewegung und Kampf weiter. Mehr Tabs oder Spieler beschleunigen die Weltzeit nicht.
- [x] **V1-10.4:** Sobald keine gültige Anwesenheit mehr besteht, pausiert die Welt einschließlich Rattenbewegung, Kampf, Abbau und Bau. Ausnahme: Bodenwachstum und Erdbeerfeldreife verwenden echte Zeit und laufen bis zu einer bereitstehenden Ernte weiter.
- [x] **V1-10.5:** Beim nächsten Beitritt geht es mit dem gespeicherten Fortschritt weiter. Die Abwesenheit erzeugt keine nachträglichen Abbaurohstoffe, Treffer oder Baufortschritte. Bei Erdbeerfeldern wird anhand der Zeitpunkte höchstens eine Ernte mit zehn Beeren als bereit erkannt.
- [x] **V1-10.6:** Abbruch und Wiederholung einer Anfrage können Gold, Zutaten, Pakete und Beute nicht mehrfach ausgeben oder erzeugen.
- [x] **V1-10.7:** Ein isolierter lokaler Stabilitätstest mit zwei Verbindungen desselben Spielers läuft mindestens 75 Sekunden ohne unerwartete Trennung und ohne Zustandszugriffe in Ruhe. Nach bewusstem Schließen eines Tabs bleibt der andere anwesend. Entwicklungsneustarts durch `node --watch` werden davon getrennt bewertet; dieser Nachweis umfasst keinen Vite-/Vercel-Neustart und keinen Redis-Ausfall.

Abnahme: Während eines Sparschweinbaus nach etwa 20 Sekunden alle Browser schließen, nach zwei Minuten zurückkehren und prüfen, dass ungefähr 40 Sekunden aktive Bauzeit verbleiben. Eine kurze Verzögerung bis zum Ablauf des letzten Lebenszeichens wird berücksichtigt.

## 11. Darstellung und Geräte

- [ ] **V1-11.1:** Auf einem PC mit Maus sind Namen, Stapel, Kartenwerte, Lebenspunkte, Sparschweinguthaben, Fortschritte und Kampfrahmen gut erkennbar und bedienbar.
- [ ] **V1-11.2:** Ein Stapel bleibt auch bei größerer Höhe am Kartennamen trennbar; Karten können nicht dauerhaft unerreichbar außerhalb der Spielfläche verschwinden.
- [ ] **V1-11.3:** Eine kurze sichtbare Bedienhilfe erklärt Stapelziehen, Trennen am Namen, Kaufen, Öffnen und Arbeitsbeginn.
- [ ] **V1-11.4 – Zusatzwunsch:** Im Handy-Querformat funktionieren Verschieben, Stapeln und Trennen per Touch. Dies wird getrennt von der Pflichtabnahme am PC bewertet.

## 12. Vercel-Betrieb und gemeinsame Schlussabnahme

- [ ] **V1-12.1:** Frontend und Node-Backend laufen als zwei getrennte Vercel-Projekte aus den Ordnern `frontend/` und `backend/`. Das Backend greift auf MongoDB Atlas und den gemeinsamen Redis-Verteiler zu; Anmeldung und Echtzeitverbindung funktionieren zwischen beiden veröffentlichten Adressen.
- [ ] **V1-12.2:** Datenbank-Zugangsdaten werden nur im Backend als Umgebungsvariablen verwendet; eine Beispielkonfiguration enthält keine echten Geheimnisse.
- [ ] **V1-12.3:** Getrennte Backend-Instanzen und neue Deployments verwenden dieselbe gespeicherte Welt. Weltzustand und Anwesenheit hängen nicht ausschließlich am Speicher eines einzelnen Node-Prozesses.
- [ ] **V1-12.4:** Nach einem regulären Verbindungsende verbindet sich der Browser erneut, lädt den Weltzustand und erzeugt keine zusätzlichen Menschen oder Karten.
- [ ] **V1-12.5:** Zwei unabhängige Browser spielen gemeinsam den Ablauf Beitritt → Gold ausgeben → Pakete öffnen → stapeln → abbauen → verkaufen → Sparschwein bauen, füllen und anklicken → Werkzeug anlegen → kämpfen und heilen → Erdbeerfeld anlegen → speichern und wiederkehren. Lange Wachstums- und Erntezeiten werden zusätzlich mit kontrollierbarer Testuhr geprüft.
- [ ] **V1-12.6:** Gleichzeitiger Kauf mit denselben Goldkarten, doppelte Paketöffnung, konkurrierendes Ziehen, Rezeptabbruch, doppelte Heilung oder Sparschweinauszahlung, Tod mit anschließendem Wiederbeitritt, doppelte Feldentnahme, begrenzte Offlineernte und Weltpause wurden gezielt geprüft.

## 13. Ressourcenarme Synchronisation

Festes Ziel: möglichst wenig Ressourcen und Energie verbrauchen und gleichzeitig ein gutes gemeinsames Spielerlebnis bieten. Die folgende Architektur ist umgesetzt; die tatsächlichen Grenzen werden mit Tests und Messungen geprüft. Redis ist für den verteilten Vercel-Betrieb erforderlich und lokal optional. Anbieter und Tarif sind noch nicht festgelegt; der Live-Test steht aus.

### Aufteilung

- **WebSocket je aktivem Browser:** Der Browser erhält Änderungen, ohne ständig den gesamten Weltzustand per HTTP oder Datenbankabfrage abzurufen.
- **Lokale Darstellung:** Die eigene gezogene Karte folgt sofort der Maus. Für andere Spieler werden höchstens zehn Positionsvorschauen pro Sekunde und ziehendem Spieler übertragen und zwischen diesen Punkten weich dargestellt. Unveränderte Positionen erzeugen keine Nachricht.
- **Flüchtiger Verteiler:** Redis Pub/Sub verteilt die kleinen Vorschauen zwischen den Vercel-Backend-Instanzen. Lokal genügt für einen einzelnen Node-Prozess der interne Verteiler. Redis benötigt eine native Redis-Verbindung und ersetzt MongoDB nicht.
- **Verbindliche Änderungen:** Beim Loslassen wird die Endposition gespeichert. Kauf, Stapeländerung, Bauabschluss und Beute werden ebenfalls durch das Backend geprüft und verbindlich in MongoDB gespeichert. Erst eine erfolgreiche Speicherung bestätigt die Aktion.
- **Kleine Nachrichten:** Üblicherweise werden nur betroffene Karten und ihre Änderungen übertragen. Einen vollständigen Weltzustand gibt es beim Beitritt oder wenn ein Zustandsabgleich erforderlich ist.
- **Zeitereignisse statt Animations-Ticks:** Bau und Abbau speichern Beginn und Fälligkeit in aktiver Weltzeit. Fortschrittsbalken berechnen Browser selbst; für einen 60-Sekunden-Bau werden keine 60 Fortschrittsstände gespeichert. Ein aktiver Koordinator wird nur für die nächsten fälligen Spielereignisse geweckt.
- **Erdbeerfelder:** Ein gespeicherter Echtzeitpunkt bestimmt Wachstumsende beziehungsweise nächste Erntereife. Beim nächsten Zugriff wird die Reife daraus berechnet; nach tagelanger Abwesenheit steht höchstens eine Ernte bereit. Erst eine bestätigte Entnahme setzt den nächsten Erntezeitpunkt. Dafür braucht offline kein Spielprozess weiterzulaufen, es werden keine vergangenen Tagesernten durchgerechnet und keine regelmäßigen Datenbankschreibzugriffe benötigt.
- **Ratten:** Das Backend bestimmt Ziel und Bewegungsabschnitt; Browser stellen die Bewegung dazwischen dar. Zielwechsel, Beginn eines Kampfes und Treffer sind verbindliche Ereignisse. Kollisionszeitpunkte werden berechnet, nicht von jedem Browser eigenständig entschieden.
- **Pause und Darstellung:** Wenn niemand mehr anwesend ist, endet die aktive Simulation. Versteckte Tabs stellen keine Animationen dar; ruhende Szenen benötigen keine dauernde Neuberechnung. Kleine Lebenszeichen bleiben nötig, solange ein Tab als anwesend gelten soll.

### Zuverlässigkeit

Jede verbindliche Aktion besitzt eine eindeutige ID. Zustandsversion, Kartenverbrauch und diese ID werden atomar gesichert, damit eine Wiederholung keine zweite Auszahlung verursacht. Kurze Ziehreservierungen verhindern konkurrierende Bewegungen. Redis vergibt Zeitereignisse befristet je Weltrevision; die atomare MongoDB-Prüfung dieser Revision verhindert die doppelte Abrechnung durch alte oder parallele Instanzen. Lokale Timer sind nur Wecker, nicht die alleinige Zeitquelle.

Eine flüchtige Pub/Sub-Nachricht ist kein dauerhafter Spielstand. Nach Verbindungsunterbrechungen und erkannten Versionslücken erfolgt ein Abgleich mit MongoDB. Auch nach einem Ausfall des Nachrichtenverteilers muss ein bestätigter Kauf erhalten bleiben. Für Ausfälle während eines Ziehens gilt die zuletzt bestätigte Position; unbestätigte Vorschauen dürfen verloren gehen.

### Messbare Abnahmepunkte

- [x] **V1-13.1:** Reine Positionsvorschauen sind auf höchstens zehn Nachrichten pro Sekunde und ziehendem Spieler begrenzt. Start, Loslassen und notwendige Korrekturen sind separate Ereignisse.
- [x] **V1-13.2:** Eine fünf Sekunden lang gezogene Karte benötigt höchstens 50 Positionsvorschauen und eine dauerhafte Speicherung ihrer Endposition. Reservierungs- und Bestätigungsnachrichten werden separat gezählt. Positionsvorschauen verursachen keine MongoDB-Schreibzugriffe.
- [x] **V1-13.3:** Eine ruhende Welt ohne laufende Aktionen erzeugt keine regelmäßigen vollständigen Zustandsabfragen und keine Spielzustandsschreibzugriffe. Lebenszeichen und notwendige Verbindungsverwaltung werden separat erfasst.
- [ ] **V1-13.4:** Ein Sparschweinbau überträgt Beginn, relevante Unterbrechungen und Abschluss; der Fortschrittsbalken benötigt keine fortlaufenden Netzwerknachrichten oder MongoDB-Schreibzugriffe.
- [x] **V1-13.5:** Vollständige Zustandsübertragungen erfolgen nur beim Beitritt, beim notwendigen Wiederabgleich oder bei Wiederherstellung einer Verbindung; der Normalbetrieb überträgt Änderungen.
- [ ] **V1-13.6:** Langsame Verbindungen sammeln keine unbegrenzte Warteschlange veralteter Positionsvorschauen an. Verbindliche Änderungen gehen dadurch nicht verloren.
- [ ] **V1-13.7:** Wiederverbinden nach Vercel-Laufzeitende, Ausfall des Verteilers und konkurrierende Zeitereignisse werden geprüft. Goldverbrauch, Beute, Bauabschluss, Heilung und Tagesernte bleiben eindeutig.
- [ ] **V1-13.8:** Bei einem Probelauf mit vier Browsern werden Nachrichtenanzahl, übertragene Datenmenge, MongoDB-Zugriffe und verfügbare CPU-/Laufzeitmetriken für Ruhe, Ziehen und laufende Arbeit erfasst. Vier Browser sind ein Messszenario, keine vereinbarte Spielerobergrenze.
- [x] **V1-13.9:** Offlinewachstum und Feldreife benötigen keinen durchlaufenden Server, keine täglichen Cron-Aufrufe und keine Abrechnung verpasster Ernten. Nach sieben Tagen Abwesenheit genügen die gespeicherten Zeitpunkte, um höchstens zehn erntereife Beeren pro Feld festzustellen.

Der Verbrauch wird anhand dieser Messwerte beurteilt. Die erste lokale Vier-Client-Messung ergab: Ruhe 0 Zustandszugriffe, Ziehen mit 50 Vorschauen und einer Speicherung, Abbau mit einer Speicherung und vier Ergebnisnachrichten. Die Speicherzähler stammen aus dem Dateiadapter; WebSocket-Kontrollframes sowie Atlas-, Redis- und Vercel-Verbrauch sind darin nicht enthalten. Eine CO₂-Aussage wird daraus nicht abgeleitet. V1-13.8 bleibt bis zur Messung der Zielumgebung offen.

## 14. Gemeinsame Einstellungen: Karten, Kombinationen und Pakete

Erweiterung vom 26.10.2026: Ein angemeldeter Spieler kann den gemeinsamen Spielkatalog über eine Einstellungsseite bearbeiten. Die bisherigen Spielwerte bleiben die Ausgangskonfiguration; eigene Definitionen werden in derselben Welt gespeichert. In der offenen Entwicklungswelt besitzen alle benannten Spieler diese Berechtigung.

- [ ] **V1-14.1:** Die Einstellungsseite ist vom Spiel erreichbar und bietet die Bereiche Karten, Kombinationen und Pakete. Der Rückweg zum Spiel erhält den Spielstand.
- [ ] **V1-14.2:** Karten können angelegt, bearbeitet und gelöscht werden. Name, Beschreibung, Darstellung und Verkaufswert sind bearbeitbar; benötigte Systemdefinitionen und verwendete Verweise werden verständlich berücksichtigt.
- [ ] **V1-14.3:** Kombinationen können erstellt und bearbeitet werden. Zutatenmengen, Ergebnis, Ergebnisanzahl, Dauer und benötigte Arbeitskraft wirken sich auf die Spiellogik aus.
- [ ] **V1-14.4:** Pakete können mit Name, Preis, Kartenanzahl und gewichteten Karteninhalten angelegt und bearbeitet werden. Sie erscheinen im Shop und liefern beim Öffnen genau den konfigurierten Inhalt beziehungsweise die konfigurierte Ziehung.
- [ ] **V1-14.5:** Der Katalog bietet strukturierte Effektbausteine für Quellen, Heilung und Werkzeuge. Eine Konfiguration wird als Daten gespeichert und kann um spätere Effektarten erweitert werden.
- [x] **V1-14.6:** Gespeicherte Einstellungen kommen beim zweiten verbundenen Spieler als Zustandsänderung an und bleiben über einen Backend-Neustart mit derselben Welt erhalten. Ein wiederholter Speichervorgang mit derselben Befehlskennung erhöht die Katalogversion nicht erneut.
- [x] **V1-14.7:** Ungültige Kartenverweise oder zu große Nachrichten verändern weder Katalog noch Weltstand. Der Server verlangt eine gültige Spielersitzung. Gleichzeitiges Speichern eines veralteten Katalogstands wird als Konflikt abgewiesen.
- [ ] **V1-14.8:** Die Abnahme erstellt eine eigene Karte, eine Kombination und ein Paket im Browser, speichert sie, lädt neu und prüft Kauf, Öffnen und Herstellung in einer separaten Testwelt. Die gemeinsame Atlas-Welt wird dafür nicht zurückgesetzt.

Automatisierte Evidenz: Drei zusätzliche Backend-Integrationstests in `tests/server.test.js` prüfen Katalogänderungen über WebSocket und HTTP, Verteilung an einen zweiten Spieler, einen gültigen Katalog größer als 24 KiB, Wiederholschutz, einen tatsächlichen gleichzeitigen Speicherkonflikt, Neustartpersistenz, atomar verworfene Referenzfehler und einen Kauf mit zwei Gold für ein eigenes Paket mit zwei eigenen Karten. Diese Prüfungen verwenden isolierte lokale Dateiwelten.

## 15. Kartenübersicht, neue Bilder und Lebewesen

- [x] **V1-15.1:** Für Lagerfeuer, Messer, Kuh, Hase, Huhn, Ei und Stall sind sieben neue transparente Motive erzeugt, im Projekt gespeichert und als Kartenbilder auswählbar. Die bisherigen Illustrationen bleiben erhalten.
- [x] **V1-15.2:** Lebewesen-Konfigurationen werden gespeichert und validiert: Angreifend ja/nein; Rumlaufend, Stehend oder Zielsuchend; Zielkartentyp, Laufgeschwindigkeit, Lebenspunkte, Schaden und Angriffsabstand.
- [x] **V1-15.3:** Friedliche Tiere starten keine Kämpfe selbst; aggressive Tiere greifen in Reichweite an. Zielsuche verfolgt die gewählte Karte. Bewegungen werden über Zeitabschnitte dargestellt und pausieren mit der Welt. Acht Tests in `tests/creatures.test.js` prüfen Bewegung, Ruhe, Zielwechsel, Kampf, Wegkollision, ungültige Werte und Altstände.
- [ ] **V1-15.4:** Die Kartenübersicht zeigt jede Karte als anklickbare Kachel. Ein Klick öffnet den Editor, „Alle Karten“ führt zurück. Bildauswahl, Verhalten und Speicherung sind im Browser abschließend geprüft.

Die Kartenübersicht, Auswahl einer Kuh, Bearbeitung und Speicherung wurden inzwischen im Browser geprüft. Der vollständige Bildauswahl- und Verhaltensdurchlauf ist noch offen; V1-15.4 bleibt deshalb als Gesamtpunkt offen. Die vorherige Zeitüberschreitung des Vorschauwerkzeugs verhindert aktuelle Browserprüfungen nicht mehr.

Zusätzliche Evidenz: Ein serverseitiger React-Render erzeugt die Übersicht mit 28 anklickbaren Karten und den neuen PNG-Bildreferenzen. Die sieben Spielbilder besitzen einen transparenten Hintergrund und sind für die Kartengröße verkleinert. Beim letzten Wiederanlauf trat ein TLS-Verbindungsfehler zu Atlas auf; der vorher erfolgreiche Datenbanknachweis bleibt historisch dokumentiert, die aktuelle Wiederverbindung steht zur Prüfung aus.

## 16. Spielbaum und Katalogexport

- [x] **V1-16.1:** Unter Einstellungen → Spielbaum sind die vorhandenen Pakete, Karten und Kombinationen als anklickbarer Baum sichtbar. Die technische Grunddefinition gekaufter Paketkarten wird nur bei einer eigenen Verwendung zusätzlich angezeigt. Es gibt keine separaten zukünftigen Planungsinhalte.
- [x] **V1-16.2:** Fortschritt zeigt den frühesten Herstellungsweg. Zusammenhänge zeigt Herkunft, Zutaten, Ergebnisse und weitere Verwendungen einer Auswahl. Quellen, Beute, Mengen und Wahrscheinlichkeiten werden berücksichtigt. Kreisläufe benötigen keinen erfundenen Startpunkt.
- [x] **V1-16.3:** Suche, Verschieben und Zoom funktionieren; ein Eintrag führt direkt zur passenden Bearbeitung und zurück zum Baum. Im Browser wurde der Weg vom Basicpaket über Baum und Holz zur Axt-Kombination und deren Editor geprüft.
- [x] **V1-16.4:** Katalog exportieren lädt den aktuellen Editorentwurf als JSON herunter. Karten, Effekte, Kombinationen und Pakete sind enthalten; Spieler, Sitzungen und laufender Weltstand fehlen. Der tatsächliche Browserdownload und ein unveröffentlichter Entwurf sind geprüft.

Automatisierte Evidenz: `tests/catalog-graph.test.js` prüft live geänderte Inhalte, Zutatenmengen, Ergebnisse, Quellen, nicht erreichbare Kreisläufe, doppelte Verwendungsrichtungen und den Inhalt des JSON-Exports. Der Export vor der Messer-/Kochergänzung enthielt 28 Karten, sieben Kombinationen und zwei Pakete; die aktuelle Standarddefinition umfasst 29 Karten, zehn Kombinationen und zwei Pakete.

## 17. Gruppen auf beiden Kampfseiten und einstellbare Beute

- [x] **V1-17.1:** Mehrere Menschen können gemeinsam kämpfen. Verstärkung und Rückzug erhalten den laufenden Angriffstimer. Stirbt der angegriffene Mensch, setzen überlebende Beteiligte den Kampf fort. Angriffe treffen nur erreichbare Gegner.
- [x] **V1-17.2:** Nahe Ratten schließen sich einem Kampf an und können beschäftigten Menschen folgen. Treffen getrennte Rattenkämpfe aufeinander, werden sie vereinigt. Kein Beteiligter wird mehrfach abgerechnet.
- [x] **V1-17.3:** Nach dem Tod eines Gegners fällt dessen konfigurierte Beute genau einmal an. Gesamtchance, mögliche Karten, Anzahl und Gewichte lassen sich im Karteneditor einstellen; ungültige Werte und gelöschte Beuteverweise werden atomar abgewiesen. Die bisherigen Rattenchancen bleiben erhalten.
- [x] **V1-17.4:** Der rote Rahmen und die Kampfanzeige umfassen beide Teams mit einzelnen Lebenspunkten. Eine isolierte Browserprüfung mit kontrollierter Uhr zeigte zwei Menschen und drei Ratten. Die gespeicherte Kuh-Beute von 100 % und zwei Fleisch blieb nach vollständigem Browserneuladen erhalten.

Automatisierte Evidenz: `tests/group-combat.test.js` und `tests/rat-teams.test.js` prüfen Teilnahme, Tod, Rückzug, Weltpause, Altstände, Verstärkung, Zusammenführung, Reichweite und einmalige Beute. Ein Backendtest prüft außerdem Verteilung und Neustartpersistenz der Beute-Konfiguration. Ein vollständiger gemeinsamer PC-Durchlauf und der Cloudtest bleiben offen.

## 18. Messer, Feuer, Braten und Hühnerbeute

- [x] **V1-18.1:** Ein Stock, ein Feuerstein und ein Mensch ergeben nach zehn Sekunden ein Messer. Ausrüsten erhöht den Kampfschaden um eins; Ablegen entfernt den Bonus. Der Effekt ist als Waffenschaden im Katalog bearbeitbar.
- [x] **V1-18.2:** Drei Stock und ein Feuerstein ergeben nach zehn Sekunden ohne Menschen ein Feuer. Feuer und Fleisch ergeben nach zehn Sekunden gebratenes Fleisch. Das Feuer bleibt als erhaltene Zutat verfügbar und kann erneut verwendet werden.
- [x] **V1-18.3:** Mensch auf Huhn beginnt einen Kampf. Währenddessen wird das Huhn nicht durch eine autonome Kombination verbraucht. Beim Tod fällt standardmäßig genau ein Knochen, ein Ei oder Fleisch mit gleichen Wahrscheinlichkeiten an.
- [x] **V1-18.4:** Gebratenes Fleisch besitzt ein neues transparentes Kartenbild im vorhandenen Stil. Original, Spielbild und Prompt sind im Projekt gespeichert; die Auswahl im Editor und der Rezeptweg sind im Browser geprüft.
- [x] **V1-18.5:** Bestehende Kataloge erhalten die neuen Definitionen als Inhaltsversion 3 ohne Zurücksetzen der Welt. Eigene Einstellungen, Paketpreise und gleichwertige Kombinationen bleiben erhalten; gelöschte Zutaten oder Ergebnisse erzeugen keine ungültigen Standardrezepte. Nach dem Speichern bleiben spätere Löschungen dauerhaft wirksam.

Automatisierte Evidenz: `tests/cooking-weapons.test.js` prüft Herstellung, erhaltene Zutaten, erneutes Braten, Abbruch und Änderungen laufender Kombinationen, Messerwirkung beim Ausrüsten/Ablegen sowie Hühnerkampf und Beute. `tests/content-upgrade.test.js` prüft Altstände, eigene Werte, gleichwertige oder gleich benannte Rezepte, fehlende Zutaten/Ergebnisse und dauerhaftes Löschen. Im Browser auf Port 3003 wurden 29 Karten, zehn Kombinationen und zwei Pakete bestätigt. Der Kochbaum zeigte Feuer + Fleisch → gebratenes Fleisch mit erhaltenem Feuer. Im Rezepteditor blieb das Feuer erhalten und kein Mensch war erforderlich; beim Messer war der Bonus eins sichtbar. Das ausgewählte neue Kartenbild wurde als PNG mit 384 Pixel Breite geladen. Die eigentliche Kampf- und Herstellungsabrechnung ist automatisiert geprüft; der vollständige gemeinsame PC-/Touch-/Cloudabschluss bleibt offen.

## 19. Getrennte Apps und Essenstapel

Historischer Zwischenschritt vom 28.10.2026: Spiel und API erhielten eigene Ordner und Vercel-Konfigurationen innerhalb eines gemeinsamen Entwicklungs-Repositories. Eine npm-Workspace-Abhängigkeit stellte die gemeinsamen Regeln bereit.

Seit dem 29.10.2026 sind Spiel, API und gemeinsame Regeln drei eigenständige Git-Repositories. Beide Apps verwenden eine auf dieselbe vollständige Commit-SHA festgelegte Git-/HTTPS-Abhängigkeit auf `MuStackShared`. Die beiden Vercel-Projekte bauen jeweils ihr eigenes App-Repository; das Shared-Paket wird durch `npm ci` installiert und benötigt kein separates Deployment.

- [x] **V1-19.1:** `frontend/` und `backend/` besitzen eigene Pakete und Vercel-Konfigurationen. Der Frontend-Build erzeugt `frontend/dist/`; der normale API-Start liefert keine Spieloberfläche aus. Root-Befehle starten Entwicklung und Tests weiterhin gemeinsam.
- [x] **V1-19.2:** Das Frontend leitet die vorgesehenen HTTP-Endpunkte über seinen eigenen `/api`-Proxy an `BACKEND_URL` weiter. HttpOnly-Cookie, API-Antwortstatus und notwendige Header bleiben erhalten. Ungültige Ziele, unbekannte Pfade und übergroße Anfragen werden abgewiesen; MongoDB-/Redis-Geheimnisse gelangen nicht in den Frontend-Build.
- [x] **V1-19.3:** Ein authentifizierter Browser bezieht ein einmal verwendbares WebSocket-Ticket mit 30 Sekunden Gültigkeit. Die direkte Verbindung zur API benötigt kein Drittanbieter-Cookie. Abgelaufene oder erneut verwendete Tickets sowie nicht freigegebene Ursprünge werden abgewiesen. Die geteilte Redis-Ticketablage und eindeutige Einlösung sind mit einem Redis-Testdouble geprüft; der echte Redis-Cloudnachweis bleibt offen. Wiederverbinden fordert ein neues Ticket an.
- [x] **V1-19.4:** Ein Stapel heilender Nahrung heilt einen lebenden Menschen höchstens bis 75 Leben. Nur benötigte Karten werden der Stapelreihenfolge nach verbraucht; übrige Karten bleiben erhalten. Unterschiedliche Heilungsstärken und herausgetrennte Teilstapel funktionieren. Volle Menschen, Leichen und normale Stapel mit nicht heilenden Karten verlieren kein Essen.
- [ ] **V1-19.5:** Beide Vercel-Projekte sind tatsächlich veröffentlicht und ein gemeinsamer Zwei-Browser-Durchlauf bestätigt Anmeldung, WebSockets, Wiederverbinden, Essenstapel, Paketkäufe und gespeicherten Fortschritt. Das Einrichten der Projektordner allein erfüllt diesen Cloudnachweis nicht.

Automatisierte Evidenz für Essenstapel: Zehn gezielte Prüfungen in `tests/food-stack.test.js` bestanden. Sie prüfen maximale Lebenspunkte, Überschuss, gemischte Heilungsstärken, Teilstapel, volle Menschen, Leichen, erhaltene Ausrüstung und den Schutz eines gefüllten Sparschweins mit Heilungseffekt. Insgesamt bestanden 189 Tests. Der Frontend-Workspace-Build und die API-Syntaxprüfung waren erfolgreich. `tests/split-apps.test.js` betreibt zwei echte lokale HTTP-Anwendungen und prüft den Frontend-Proxy, die Cookie-Sitzung, zwei direkte WebSocket-Verbindungen zur API ohne Cookie sowie Befehlsbestätigung und Zustandsänderung beim zweiten Client. Ticketablauf, Wiederholung und Ursprungsschutz sind zusätzlich in `tests/socket-tickets.test.js` geprüft; ein Redis-Testdouble ersetzt dort ausdrücklich keinen Live-Redis-Test.

Browser-Evidenz: Die bestehende Vorschau auf Port 3003 verband sich nach der Trennung erneut. Ein separat gestartetes Vite-Frontend auf Port 5193 zeigte über die API auf Port 3003 denselben gespeicherten Spielstand und die vorhandene Sitzung. Die lokale Vorschau verwendet weiterhin `.data/final-settings-check.json`; die Welt wurde für die Trennung nicht zurückgesetzt. Veröffentlichung und Zwei-Browser-Abnahme in der tatsächlichen Vercel-/Redis-Umgebung bleiben in V1-19.5 offen.

## Wann ist Version 1 abgenommen?

Die gewählten Umsetzungswerte sind dokumentiert, alle Pflichtpunkte sind umgesetzt und geprüft, und zwei Browser bestehen den gemeinsamen Schlussdurchlauf ohne verlorene oder doppelte Karten. Die Ressourcenmessung ist nachvollziehbar festgehalten. Der Handy-Zusatzwunsch wird separat bewertet; Totem und Kartenlimit bleiben für später vorgemerkt.

## Technische Leitplanken und Quellen

Vercel Functions unterstützen inzwischen WebSockets; dafür muss Fluid Compute aktiv sein. Verbindungen können bei Erreichen der Function-Laufzeit enden. Deshalb gehören Wiederverbinden, erneutes Laden des Zustands und gemeinsame Zustandsverwaltung über Backend-Instanzen hinweg zur Abnahme. Redis Pub/Sub ist für den verteilten Betrieb vorbereitet; Anbieter und Tarif sind noch nicht gewählt und der Vercel-/Redis-Livetest steht aus.

- [Vercel: WebSockets, Wiederverbinden und persistenter Zustand](https://vercel.com/docs/functions/websockets)
- [Vercel: getrennte Projekte in einem Monorepo](https://vercel.com/docs/monorepos)
- [Vercel: gemeinsame Quellen außerhalb des Root Directory](https://vercel.com/docs/monorepos/monorepo-faq)
- [Vercel: allgemeine Verfügbarkeit von WebSockets, 20.10.2026](https://vercel.com/changelog/websocket-support-is-now-generally-available)
- [MongoDB Atlas: Integration mit Vercel](https://www.mongodb.com/docs/atlas/reference/partner-integrations/vercel/)
- [Vercel: Beispiel für WebSockets und Verteilung über mehrere Instanzen](https://vercel.com/kb/guide/real-time-chat-websockets)
- [Redis: Pub/Sub und Zustellung ohne dauerhafte Wiederholung](https://redis.io/docs/latest/develop/pubsub/)
- [MongoDB: Change Streams für Datenbankänderungen](https://www.mongodb.com/docs/drivers/node/current/monitoring-and-logging/change-streams/)
