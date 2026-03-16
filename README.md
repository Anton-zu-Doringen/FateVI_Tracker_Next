# FateVI Tracker Next

Neues, getrenntes Repo für eine serverzentrierte FateVI-Tracker-Architektur.

Ziel:
- `rules`: reine Spielmechanik ohne UI, Netzwerk oder Bluetooth
- `server`: autoritativer Kampfzustand, Rollenmodell, Pixels-Integration
- `client`: UI für Spielleiter und Spieler

## Struktur

```text
packages/
  rules/
  server/
  client/
docs/
```

## Rollenmodell

- `gm`: voller Zugriff
- `player`: sieht alle INI-Einträge, aber nur den eigenen Charakter vollständig

## Status

Dieses Repo ist ein Startpunkt für die neue Architektur:
- Domänenmodell und Command-System sind angelegt
- Server-seitige Autorisierung und View-Projektionen sind definiert
- Client-seitige Sichten für GM und Spieler sind vorbereitet
- Startbare Minimalversion mit lokaler HTTP-API und Browser-Client ist vorhanden

## Lokal starten

```bash
cd /var/home/lain/Dokumente/GitHub/FateVI_Tracker_Next
npm run build
npm start
```

Dann im Browser:

```text
http://127.0.0.1:8787
```

Demo-Login:
- GM-Passwort: `gm`
- Spieler: `Aria` oder `Borin`

Das bestehende Repo `FateVI_Tracker` bleibt unverändert.

## Live-Updates

Die Minimalversion verwendet Server-Sent Events:
- Endpoint: `/api/events?token=...`
- Broadcast bei jedem erfolgreichen Command
- automatische Wiederverbindung durch den Browser

## Persistenz

- Serverzustand und Sessions werden in `packages/server/data/runtime.json` gespeichert
- der Browser speichert das Session-Token in `localStorage`
- nach Server-Neustart kann der Client die Sitzung automatisch wieder aufnehmen

## Bluetooth

Der Server enthält jetzt eine erste BlueZ-Integration über `bluetoothctl`:
- Geräte auflisten: `GET /api/bluetooth/devices`
- Scan starten: `POST /api/bluetooth/scan`
- Verbinden: `POST /api/bluetooth/connect`
- Trennen: `POST /api/bluetooth/disconnect`

Diese Verwaltung ist im Browser-Client nur für den Spielleiter sichtbar.
