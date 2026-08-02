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
- [x] Chronologische Ansicht aller Ereignisse eines Tages für ein Kind — neues `EventModule` (`apps/backend/src/event/`, `GET .../events/daily`) merged Feeding/Sleep/Diaper serverseitig sortiert nach `occurredAt`; Frontend-Seite `DailyTimeline` (`apps/frontend/src/pages/DailyTimeline.tsx`) mit `TimelineEventList`
- [x] Filterbarkeit nach Event-Typ — umgesetzt (war für MVP optional), rein clientseitig via `TimelineFilter`, kein Backend-Parameter/Query-Key-Einfluss
- [x] Anzeige, welcher Nutzer den Eintrag erfasst hat — `TimelineEventList` löst `userId` gegen die neue `GET /households/:householdId/members`-Route auf (E-Mail-Adresse, da `User` kein Anzeigename-Feld hat); Fallback auf die rohe `userId`, falls der Nutzer nicht in der Mitgliederliste auftaucht

### Statistiken
- [x] Berechnung: Schlafstunden pro Tag — `EventService.getStatsSummary` (`GET .../events/stats`), summiert nur abgeschlossene Schlaf-Sessions (`endedAt !== null`) im angefragten Tag, gerundet auf eine Nachkommastelle
- [x] Berechnung: Anzahl Fütterungen pro Tag — `feedingCountToday` im selben Endpunkt
- [x] Berechnung: Zeit seit letztem Ereignis (je Event-Typ) — `lastEventAt` je Typ ist bewusst NICHT auf den angefragten Tag beschränkt, sondern „zuletzt jemals" (unabhängige `findFirst`-Abfragen pro Typ), damit die Kennzahl auch dann sinnvoll bleibt, wenn das letzte Ereignis nicht mehr am aktuellen Tag liegt
- [x] UI-Komponente „Letzte Fütterung vor X Stunden“ (bzw. analog für Schlaf/Windel) — `TimeSinceCard` (dreifach in `DailyStatsSummary`), aktualisiert die Anzeige per `useTick`-Intervall (30s) rein über die Wanduhr, ganz ohne neue Serverdaten

### Tests
- [x] E2E-Test: Zwei Nutzer im selben Haushalt sehen einen neuen Eintrag ohne manuellen Reload (Erfolgskriterium PRD Abschnitt 6)

## Definition of Done

- Ein neu erfasster Eintrag erscheint bei allen anderen Haushaltsmitgliedern in Echtzeit ohne Reload
- Tages-Timeline zeigt alle Ereignisse korrekt sortiert inkl. erfassendem Nutzer
- Statistik-Kennzahlen sind korrekt und aktualisieren sich live
