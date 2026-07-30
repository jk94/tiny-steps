# Phase 0: Projekt-Setup & Infrastruktur

**Bezug im PRD:** Abschnitt 5 (Technische Leitplanken), 5.0 (Betriebsmodell), 5.3 (Plattform-Strategie), 5.5 (Datenbank & Persistenz)

## Ziel

Ein lauffähiges, self-hostbares Grundgerüst für Backend und Frontend, auf dem alle folgenden Phasen aufbauen können.

## Voraussetzungen

Keine – dies ist die Startphase.

## Aufgaben

### Repository & Monorepo-Struktur
- [ ] Monorepo-Struktur anlegen (z. B. `apps/backend`, `apps/frontend`, ggf. `packages/shared` für gemeinsame Typen/DTOs)
- [ ] Basis-Tooling: Package-Manager, Workspace-Konfiguration, gemeinsames Linting/Formatting (ESLint, Prettier)
- [ ] `.gitignore`, `README.md` für das Repository

### Backend-Grundgerüst (NestJS)
- [ ] NestJS-Projekt initialisieren
- [ ] Modulstruktur anlegen (z. B. `AuthModule`, `HouseholdModule`, `ChildModule`, `EventModule` als leere Platzhalter)
- [ ] Basis-Health-Check-Endpoint

### Frontend-Grundgerüst (React + Vite)
- [ ] React + Vite-Projekt initialisieren (kein Next.js, siehe PRD-Begründung 5.3)
- [ ] Mobile-first Basis-Layout/Design-System-Grundlage (z. B. Breakpoints, Basis-Komponentenbibliothek)
- [ ] Routing-Grundgerüst

### Datenbank & Persistenz
- [ ] Prisma im Backend einrichten
- [ ] SQLite als MVP-Datenbank konfigurieren
- [ ] Prisma-Schema so strukturieren, dass ein Wechsel auf PostgreSQL/MySQL ohne größere Code-Änderungen möglich ist
- [ ] Erstes Datenmodell gemäß PRD 5.2 anlegen: `User`, `Membership`, `Household`, `Child`, `Event` (Grundfelder, ohne Feature-Details)
- [ ] Prisma Migrate für initiales Schema einrichten

### Konfigurationskonzept
- [ ] Konfigurationsdatei-Format definieren (z. B. YAML/JSON) für OIDC-Provider und DB-Provider-Wahl
- [ ] Konfiguration wird beim Backend-Start geladen und validiert (kein Admin-UI im MVP)

### Deployment & Self-Hosting
- [ ] Dockerfile für Backend
- [ ] Dockerfile für Frontend (bzw. Build-Output-Bereitstellung über Backend/Reverse Proxy)
- [ ] `docker-compose.yml` für lokalen Self-Hosting-Betrieb (Backend, Frontend, Volume für SQLite-Datei)
- [ ] Beispiel-Konfigurationsdatei (`config.example.yml` o. ä.) für Homelab-Nutzer

### CI-Grundgerüst
- [ ] CI-Pipeline für Lint, Test, Build (Backend & Frontend)

## Definition of Done

- `docker compose up` startet Backend und Frontend lokal lauffähig
- Health-Check-Endpoint ist erreichbar
- Prisma-Migrationen laufen gegen SQLite durch
- CI-Pipeline ist grün auf dem initialen Commit
