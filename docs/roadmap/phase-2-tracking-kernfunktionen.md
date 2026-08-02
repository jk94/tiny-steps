# Phase 2: Tracking-Kernfunktionen

**Bezug im PRD:** Abschnitt 4.1 (Tracking-Grundfunktionen), 5.2 (Event-Datenmodell)

## Ziel

Die drei zentralen Ereignistypen (Stillen/Füttern, Schlaf, Windeln) können schnell erfasst werden, inklusive Timer-Funktionen und Schnelleingabe.

## Voraussetzungen

Phase 1 abgeschlossen (Nutzer, Haushalt, Kind-Profile, Rechteprüfung stehen).

## Aufgaben

### Datenmodell
- [x] `Event`-Entity ausdifferenzieren: gemeinsamer Basistyp + Event-Typ-spezifische Felder (Feeding, Sleep, Diaper) — Basis-`Event` + 1:1-Detailtabelle-pro-Typ etabliert, aber nur wo ein Typ tatsächlich Felder über `Event` hinaus braucht (`FeedingDetail` implementiert; Sleep kommt ganz ohne Detailtabelle aus, siehe ADR-0006-Addendum; `DiaperDetail` ist jetzt ebenfalls implementiert, nach demselben Muster — `diaperType` + optionale Notiz, `Event` selbst brauchte dafür keine weitere Schema-Änderung, siehe ADR-0006-Diaper-Addendum)
- [x] `Event` referenziert immer `Child` und den erfassenden `User` (Nachvollziehbarkeit)
- [x] Zeitstempel-Konzept: Start-/Endzeit für Timer-basierte Events, Einzelzeitpunkt für Sofort-Events — `startedAt`/`endedAt` auf `Event` (hoisted für zukünftige Timer-Typen wie Sleep), `occurredAt` bleibt der einheitliche Sortier-Zeitstempel

### Backend: Feeding
- [x] Stillen: Start/Stopp-Timer, Seite (links/rechts), Dauer-Berechnung
- [x] Fläschchen: Menge in ml
- [x] Beikost: freie Notiz/Menge
- [x] CRUD-Endpunkte für Feeding-Events

### Backend: Sleep
- [x] Start/Stopp-Timer für Schlaf
- [x] Manuelle Nachtragung (rückwirkende Erfassung mit Start-/Endzeit)
- [x] CRUD-Endpunkte für Sleep-Events

### Backend: Diaper
- [x] Typ: Pipi / Stuhlgang / beides — `DiaperType`-Enum (`PEE`/`STOOL`/`BOTH`), persistiert als `String` auf `DiaperDetail.diaperType` (kein Prisma-`enum`, gleiche SQLite-Begründung wie bei Feeding/Sleep, siehe ADR-0002)
- [x] Optionale Konsistenz-Notiz — `DiaperDetail.note`, unbedingt (nicht typ-gated) optional für alle drei `diaperType`-Werte, anders als Feedings typ-gatete `side`/`amountMl`; deshalb bleibt `diaperType` im Unterschied zu Feedings `feedingType` auch über PATCH änderbar (siehe ADR-0006-Diaper-Addendum)
- [x] CRUD-Endpunkte für Diaper-Events — kein Timer-Konzept (Windel ist immer ein Zeitpunkt-Event, `startedAt`/`endedAt` bleiben immer `null`), daher keine `active-timer`-/`stop`-Routen und kein 409-Konfliktfall wie bei Feeding/Sleep

### Frontend: Schnelleingabe
- [x] Startbildschirm mit Ein-Tap-Buttons für die häufigsten Ereignisse — für Feeding erledigt (`FeedingQuickEntry`/`FeedingHome`), für Sleep erledigt (`SleepQuickEntry`/`SleepHome`, ein einzelner Start-Button statt mehrerer Varianten) und für Diaper erledigt (`DiaperQuickEntry`/`DiaperHome`, drei immer sichtbare Ein-Tap-Buttons Pipi/Stuhlgang/Beides, kein Reveal-Schritt)
- [x] Timer-UI für Stillen (mit Seitenwahl) und Schlaf (Start/Stopp, laufende Anzeige) — Stillen-Timer erledigt (`FeedingTimer`, inkl. Persistenz über den `active-timer`-Endpunkt bei App-Neustart); Schlaf-Timer erledigt (`SleepTimer`, gleiches Persistenz-Muster, ohne Seitenwahl); Windel braucht bewusst keine Timer-UI, da immer ein Zeitpunkt-Event (siehe Backend-Abschnitt oben)
- [x] Windel-Erfassungs-UI (Typ-Auswahl + optionale Notiz) — `DiaperQuickEntry` (Schnelleingabe ohne Notiz, analog zu Feedings Beikost-Schnelleingabe) und `DiaperEventForm` (Typ-Auswahl + Notiz, im Unterschied zu `FeedingEventForm` bleibt die Typ-Auswahl auch im Edit-Modus aktiv, siehe ADR-0006-Diaper-Addendum)
- [x] Formular für manuelle Nachtragung (alle Event-Typen, mit Zeitpunkt-Auswahl) — für Feeding erledigt (`FeedingEventForm`/`FeedingBackfillCreate`), für Sleep erledigt (`SleepEventForm`/`SleepBackfillCreate`, ohne Typ-/Seiten-/Mengen-/Notizfelder) und für Diaper erledigt (`DiaperEventForm`/`DiaperBackfillCreate`, drei Felder: Typ, Zeitpunkt, Notiz)
- [x] Bearbeiten/Löschen bestehender Einträge — für Feeding erledigt (`FeedingEventEdit`), für Sleep erledigt (`SleepEventEdit`) und für Diaper erledigt (`DiaperEventEdit`, inkl. änderbarer Typ-Auswahl)

### UX-Validierung
- [ ] Messung/Review: Eingabe eines Standard-Ereignisses in unter 3 Sekunden bzw. 2 Taps möglich (Erfolgskriterium PRD Abschnitt 6) — für Feeding sind die Tap-Zahlen durch Komponententests mechanisch abgesichert (`FeedingQuickEntry.spec.tsx`: 1 Tap für Stillen/Beikost, 2 Taps für Fläschchen), für Diaper ebenso (`DiaperQuickEntry.spec.tsx`: 1 Tap für jeden der drei Typen Pipi/Stuhlgang/Beides), das ist aber kein Ersatz für einen echten manuellen 3-Sekunden-UX-Review — bewusst nicht als automatisierter Timing-Test nachgebaut (jsdom-Timing ist für gefühlte Latenz nicht aussagekräftig)

## Definition of Done

- Alle drei MVP-Ereignistypen können erfasst, bearbeitet und gelöscht werden — Feeding, Sleep und Diaper sind erledigt
- Timer-Funktionen für Stillen und Schlaf funktionieren zuverlässig (inkl. Persistenz bei App-Neustart während laufendem Timer) — für Stillen und Schlaf erledigt (Timer-Zustand lebt serverseitig jeweils als `Event` mit `endedAt: null`, ein Reload lädt ihn einfach neu); Windel hat bewusst kein Timer-Konzept, siehe oben
- Schnelleingabe erfüllt das 3-Sekunden/2-Taps-Kriterium — für Feeding, Sleep und Diaper durch Tap-Zahl-Tests plausibilisiert, echter manueller Review offen
- Jeder Eintrag ist eindeutig einem `Child` und dem erfassenden `User` zugeordnet
