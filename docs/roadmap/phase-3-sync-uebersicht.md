# Phase 3: Echtzeit-Sync & Übersicht

**Bezug im PRD:** Abschnitt 4.1 (Übersicht & Auswertung, Multiuser-Echtzeitsicht), 5.2 (Echtzeit-Sync), 5.3 (WebSockets als Architekturbegründung)

## Ziel

Mehrere Nutzer desselben Haushalts sehen neue Einträge in Echtzeit, haben eine Tages-Timeline und einfache Auswertungen zur Verfügung.

## Voraussetzungen

Phase 2 abgeschlossen (Event-Typen sind erfassbar).

## Aufgaben

### Echtzeit-Sync (Backend)
- [x] WebSocket-Gateway einrichten (`@nestjs/websockets`) — Socket.IO (`@nestjs/platform-socket.io`) statt raw `ws`, wegen der eingebauten Räume-/Broadcast-Unterstützung; Entscheidung samt Alternativen siehe [ADR-0007](../adr/0007-websocket-realtime-sync.md)
- [x] Haushalts-Räume/Channels: Nutzer werden beim Verbindungsaufbau ihrem/n Haushalt/en zugeordnet — umgesetzt abweichend von dieser Formulierung: Räume werden nicht pauschal beim Verbindungsaufbau, sondern pro aktiver Route beigetreten (`joinHousehold`/`leaveHousehold`), da es keinen globalen „aktueller Haushalt"-State im Frontend gibt; Begründung siehe ADR-0007
- [x] Event-Erstellung/-Änderung/-Löschung löst Broadcast an alle verbundenen Haushaltsmitglieder aus — schlankes Payload (nur IDs, kein voller Event-Body); Client invalidiert die passenden React-Query-Keys statt aus dem Payload zu hydratisieren; siehe ADR-0007
- [x] Reconnect-Handling (Client verpasst keine Updates bei kurzzeitigem Verbindungsabbruch) — kein serverseitiges Replay-/Outbox-Log; Frontend invalidiert React-Query-Keys bei jedem `connect`-Event (Erst- wie Re-Connect), Socket.IO übernimmt die eigentliche Reconnect-/Backoff-Mechanik; siehe ADR-0007

### Echtzeit-Sync (Frontend)
- [x] WebSocket-Client-Integration — `RealtimeProvider`/`useRealtimeConnection` (`apps/frontend/src/realtime/`), analog zum bestehenden `AuthProvider`-Muster; siehe ADR-0007
- [x] Live-Update des lokalen State bei eingehenden Events ohne manuellen Reload — React-Query-Invalidierung pro Event-Typ
- [x] Verbindungsstatus-Anzeige (verbunden/getrennt) — Indikator in `Layout.tsx`

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
- [x] E2E-Test: Zwei Nutzer im selben Haushalt sehen einen neuen Eintrag ohne manuellen Reload (Erfolgskriterium PRD Abschnitt 6)

## Definition of Done

- Ein neu erfasster Eintrag erscheint bei allen anderen Haushaltsmitgliedern in Echtzeit ohne Reload
- Tages-Timeline zeigt alle Ereignisse korrekt sortiert inkl. erfassendem Nutzer
- Statistik-Kennzahlen sind korrekt und aktualisieren sich live
