# Phase 5: Export, Nativer Wrapper & Push-Benachrichtigungen

**Bezug im PRD:** Abschnitt 4.1 (Daten & Benachrichtigungen), 5.3 (nativer Wrapper), Abschnitt 7 (offene Frage Capacitor vs. Tauri)

## Ziel

Nutzer können ihre Rohdaten exportieren und erhalten Push-Erinnerungen über eine native Wrapper-App.

## Voraussetzungen

Phase 4 abgeschlossen (stabile Datenbasis und PWA-Grundlage).

## Aufgaben

### Datenexport
- [x] Backend-Endpoint für Datenexport (JSON) der Rohdaten eines Haushalts/Kindes
- [x] Backend-Endpoint für CSV-Export
- [x] Frontend: Export-UI mit Download-Funktion (Format-Auswahl, Zeitraum-Filter optional)

### Entscheidung nativer Wrapper
- [x] Offene Frage aus PRD klären: Capacitor vs. Tauri (Kriterien: Push-Notification-Support, Wartungsaufwand, Team-Erfahrung, Bundle-Größe) — Capacitor gewählt, siehe [ADR-0012](../adr/0012-capacitor-native-wrapper.md)
- [x] Entscheidung dokumentieren (z. B. als ADR) — [ADR-0012](../adr/0012-capacitor-native-wrapper.md)

### Nativer Wrapper
- [x] Gewählten Wrapper um bestehende React-Codebasis aufsetzen — Capacitor (`apps/frontend/capacitor.config.ts`, `android/`/`ios/` committed)
- [x] Build-Pipeline für Android/iOS (je nach Wrapper-Fähigkeiten) einrichten — `cap:sync`/`cap:android`/`cap:ios` npm scripts; `cap sync` verifiziert. **Scope-Grenze:** Android/iOS-Builds werden bewusst NICHT in CI (`.github/workflows/ci.yml`) gebaut (keine SDKs/Signing auf den Runnern), siehe [ADR-0012](../adr/0012-capacitor-native-wrapper.md). Realer Geräte-Build/Install ist als manueller Follow-up in `docs/known-issues.md` erfasst.
- [x] Sicherstellen, dass Mobile-first-UI ohne Neubau im Wrapper funktioniert — dieselbe gebaute React-SPA (`webDir: dist`) wird im WebView geladen, kein UI-Neubau

### Push-Benachrichtigungen
- [ ] Plattformspezifische Push-Integration über den nativen Wrapper
- [x] Backend-seitige Trigger-Logik (z. B. Scheduled Job: „Letzte Fütterung vor X Stunden“ → Erinnerung) — `NotificationSchedulerService.checkFeedingReminders()` (@Cron alle 30 min), FCM via `PushSenderService`
- [x] Zusammenfassungs-Benachrichtigung (z. B. Tagesüberblick) — `NotificationSchedulerService.sendDailySummaries()` (@Cron stündlich, sendet zur konfigurierten Stunde)
- [ ] Nutzerseitige Einstellungen: Push-Benachrichtigungen an/aus, Schwellenwerte konfigurierbar

## Definition of Done

- Export liefert vollständige, korrekte Rohdaten in JSON und CSV
- Native Wrapper-App lässt sich bauen und auf mindestens einer Zielplattform installieren
- Push-Benachrichtigung wird bei überschrittenem Fütterungsintervall zuverlässig ausgelöst
