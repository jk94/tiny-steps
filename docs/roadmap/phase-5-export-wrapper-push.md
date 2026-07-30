# Phase 5: Export, Nativer Wrapper & Push-Benachrichtigungen

**Bezug im PRD:** Abschnitt 4.1 (Daten & Benachrichtigungen), 5.3 (nativer Wrapper), Abschnitt 7 (offene Frage Capacitor vs. Tauri)

## Ziel

Nutzer können ihre Rohdaten exportieren und erhalten Push-Erinnerungen über eine native Wrapper-App.

## Voraussetzungen

Phase 4 abgeschlossen (stabile Datenbasis und PWA-Grundlage).

## Aufgaben

### Datenexport
- [ ] Backend-Endpoint für Datenexport (JSON) der Rohdaten eines Haushalts/Kindes
- [ ] Backend-Endpoint für CSV-Export
- [ ] Frontend: Export-UI mit Download-Funktion (Format-Auswahl, Zeitraum-Filter optional)

### Entscheidung nativer Wrapper
- [ ] Offene Frage aus PRD klären: Capacitor vs. Tauri (Kriterien: Push-Notification-Support, Wartungsaufwand, Team-Erfahrung, Bundle-Größe)
- [ ] Entscheidung dokumentieren (z. B. als ADR)

### Nativer Wrapper
- [ ] Gewählten Wrapper um bestehende React-Codebasis aufsetzen
- [ ] Build-Pipeline für Android/iOS (je nach Wrapper-Fähigkeiten) einrichten
- [ ] Sicherstellen, dass Mobile-first-UI ohne Neubau im Wrapper funktioniert

### Push-Benachrichtigungen
- [ ] Plattformspezifische Push-Integration über den nativen Wrapper
- [ ] Backend-seitige Trigger-Logik (z. B. Scheduled Job: „Letzte Fütterung vor X Stunden“ → Erinnerung)
- [ ] Zusammenfassungs-Benachrichtigung (z. B. Tagesüberblick)
- [ ] Nutzerseitige Einstellungen: Push-Benachrichtigungen an/aus, Schwellenwerte konfigurierbar

## Definition of Done

- Export liefert vollständige, korrekte Rohdaten in JSON und CSV
- Native Wrapper-App lässt sich bauen und auf mindestens einer Zielplattform installieren
- Push-Benachrichtigung wird bei überschrittenem Fütterungsintervall zuverlässig ausgelöst
