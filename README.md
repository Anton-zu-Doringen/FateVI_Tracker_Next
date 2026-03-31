# FateVI Tracker Next

Neues, getrenntes Repo für eine serverzentrierte FateVI-Tracker-Architektur.

Ziel:
- `rules`: reine Spielmechanik ohne UI oder Netzwerk
- `server`: autoritativer Kampfzustand und Rollenmodell
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

## Software-Abhängigkeiten

Für Entwicklung und Betrieb werden lokal folgende Programme benötigt:

- `node` in einer aktuellen Version, weil Server und Client-Tooling auf Node laufen
- `npm`, um die Workspace-Abhängigkeiten zu installieren und die Skripte auszuführen
- `typescript`, lokal über `npm install` im Repo; wird über `npm run build` und `npm run check` genutzt

Zusätzlich für den Bibliotheks-Import/-Export:

- `zip` zum Exportieren des SL-Bibliotheksordners
- `unzip` zum Importieren einer exportierten Bibliotheks-ZIP

Installation der Node-Abhängigkeiten:

```bash
cd /var/home/lain/Dokumente/GitHub/FateVI_Tracker_Next
npm install
```

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
