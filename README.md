# StackFriends – Spiel

Eigenständiges Vite-/React-Frontend für https://github.com/Tom-Gries/MuStackAPI.

## Lokal

Node.js ab Version 22. Im Repository-Hauptordner:

```sh
npm ci
npm run dev
```

Die API läuft standardmäßig auf http://127.0.0.1:3001. Eine andere lokale API lässt sich mit DEV_BACKEND_URL in .env.local wählen.

## Vercel

- Dieses Repository als eigenes Projekt importieren. Root Directory leer lassen (Repository-Hauptordner), Framework Vite.
- Build: npm run build. Ausgabe: dist. Die vercel.json ist vorbereitet.
- Server-Umgebungsvariable BACKEND_URL auf die öffentliche HTTPS-Adresse der API setzen, ohne /api am Ende.
- Im API-Projekt APP_ORIGIN auf die genaue veröffentlichte Spieladresse setzen.
- MongoDB-/Redis-Zugangsdaten gehören ausschließlich ins API-Projekt.

HTTP-Anfragen laufen über einen Proxy auf derselben Spieladresse; WebSockets verwenden kurzlebige Einmal-Tickets für die direkte API-Verbindung.

## Prüfen

```sh
npm test
npm run build
```

shared/ enthält eine mitgelieferte Kopie der gemeinsamen Spielregeln als lokales npm-Workspace-Paket. Es ist keine Paketveröffentlichung und kein Checkout des API-Repositories erforderlich. Kartenbilder liegen unter public/card-art/, Originale und Erzeugungsprompts unter artwork/.

Vollstände und Änderungen sind durch Weltrevisionen geordnet. Verspätete ältere Vollstände können einen neueren Spielstand nicht überschreiben. Native WebSocket-Ping/Pong-Nachrichten halten die Verbindung aktiv; ein zweiter JSON-Heartbeat entfällt.

## Verbindungszeit sparen

Hintergrund-Tabs trennen sich nach 30 Sekunden; ein serverseitiger Termin sichert dies auch bei gedrosselten Browser-Timern ab. Beim Zurückwechseln verbindet sich das Spiel automatisch und gleicht den Weltstand ab. Offline-Tabs warten auf die Rückkehr des Internets. Sind alle Spieler offline, pausiert die Welt; die bestehenden Echtzeitregeln des Erdbeerfelds bleiben erhalten.

Die API sendet Cloud-Verbindungen nach 280 Sekunden ein privates, 30 Sekunden gültiges Einmalticket. Reguläre Wiederverbindungen können damit den zusätzlichen HTTP-Ticketabruf überspringen. Fehler verwenden weiterhin den HTTP-Fallback. Für zwei Spieler ergibt das rechnerisch etwa 24 statt 72 reguläre Function-Aufrufe pro Stunde, plus Seitenstarts und ungeplante Wiederverbindungen. Aktive WebSockets belegen weiterhin Vercel-RAM; eine Cloudmessung steht aus.
