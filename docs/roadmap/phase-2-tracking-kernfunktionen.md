# Phase 2: Tracking-Kernfunktionen

**Bezug im PRD:** Abschnitt 4.1 (Tracking-Grundfunktionen), 5.2 (Event-Datenmodell)

## Ziel

Die drei zentralen Ereignistypen (Stillen/Füttern, Schlaf, Windeln) können schnell erfasst werden, inklusive Timer-Funktionen und Schnelleingabe.

## Voraussetzungen

Phase 1 abgeschlossen (Nutzer, Haushalt, Kind-Profile, Rechteprüfung stehen).

## Aufgaben

### Datenmodell
- [x] `Event`-Entity ausdifferenzieren: gemeinsamer Basistyp + Event-Typ-spezifische Felder (Feeding, Sleep, Diaper) — Basis-`Event` + 1:1-Detailtabelle-pro-Typ etabliert (`FeedingDetail` implementiert; `SleepDetail`/`DiaperDetail` folgen nach demselben Muster, `Event` selbst braucht dafür keine weitere Schema-Änderung)
- [x] `Event` referenziert immer `Child` und den erfassenden `User` (Nachvollziehbarkeit)
- [x] Zeitstempel-Konzept: Start-/Endzeit für Timer-basierte Events, Einzelzeitpunkt für Sofort-Events — `startedAt`/`endedAt` auf `Event` (hoisted für zukünftige Timer-Typen wie Sleep), `occurredAt` bleibt der einheitliche Sortier-Zeitstempel

### Backend: Feeding
- [x] Stillen: Start/Stopp-Timer, Seite (links/rechts), Dauer-Berechnung
- [x] Fläschchen: Menge in ml
- [x] Beikost: freie Notiz/Menge
- [x] CRUD-Endpunkte für Feeding-Events

### Backend: Sleep
- [ ] Start/Stopp-Timer für Schlaf
- [ ] Manuelle Nachtragung (rückwirkende Erfassung mit Start-/Endzeit)
- [ ] CRUD-Endpunkte für Sleep-Events

### Backend: Diaper
- [ ] Typ: Pipi / Stuhlgang / beides
- [ ] Optionale Konsistenz-Notiz
- [ ] CRUD-Endpunkte für Diaper-Events

### Frontend: Schnelleingabe
- [ ] Startbildschirm mit Ein-Tap-Buttons für die häufigsten Ereignisse — für Feeding erledigt (`FeedingQuickEntry`/`FeedingHome`); Sleep/Windel folgen noch, daher hier nicht abgehakt
- [ ] Timer-UI für Stillen (mit Seitenwahl) und Schlaf (Start/Stopp, laufende Anzeige) — Stillen-Timer erledigt (`FeedingTimer`, inkl. Persistenz über den `active-timer`-Endpunkt bei App-Neustart); Schlaf-Timer folgt noch
- [ ] Windel-Erfassungs-UI (Typ-Auswahl + optionale Notiz) — noch offen
- [ ] Formular für manuelle Nachtragung (alle Event-Typen, mit Zeitpunkt-Auswahl) — für Feeding erledigt (`FeedingEventForm`/`FeedingBackfillCreate`); Sleep/Diaper folgen noch
- [ ] Bearbeiten/Löschen bestehender Einträge — für Feeding erledigt (`FeedingEventEdit`); Sleep/Diaper folgen noch

### UX-Validierung
- [ ] Messung/Review: Eingabe eines Standard-Ereignisses in unter 3 Sekunden bzw. 2 Taps möglich (Erfolgskriterium PRD Abschnitt 6) — für Feeding sind die Tap-Zahlen durch Komponententests mechanisch abgesichert (`FeedingQuickEntry.spec.tsx`: 1 Tap für Stillen/Beikost, 2 Taps für Fläschchen), das ist aber kein Ersatz für einen echten manuellen 3-Sekunden-UX-Review — bewusst nicht als automatisierter Timing-Test nachgebaut (jsdom-Timing ist für gefühlte Latenz nicht aussagekräftig)

## Definition of Done

- Alle drei MVP-Ereignistypen können erfasst, bearbeitet und gelöscht werden — Feeding erledigt, Sleep/Diaper stehen noch aus
- Timer-Funktionen für Stillen und Schlaf funktionieren zuverlässig (inkl. Persistenz bei App-Neustart während laufendem Timer) — für Stillen erledigt (Timer-Zustand lebt serverseitig als `Event` mit `endedAt: null`, ein Reload lädt ihn einfach neu), Schlaf steht noch aus
- Schnelleingabe erfüllt das 3-Sekunden/2-Taps-Kriterium — für Feeding durch Tap-Zahl-Tests plausibilisiert, echter manueller Review offen
- Jeder Eintrag ist eindeutig einem `Child` und dem erfassenden `User` zugeordnet
