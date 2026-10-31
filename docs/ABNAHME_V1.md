# Abnahmeliste – StackFriends

Stand: 31.10.2026. Diese Liste beschreibt den Wechsel zu persönlichen Welten und die weiterhin geltenden Spielregeln. Automatisierte Tests prüfen die Regeln; die abschließende gemeinsame Spielabnahme erfolgt im Browser.

## Welten und Zugang

- [ ] Jeder neue Name startet mit einer eigenen frischen Welt, genau einer benannten Menschenkarte und neun Goldkarten für drei Basicpakete.
- [x] Der frühere gemeinsame Fortschritt ist gelöscht; angelegte Karten, Rezepte, Pakete und Bilder bleiben erhalten.
- [ ] Ein Cookie merkt den Namen. Ein bestehender Name öffnet dieselbe Welt und erzeugt keinen zweiten Menschen. Es gibt keinen Zugangscode.
- [ ] Andere Spieler erhalten nur die Materialübersicht, keinen Zugriff auf das fremde Spielfeld.
- [ ] Neuladen und API-Neustart erhalten den eigenen Stand.

## Rathaus und Geschenke

- [ ] 100 Stein und ein Mensch ergeben nach 60 Sekunden ein Rathaus; der Mensch bleibt erhalten.
- [ ] Ein Klick auf die Rathauskarte öffnet die Namensliste. Ohne Rathaus sind Liste, Materialabfrage und Verschenken auch in der API gesperrt.
- [ ] Ein Klick auf einen Namen zeigt die gespeicherten Materialmengen und den Speicherzeitpunkt.
- [ ] Karten oder ein zulässiger Teilstapel können auf einen Namen gezogen werden.
- [ ] Die Auswahl wird beim Absender einmal abgezogen und beim Empfänger einmal zugestellt, auch bei wiederholter Anfrage oder mehreren Tabs.
- [ ] Paketinhalt, Restnutzungen, gespeichertes Gold, Leben und Erntefristen bleiben beim Verschenken erhalten.
- [ ] Menschen, Leichen, angreifende Kreaturen, ausgerüstete und aktuell beschäftigte Karten können nicht verschenkt werden.
- [ ] Geschenke erscheinen spätestens beim nächsten Abgleich nach etwa 60 Sekunden. Offline werden sie bis zur Rückkehr aufbewahrt.
- [ ] Online-Benachrichtigungen erscheinen nur im geöffneten Spiel und nur mit eigenem Rathaus.

## Sparsame Kommunikation und Zeit

- [ ] Es gibt keine dauerhaft offenen Sockets oder MongoDB Change Streams.
- [ ] Ziehen und Animationen erzeugen keine Netzwerkanfragen; abgeschlossene Aktionen werden gespeichert.
- [ ] Ein kleines Lebenszeichen erneuert den Onlinestatus ungefähr einmal pro Minute, ohne die Welt zu laden.
- [ ] Ein regelmäßiger vollständiger Hintergrundabgleich läuft nur bei weiteren Online-Spielern. Bereits angekündigte Geschenke werden auch nach dem Ausloggen des Absenders abgeholt.
- [ ] Eigene Arbeiten und Kämpfe werden unabhängig von anderen Spielern zum nächsten Ereignis aufgelöst.
- [ ] Im geschlossenen Spiel entstehen keine Browseranfragen. Beim Sichtbarwerden wird einmal abgeglichen.
- [ ] Ein zweiter geschlossener Tab pausiert keine noch aktive Sitzung. Ohne aktive Sitzung pausiert die Spielzeit; Erdbeerwachstum verwendet weiterhin Echtzeit.

## Pakete, Stapel und Wirtschaft

