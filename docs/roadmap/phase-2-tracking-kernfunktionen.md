# Phase 2: Tracking-Kernfunktionen

**Bezug im PRD:** Abschnitt 4.1 (Tracking-Grundfunktionen), 5.2 (Event-Datenmodell)

## Ziel

Die drei zentralen Ereignistypen (Stillen/Füttern, Schlaf, Windeln) können schnell erfasst werden, inklusive Timer-Funktionen und Schnelleingabe.

## Voraussetzungen

Phase 1 abgeschlossen (Nutzer, Haushalt, Kind-Profile, Rechteprüfung stehen).

## Aufgaben

### Datenmodell
- [ ] `Event`-Entity ausdifferenzieren: gemeinsamer Basistyp + Event-Typ-spezifische Felder (Feeding, Sleep, Diaper)
- [ ] `Event` referenziert immer `Child` und den erfassenden `User` (Nachvollziehbarkeit)
- [ ] Zeitstempel-Konzept: Start-/Endzeit für Timer-basierte Events, Einzelzeitpunkt für Sofort-Events

### Backend: Feeding
- [ ] Stillen: Start/Stopp-Timer, Seite (links/rechts), Dauer-Berechnung
- [ ] Fläschchen: Menge in ml
- [ ] Beikost: freie Notiz/Menge
- [ ] CRUD-Endpunkte für Feeding-Events

### Backend: Sleep
- [ ] Start/Stopp-Timer für Schlaf
- [ ] Manuelle Nachtragung (rückwirkende Erfassung mit Start-/Endzeit)
- [ ] CRUD-Endpunkte für Sleep-Events

### Backend: Diaper
- [ ] Typ: Pipi / Stuhlgang / beides
- [ ] Optionale Konsistenz-Notiz
- [ ] CRUD-Endpunkte für Diaper-Events

### Frontend: Schnelleingabe
- [ ] Startbildschirm mit Ein-Tap-Buttons für die häufigsten Ereignisse
- [ ] Timer-UI für Stillen (mit Seitenwahl) und Schlaf (Start/Stopp, laufende Anzeige)
- [ ] Windel-Erfassungs-UI (Typ-Auswahl + optionale Notiz)
- [ ] Formular für manuelle Nachtragung (alle Event-Typen, mit Zeitpunkt-Auswahl)
- [ ] Bearbeiten/Löschen bestehender Einträge

### UX-Validierung
- [ ] Messung/Review: Eingabe eines Standard-Ereignisses in unter 3 Sekunden bzw. 2 Taps möglich (Erfolgskriterium PRD Abschnitt 6)

## Definition of Done

- Alle drei MVP-Ereignistypen können erfasst, bearbeitet und gelöscht werden
- Timer-Funktionen für Stillen und Schlaf funktionieren zuverlässig (inkl. Persistenz bei App-Neustart während laufendem Timer)
- Schnelleingabe erfüllt das 3-Sekunden/2-Taps-Kriterium
- Jeder Eintrag ist eindeutig einem `Child` und dem erfassenden `User` zugeordnet
