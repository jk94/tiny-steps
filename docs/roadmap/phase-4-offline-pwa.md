# Phase 4: Offline-First & PWA

**Bezug im PRD:** Abschnitt 4.1 (Plattform – PWA), 5.4 (Offline-First-Konzept)

## Ziel

Einträge können auch ohne Internetverbindung erfasst werden und synchronisieren sich automatisch bei Wiederverbindung. Die App ist als PWA installierbar.

## Voraussetzungen

Phase 3 abgeschlossen (Echtzeit-Sync-Mechanismus steht, darauf baut die Offline-Sync-Logik auf).

## Aufgaben

### Lokale Datenhaltung
- [x] IndexedDB-Layer im Frontend für lokale Zwischenspeicherung neuer/geänderter Einträge — generischer `pendingEvents`-Store (`apps/frontend/src/offline/pendingEvents.db.ts`) via `idb`, geteilt über alle drei Event-Typen
- [x] Optimistisches UI-Update: neue Einträge werden sofort angezeigt, bevor der Server bestätigt hat — Create-Flows (QuickEntry + Backfill) schreiben write-through in IndexedDB und mergen ungespeicherte Einträge in Listen/Timeline (`createEventOptimistically`/`usePendingLocalEvents`/`mergeServerAndPendingEvents`); Edits/Timer-Stopps sind mit dem LWW-Slice nachgezogen (`updateEventOptimistically`, siehe [ADR-0011](../adr/0011-offline-edit-stop-and-last-write-wins.md))

### Synchronisation
- [x] Sync-Queue: bei fehlender Verbindung gesammelte Änderungen bei Reconnect an den Server senden — `drainPendingEventQueue` (`apps/frontend/src/offline/syncQueue.ts`) sendet gepufferte Creates beim Reconnect erneut, getriggert über `SyncQueueProvider` (`online`-Event + Socket.IO-`isConnected`); der exakte Request wird als `createInput` auf dem `pendingEvents`-Record persistiert
- [x] Konfliktbehandlung nach Last-Write-Wins-Prinzip, basierend auf dem Zeitstempel des Ereignisses — Edit (PATCH) und Timer-Stopp sind jetzt (wie Create) offline-fähig (`updateEventOptimistically`/`stop*TimerOptimistic`, Overlay statt Extra-Zeile im Merge); LWW vergleicht einen beim Absenden erfassten `clientTimestamp` gegen die neue `Event.updatedAt`-Spalte (nicht das frei editierbare `occurredAt`), ein verlorener Konflikt wird per app-root `ConflictNoticeBanner` gemeldet — siehe [ADR-0011](../adr/0011-offline-edit-stop-and-last-write-wins.md)
- [x] Fehlerbehandlung bei fehlgeschlagenem Sync (z. B. Retry-Mechanismus) — exponentielles Backoff mit Deckel (max. 6 Versuche) in `syncQueue.ts`; retrybar nur bei Netzwerk-/5xx-Fehlern (4xx wird nicht wiederholt), eine Einzel-Fehlschlag reschedult sich autonom per Timer, Zustand persistiert via `retryCount`/`nextRetryAt` (`pendingEvents.db.ts`)

### PWA
- [x] Web App Manifest (Icon, Name, Theme-Farbe, Start-URL) — via `vite-plugin-pwa`, siehe [ADR-0008](../adr/0008-pwa-basics-via-vite-plugin-pwa.md)
- [x] Service Worker für Offline-Grundfunktion (App-Shell-Caching) — `generateSW`-Strategie, API/Socket.IO-Pfade bewusst vom Caching ausgeschlossen (network-only), siehe ADR-0008
- [ ] Installierbarkeit testen (Android/iOS/Desktop-Browser) — automatisierte Build-/Manifest-/Service-Worker-Prüfungen (`manifest.webmanifest`/`sw.js`/Icons werden korrekt gebaut und ausgeliefert) sind erledigt, der echte manuelle Installations-Check auf Android/iOS/Desktop-Browsern steht aber noch aus

### Tests
- [x] Test: Eingabe ohne Netzwerkverbindung möglich, Daten gehen nicht verloren — `offlineNoDataLoss.integration.spec.ts`: erfasst offline (nur `apiFetch` gemockt, echtes fake-indexeddb) alle drei Domains und alle Operationstypen (Feeding-Create, Diaper-Create, Sleep-Create, Feeding-Update, Feeding-Timer-Stop), prüft die fünf gepufferten Records direkt gegen IndexedDB und beweist mit einem simulierten Reload (nur `vi.resetModules()`, gleiche `IDBFactory`) die Persistenz über den echten IndexedDB-Speicher statt über In-Memory-Modulzustand
- [x] Test: Nach Reconnect werden alle offline erfassten Einträge korrekt synchronisiert — `reconnectFullSync.integration.spec.ts`: seedet fünf gepufferte Records über alle drei Domains und Operationstypen (Feeding-/Sleep-Create, Feeding-Update, Sleep-Stop, Diaper-Create) und `drainPendingEventQueue()` synchronisiert jeden über seine jeweilige Create-/Update-/Stop-Funktion; der Diaper-Create scheitert zunächst mit 503 und läuft über den echten selbst-eingeplanten Retry-Timer der Sync-Queue durch, bis nichts mehr gepuffert ist
- [x] Test: Konfliktfall (gleiches Event von zwei Geräten offline geändert) wird nach Last-Write-Wins aufgelöst — Backend: `feeding.service.spec.ts`/`sleep.service.spec.ts`/`diaper.service.spec.ts` (älterer `clientTimestamp` → `EventConflictException`, Schreibvorgang übersprungen; neuerer → angewendet) und `event-updated-at.integration.spec.ts` (echtes SQLite, `updatedAt`-Verhalten). Frontend: `updateEventOptimistically.spec.ts`, `syncQueue.spec.ts` (Konflikt beim Drain ohne Retry aufgelöst) und `updateOptimistic.integration.spec.ts` (Offline-Edit → Konflikt → Auflösung End-to-End)

## Definition of Done

- App ist als PWA installierbar (Homescreen-Icon, eigenständiges Fenster)
- Neue Einträge können offline erfasst werden und erscheinen nach Reconnect bei allen Haushaltsmitgliedern
- Keine Datenverluste bei Verbindungsabbrüchen im Testszenario