- [ ] Basicpakete kosten drei Gold und enthalten drei zufällige Karten: Baum, Fels, Beerenbusch sowie sehr selten Ratte oder fruchtbarer Boden.
- [ ] Gold-Teilzahlungen senken den offenen Preis. Nach vollständiger Zahlung erscheint ein Paket und der Preis beginnt von vorn.
- [ ] Ein ausreichend gefülltes Sparschwein bezahlt den offenen Paketpreis ohne überschüssiges Gold zu verlieren.
- [ ] Ein Klick auf ein gekauftes Paket lässt genau eine Karte erscheinen; der Restinhalt bleibt gespeichert.
- [ ] Die gegriffene Karte nimmt alle darüberliegenden Karten mit. Am sichtbaren Namen kann der Stapel geteilt werden.
- [ ] Karten lassen sich verkaufen. Menschen, Leichen, Gegner und Gold sind ausgenommen.
- [ ] Fünf Gold, zwei Holz und ein Mensch ergeben nach einer Minute ein Sparschwein. Gold hineinziehen; ein Klick entnimmt eine Goldkarte.

## Arbeit, Herstellung und Kampf

- [ ] Ein Mensch arbeitet mehrere Quellen im Stapel nacheinander ab; verbrauchte Quellen verschwinden.
- [ ] Baum liefert Holz oder Stock; Fels liefert Stein oder Feuerstein; Beerenbusch liefert Beeren.
- [ ] Fünf Holz und fünf Stein ergeben ein Lager; fünf Holz und ein Stein eine Axt; fünf Holz und zwei Stein eine Spitzhacke, jeweils mit Mensch.
- [ ] Axt und Spitzhacke beschleunigen die passende Arbeit. Stock, Feuerstein und Mensch ergeben ein Messer mit zusätzlichem Kampfschaden.
- [ ] Drei Stock und ein Feuerstein ergeben Feuer; Feuer und Fleisch ergeben gebratenes Fleisch.
- [ ] Menschen können gemeinsam kämpfen. Mehrere Ratten können ein gegnerisches Team bilden; ein roter Rahmen zeigt den Kampf.
- [ ] Ratten bewegen sich zum Menschen, brauchen regulär zwei Treffer und verursachen einen Schaden pro Angriff.
- [ ] Menschen starten mit 75 Leben. Nahrung im Stapel wird bis zum vollen Leben gegessen; Beeren heilen je ein Leben. Bei null Leben bleibt eine Leiche.
- [ ] Mensch und Huhn lösen einen Kampf aus; Tod kann Knochen, Ei oder Fleisch liefern. Beute ist im Editor einstellbar.
- [ ] Fruchtbarer Boden und Beere wachsen nach einer Echtzeitstunde zum Erdbeerfeld. Eine Tagesernte enthält zehn Beeren und sammelt sich unangeerntet nicht über mehrere Tage an.

## Editor und Veröffentlichung

- [ ] Karten, Kombinationen, Pakete, Kreaturenverhalten und Beute lassen sich bearbeiten; vorhandene Bilder sind auswählbar.
- [ ] Der Baum zeigt Paket → mögliche Karte → Kombination → Ergebnis sowie die Fortschrittsstufen.
- [ ] JSON-Export enthält den aktuellen Inhaltskatalog. Offline-Welten und ausstehende Geschenke verhindern ungültige Inhaltslöschungen.
- [ ] Frontend, Backend und Shared bleiben drei unabhängige Git-Repositories; beide Apps verwenden dieselbe feste Shared-Version.
- [ ] Vercel benötigt im Frontend `BACKEND_URL`, im Backend `MONGODB_URI` und `APP_ORIGIN`. Es gibt keinen zusätzlichen Shared- oder Redis-Server.
- [ ] PC-Bedienung ist abgenommen; Handy im Querformat wird ergänzend geprüft.

## Prüfungen

Im Shared- und Backend-Repository jeweils `npm test`, im Backend zusätzlich `npm run check`. Im Frontend `npm test`, `npm run build` und mit installiertem Backend-Checkout optional `npm run test:integration`. Prüfstand 31.10.2026: 171 Shared-Tests, 27 API-Tests, 21 Frontend-Tests und ein Anwendungstest bestanden; Produktionsbuild erfolgreich. Zusätzlich wurden konkurrierende Anmeldungen, Geschenkversand, Abholung und Neustart gegen zwei tatsächliche Atlas-Adapter geprüft; die eigene Testdatenbank wurde wieder gelöscht. Maßgeblich ist die aktuelle Testausgabe.

Für später: Totem zur Wiederbelebung und Kartenlimit mit Lagerfunktion.
