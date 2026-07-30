# Implementierungs-Roadmap: Baby Tracking App

Diese Roadmap unterteilt das [PRD](../../Baby%20Tracking%20App%20PRD.md) in nacheinander umsetzbare Phasen. Jede Phase liegt in einer eigenen Datei mit Ziel, Voraussetzungen, Aufgaben und Definition of Done (DoD).

## Phasenübersicht

| Phase | Titel | Umfang | Status |
|---|---|---|---|
| [0](phase-0-projekt-setup.md) | Projekt-Setup & Infrastruktur | MVP-Fundament | Offen |
| [1](phase-1-auth-multiuser.md) | Authentifizierung & Multiuser-Grundlage | MVP | Offen |
| [2](phase-2-tracking-kernfunktionen.md) | Tracking-Kernfunktionen | MVP | Offen |
| [3](phase-3-sync-uebersicht.md) | Echtzeit-Sync & Übersicht | MVP | Offen |
| [4](phase-4-offline-pwa.md) | Offline-First & PWA | MVP | Offen |
| [5](phase-5-export-wrapper-push.md) | Export, Nativer Wrapper & Push-Benachrichtigungen | MVP | Offen |
| [6](phase-6-v2-erweiterungen.md) | Version 2.0 – Erweiterungen | Post-MVP | Offen |

Phasen 0–5 bilden zusammen den MVP (Abschnitt 4.1 und 6 des PRD). Phase 6 entspricht Abschnitt 4.2. Die Vision-Punkte aus Abschnitt 4.3 (Smartwatch, Smart-Home-Integration, KI-Musteranalyse) sind bewusst nicht verplant, da sie noch keine konkreten Anforderungen haben.

## Reihenfolge & Abhängigkeiten

Die Phasen bauen weitgehend sequenziell aufeinander auf:

```
Phase 0 (Setup)
   └─> Phase 1 (Auth & Multiuser)
          └─> Phase 2 (Tracking-Kernfunktionen)
                 └─> Phase 3 (Echtzeit-Sync & Übersicht)
                        └─> Phase 4 (Offline-First & PWA)
                               └─> Phase 5 (Export, Wrapper & Push)
                                      └─> Phase 6 (V2-Erweiterungen)
```

Phase 4 (Offline-First) und Phase 5 (nativer Wrapper) könnten je nach Team-Kapazität teilweise parallelisiert werden, da sie unterschiedliche Schichten betreffen (Frontend-Datenhaltung vs. Wrapper/Push). Phase 3 (Echtzeit-Sync) sollte jedoch vor Phase 4 stehen, da das Offline-Sync-Konzept auf dem bestehenden Sync-Mechanismus aufsetzt.

## Offene Fragen aus dem PRD

- **Capacitor vs. Tauri**: Muss spätestens zu Beginn von Phase 5 entschieden werden (siehe [Phase 5](phase-5-export-wrapper-push.md)).
