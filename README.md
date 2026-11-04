# StackFriends – Spiel

[MuStack](https://github.com/Tom-Gries/MuStack) enthält das Vite-/React-Frontend. Die API liegt in [MuStackAPI](https://github.com/Tom-Gries/MuStackAPI), die gemeinsamen Spielregeln in [MuStackShared](https://github.com/Tom-Gries/MuStackShared). Jedes Repository hat seine eigene Git-Historie.

## Lokal entwickeln

Node.js ab Version 22. Im Frontend-Ordner:

```sh
npm ci
npm run dev
```

Das Spiel läuft auf http://127.0.0.1:5173 und erreicht die API standardmäßig auf Port 3001. Diese im Backend-Ordner mit `npm run dev:local` für eine lokale Dateiwelt oder mit `npm run dev` für die konfigurierte Datenbank starten.

Optional lässt sich die lokale API-Adresse mit `DEV_BACKEND_URL` in `.env.local` ändern. Zugangsdaten gehören ausschließlich ins Backend.

## Prüfen und bauen

```sh
npm test
npm run build
```

Der Build liegt in `dist/`. Installation, Tests und CI funktionieren ohne weitere lokale Checkouts. Der optionale Befehl `npm run test:integration` benötigt einen installierten API-Checkout unter `../backend` oder dem über `API_DIR` angegebenen Ordner. Er startet eine isolierte Testwelt.

Der fachliche Abnahmeplan liegt in [docs/ABNAHME_V1.md](docs/ABNAHME_V1.md). Kartenbilder liegen in `public/card-art/`, Originale und Prompts in `artwork/`.

## Persönliche Welten und Rathaus

Jeder Name besitzt eine eigene Welt mit einer Menschenkarte und neun Goldkarten. Ein bestehender Name öffnet dieselbe Welt; der Zugang wird ausschließlich über Name und Cookie gemerkt.

100 Steine und ein Mensch ergeben nach 60 Sekunden ein Rathaus. Ein Klick auf die Karte öffnet die Namensliste und gespeicherte Materialmengen anderer Spieler. Karten auf einen Namen ziehen, um sie zu verschenken. Geschenke kommen beim nächsten Abgleich nach etwa einer Minute an; offline wartet der Eingang bis zur Rückkehr.

Die gesamte laufende Welt wird im Browser simuliert. Ziehen, Ablegen, Pakete öffnen, Arbeiten, Kämpfe und Tierbewegungen benötigen keine eigene Serveranfrage. Änderungen werden gewöhnlich alle 60 Sekunden als Journalpaket gespeichert; beim Verlassen wird zusätzlich bestmöglich gesichert. Ein unverändertes Spiel erneuert stattdessen nur mit einem kleinen Lebenszeichen die Anwesenheit. Bekannte Geschenke werden gezielt abgeholt. Ohne geöffnetes Spiel entstehen keine laufenden Browseranfragen. Online-Hinweise erscheinen ausschließlich bei geöffnetem Spiel mit eigenem Rathaus.

Beim Wiedereinloggen oder Wiederöffnen werden angefangene Arbeiten nachgeholt: Ein Mensch auf einem Baum baut ihn entsprechend der vergangenen Zeit ab; Quellenwarteschlangen und Werkzeugboni werden berücksichtigt. Kämpfe und Tiere warten während der Abwesenheit. Dafür läuft im geschlossenen Spiel kein Timer und keine Netzwerkanfrage.

Der Browser bewahrt unbestätigte Änderungen als lokale Sicherung auf. Retrys verwenden dieselbe Speicher-ID. Eine verspätete Bestätigung lässt spätere Aktionen erhalten. Vor Geschenken oder globalen Editoränderungen wird das Journal gesichert; Versionsprüfungen verhindern das Überschreiben neuerer Spielstände. Ein Konflikt wird sichtbar gemeldet und die lokale Sicherung bleibt erhalten.

## Bergbaupaket

Das Bergbaupaket kostet 50 Gold und enthält drei zufällige Karten. Pro Ziehung sind Eisenader (33 %), Kohleader (32 %), Lehmtümpel (32 %) oder Fledermaus (3 %) möglich. Eine Goldader gehört nicht zum Paket. Ein Mensch gewinnt aus jeder Quelle fünfmal je ein Eisenerz, eine Kohle oder einen Lehm, normalerweise alle zehn Sekunden. Die Spitzhacke halbiert die Zeit an Eisen- und Kohleadern. Die Fledermaus verfolgt Menschen, hat drei Leben und verursacht alle zwei Sekunden einen Schaden; beim Tod entsteht ein Knochen oder ein Fleisch. Karten, Quellen, Beute und das Paket sind im Editor und im Baum sichtbar und bearbeitbar. Bestehende Welten erhalten die neuen Definitionen beim Laden, ohne ihren Fortschritt oder eigene Einstellungen zu verlieren.

## Kisten

10 Holz ergeben nach 10 Sekunden eine Kiste, ohne Menschen. Per Klick auf die Kistenkarte öffnet sich ihr Inventar. Ressourcen und Nahrung einzeln oder als Stapel auf die Kiste oder in das offene Fenster ziehen. Der Inhalt erscheint nach Kartentyp mit Mengen. Einzelne Karten lassen sich wieder auf das Spielfeld ziehen; die Schaltflächen entnehmen eine Karte oder alle desselben Typs. Der Inhalt wird zusammen mit der Welt gespeichert und in der Materialübersicht mitgezählt. Vor dem Verkaufen oder Verschenken muss die Kiste leer sein.

## Gemeinsame Spielregeln

Beide Apps beziehen `@stackfriends/shared` als öffentliches HTTPS-Archiv aus dem Shared-Repository. Dieselbe vollständige Commit-SHA mit 40 Zeichen legt ihre gemeinsame Regelversion fest; `package.json` und `package-lock.json` werden mitcommittet. Die Lockdatei enthält auch die Integritätsprüfung des Archivs.

Regeln zuerst im Shared-Repository ändern, mit `npm test` prüfen und committen/pushen. Danach in Frontend und API jeweils die neue SHA einsetzen:

```sh
npm install '@stackfriends/shared@https://codeload.github.com/Tom-Gries/MuStackShared/tar.gz/<commit-sha>'
```

Anschließend beide Apps prüfen und die jeweiligen Änderungen committen/pushen. `npm ci` lädt die festgelegte öffentliche Version automatisch. Ein lokaler Shared-Checkout, Kopierschritte und zusätzliche Zugangsdaten werden für Builds nicht benötigt.

## Vercel

Dieses Repository als eigenes Projekt mit Framework **Vite** importieren. Root Directory ist der Repository-Hauptordner, Build-Befehl `npm run build`, Ausgabe `dist/`.

| Pflichtvariable | Wert |
| --- | --- |
| `BACKEND_URL` | Öffentliche HTTPS-Adresse der API, ohne `/api` am Ende. Nur serverseitig setzen. |

Die vollständige API-Konfiguration steht in der [Backend-Anleitung](https://github.com/Tom-Gries/MuStackAPI#konfiguration). Das Shared-Paket ist eine Bibliothek und erhält kein eigenes Vercel-Deployment.
