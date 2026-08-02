# Implementierungs-Roadmap: Baby Tracking App

Diese Roadmap unterteilt das [PRD](../../Baby%20Tracking%20App%20PRD.md) in nacheinander umsetzbare Phasen. Jede Phase liegt in einer eigenen Datei mit Ziel, Voraussetzungen, Aufgaben und Definition of Done (DoD).

## Phasenübersicht

| Phase | Titel | Umfang | Status |
|---|---|---|---|
| [0](phase-0-projekt-setup.md) | Projekt-Setup & Infrastruktur | MVP-Fundament | Abgeschlossen |
| [1](phase-1-auth-multiuser.md) | Authentifizierung & Multiuser-Grundlage | MVP | Abgeschlossen |
| [2](phase-2-tracking-kernfunktionen.md) | Tracking-Kernfunktionen | MVP | Fast abgeschlossen¹ |
| [3](phase-3-sync-uebersicht.md) | Echtzeit-Sync & Übersicht | MVP | Abgeschlossen |
| [4](phase-4-offline-pwa.md) | Offline-First & PWA | MVP | Teilweise begonnen² |
| [5](phase-5-export-wrapper-push.md) | Export, Nativer Wrapper & Push-Benachrichtigungen | MVP | Offen |
| [6](phase-6-design-system-ux.md) | Design-System & moderne User Experience | Post-MVP | Offen |
| [7](phase-7-v2-erweiterungen.md) | Version 2.0 – Erweiterungen | Post-MVP | Offen |

¹ Alle Aufgaben umgesetzt bis auf den manuellen UX-Review der 3-Sekunden/2-Taps-Vorgabe (siehe „UX-Validierung" in [Phase 2](phase-2-tracking-kernfunktionen.md)) — durch Tap-Zahl-Tests plausibilisiert, aber kein Ersatz für den echten manuellen Review.

² Nur der „PWA"-Teil (Web App Manifest, Service Worker für App-Shell-Caching) ist umgesetzt (siehe [ADR-0008](../adr/0008-pwa-basics-via-vite-plugin-pwa.md)); die reale Installierbarkeits-Verifikation auf Android/iOS/Desktop-Browsern steht noch aus, ebenso wie die komplette „Lokale Datenhaltung"/„Synchronisation"-Aufgabe (IndexedDB, optimistisches UI, Sync-Queue, Konfliktbehandlung) samt der drei zugehörigen Tests in [Phase 4](phase-4-offline-pwa.md).

Phasen 0–5 bilden zusammen den MVP (Abschnitt 4.1 und 6 des PRD). Phase 6 (Design-System & UX) ist eine
zusätzliche, nicht direkt aus dem PRD abgeleitete Phase, die die bislang funktional, aber visuell rein
technisch gehaltene MVP-UI auf ein einheitliches, modernes Design-Niveau hebt, bevor der Funktionsumfang
in Phase 7 weiter wächst. Phase 7 entspricht Abschnitt 4.2 des PRD. Die Vision-Punkte aus Abschnitt 4.3
(Smartwatch, Smart-Home-Integration, KI-Musteranalyse) sind bewusst nicht verplant, da sie noch keine
konkreten Anforderungen haben.

## Reihenfolge & Abhängigkeiten

Die Phasen bauen weitgehend sequenziell aufeinander auf:

```
Phase 0 (Setup)
   └─> Phase 1 (Auth & Multiuser)
          └─> Phase 2 (Tracking-Kernfunktionen)
                 └─> Phase 3 (Echtzeit-Sync & Übersicht)
                        └─> Phase 4 (Offline-First & PWA)
                               └─> Phase 5 (Export, Wrapper & Push)
                                      └─> Phase 6 (Design-System & UX)
                                             └─> Phase 7 (V2-Erweiterungen)
```

Phase 4 (Offline-First) und Phase 5 (nativer Wrapper) könnten je nach Team-Kapazität teilweise parallelisiert werden, da sie unterschiedliche Schichten betreffen (Frontend-Datenhaltung vs. Wrapper/Push). Phase 3 (Echtzeit-Sync) sollte jedoch vor Phase 4 stehen, da das Offline-Sync-Konzept auf dem bestehenden Sync-Mechanismus aufsetzt. Phase 6 folgt bewusst erst nach dem vollständigen MVP (Phasen 0–5), da sie alle bis dahin entstandenen Screens einheitlich überarbeitet; innerhalb von Phase 6 selbst gibt es jedoch erhebliches Parallelisierungspotenzial (siehe Meilenstein-Struktur in [Phase 6](phase-6-design-system-ux.md)).

## Offene Fragen aus dem PRD

- **Capacitor vs. Tauri**: Muss spätestens zu Beginn von Phase 5 entschieden werden (siehe [Phase 5](phase-5-export-wrapper-push.md)).
