# Architektur

## 1. Regelmodul

Das Regelmodul ist vollständig transportfrei:
- keine DOM-Zugriffe
- kein `localStorage`
- kein Bluetooth
- keine Netzwerkannahmen

Es verarbeitet nur:
- `CombatState`
- `Command`
- `RuleEvent`

Ein Command erzeugt:
- einen neuen Zustand
- optionale Domänenereignisse
- optionale Input-Anforderungen, z. B. benötigte Würfe

## 2. Server

Der Server ist die autoritative Instanz.

Aufgaben:
- Sessions und Login
- Rollen und Charakterzuweisung
- Command-Autorisierung
- Anwendung des Regelmoduls
- Pixels-/Bluetooth-Adapter
- Projektion des Zustands auf GM- oder Player-Sicht

## 3. Client

Der Client sendet Commands und rendert projektionierten Zustand.

Varianten:
- GM-Ansicht: voller Zustand
- Player-Ansicht: Turn Order aller, Detailansicht nur des eigenen Charakters

## Autorisierung

Serverseitig:
- `gm`: alle Commands
- `player`: nur Commands für zugewiesenen Charakter

Der Client blendet zusätzlich UI aus, ist aber nicht sicherheitsrelevant.

## Migrationsprinzip

1. Reine Regelmechanik aus der Alt-App extrahieren
2. Würfe und Inputs als explizite `PendingInput`-Anforderungen modellieren
3. Bluetooth/Pixels als Server-Adapter anbinden
4. Alte UI durch GM- und Player-Client ersetzen
