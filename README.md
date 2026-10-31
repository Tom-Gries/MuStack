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

Das Spiel verwendet kurze HTTP-Aufrufe. Dragbewegungen und Animationen laufen lokal. Ein kleines Lebenszeichen erkennt andere Spieler; nur bei weiterer Online-Anwesenheit läuft ein regelmäßiger vollständiger Hintergrundabgleich. Eigene Arbeits-/Kampftermine sowie angekündigte Geschenke werden unabhängig davon verarbeitet. Ohne geöffnetes Spiel entstehen keine Browseranfragen. Online-Hinweise erscheinen ausschließlich bei geöffnetem Spiel mit eigenem Rathaus.

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
