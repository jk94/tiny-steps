# Phase 3: Echtzeit-Sync & Übersicht

**Bezug im PRD:** Abschnitt 4.1 (Übersicht & Auswertung, Multiuser-Echtzeitsicht), 5.2 (Echtzeit-Sync), 5.3 (WebSockets als Architekturbegründung)

## Ziel

Mehrere Nutzer desselben Haushalts sehen neue Einträge in Echtzeit, haben eine Tages-Timeline und einfache Auswertungen zur Verfügung.

## Voraussetzungen

Phase 2 abgeschlossen (Event-Typen sind erfassbar).

## Aufgaben

### Echtzeit-Sync (Backend)
- [ ] WebSocket-Gateway einrichten (`@nestjs/websockets`)
- [ ] Haushalts-Räume/Channels: Nutzer werden beim Verbindungsaufbau ihrem/n Haushalt/en zugeordnet
- [ ] Event-Erstellung/-Änderung/-Löschung löst Broadcast an alle verbundenen Haushaltsmitglieder aus
- [ ] Reconnect-Handling (Client verpasst keine Updates bei kurzzeitigem Verbindungsabbruch)

### Echtzeit-Sync (Frontend)
- [ ] WebSocket-Client-Integration
- [ ] Live-Update des lokalen State bei eingehenden Events ohne manuellen Reload
- [ ] Verbindungsstatus-Anzeige (verbunden/getrennt)

### Tages-Timeline
- [ ] Chronologische Ansicht aller Ereignisse eines Tages für ein Kind
- [ ] Filterbarkeit nach Event-Typ (optional für MVP, falls Kapazität vorhanden)
- [ ] Anzeige, welcher Nutzer den Eintrag erfasst hat

### Statistiken
- [ ] Berechnung: Schlafstunden pro Tag
- [ ] Berechnung: Anzahl Fütterungen pro Tag
- [ ] Berechnung: Zeit seit letztem Ereignis (je Event-Typ)
- [ ] UI-Komponente „Letzte Fütterung vor X Stunden“ (bzw. analog für Schlaf/Windel)

### Tests
- [ ] E2E-Test: Zwei Nutzer im selben Haushalt sehen einen neuen Eintrag ohne manuellen Reload (Erfolgskriterium PRD Abschnitt 6)

## Definition of Done

- Ein neu erfasster Eintrag erscheint bei allen anderen Haushaltsmitgliedern in Echtzeit ohne Reload
- Tages-Timeline zeigt alle Ereignisse korrekt sortiert inkl. erfassendem Nutzer
- Statistik-Kennzahlen sind korrekt und aktualisieren sich live
