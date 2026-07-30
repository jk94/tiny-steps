# Phase 4: Offline-First & PWA

**Bezug im PRD:** Abschnitt 4.1 (Plattform – PWA), 5.4 (Offline-First-Konzept)

## Ziel

Einträge können auch ohne Internetverbindung erfasst werden und synchronisieren sich automatisch bei Wiederverbindung. Die App ist als PWA installierbar.

## Voraussetzungen

Phase 3 abgeschlossen (Echtzeit-Sync-Mechanismus steht, darauf baut die Offline-Sync-Logik auf).

## Aufgaben

### Lokale Datenhaltung
- [ ] IndexedDB-Layer im Frontend für lokale Zwischenspeicherung neuer/geänderter Einträge
- [ ] Optimistisches UI-Update: neue Einträge werden sofort angezeigt, bevor der Server bestätigt hat

### Synchronisation
- [ ] Sync-Queue: bei fehlender Verbindung gesammelte Änderungen bei Reconnect an den Server senden
- [ ] Konfliktbehandlung nach Last-Write-Wins-Prinzip, basierend auf dem Zeitstempel des Ereignisses
- [ ] Fehlerbehandlung bei fehlgeschlagenem Sync (z. B. Retry-Mechanismus)

### PWA
- [ ] Web App Manifest (Icon, Name, Theme-Farbe, Start-URL)
- [ ] Service Worker für Offline-Grundfunktion (App-Shell-Caching)
- [ ] Installierbarkeit testen (Android/iOS/Desktop-Browser)

### Tests
- [ ] Test: Eingabe ohne Netzwerkverbindung möglich, Daten gehen nicht verloren
- [ ] Test: Nach Reconnect werden alle offline erfassten Einträge korrekt synchronisiert
- [ ] Test: Konfliktfall (gleiches Event von zwei Geräten offline geändert) wird nach Last-Write-Wins aufgelöst

## Definition of Done

- App ist als PWA installierbar (Homescreen-Icon, eigenständiges Fenster)
- Neue Einträge können offline erfasst werden und erscheinen nach Reconnect bei allen Haushaltsmitgliedern
- Keine Datenverluste bei Verbindungsabbrüchen im Testszenario
