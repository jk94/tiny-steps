# Phase 0: Projekt-Setup & Infrastruktur

**Bezug im PRD:** Abschnitt 5 (Technische Leitplanken), 5.0 (Betriebsmodell), 5.3 (Plattform-Strategie), 5.5 (Datenbank & Persistenz)

## Ziel

Ein lauffähiges, self-hostbares Grundgerüst für Backend und Frontend, auf dem alle folgenden Phasen aufbauen können.

## Voraussetzungen

Keine – dies ist die Startphase.

## Aufgaben

### Repository & Monorepo-Struktur
- [x] Monorepo-Struktur anlegen (`apps/backend`, `apps/frontend`; kein `packages/shared` — für Phase 0 nicht benötigt, siehe Umsetzungsplan)
- [x] Basis-Tooling: Package-Manager (Bun, Workspaces), gemeinsames Linting/Formatting (ESLint Flat Config, Prettier)
- [x] `.gitignore`, `README.md` für das Repository

### Backend-Grundgerüst (NestJS)
- [x] NestJS-Projekt initialisieren
- [x] Modulstruktur anlegen (`AuthModule`, `HouseholdModule`, `ChildModule`, `EventModule` als leere Platzhalter)
- [x] Basis-Health-Check-Endpoint (`GET /health`)

### Frontend-Grundgerüst (React + Vite)
- [x] React + Vite-Projekt initialisieren (kein Next.js, siehe PRD-Begründung 5.3)
- [x] Mobile-first Basis-Layout/Design-System-Grundlage (Breakpoints-CSS, `<Layout>`-Komponente)
- [x] Routing-Grundgerüst (react-router: `/` Dashboard, `/login` Platzhalter)

### Datenbank & Persistenz
- [x] Prisma im Backend einrichten
- [x] SQLite als MVP-Datenbank konfigurieren
- [x] Prisma-Schema so strukturieren, dass ein Wechsel auf PostgreSQL/MySQL ohne größere Code-Änderungen möglich ist (statischer `provider`-String + austauschbarer Driver-Adapter in `PrismaService`, siehe Kommentar in `schema.prisma`)
- [x] Erstes Datenmodell gemäß PRD 5.2 angelegt: `User`, `Membership`, `Household`, `Child`, `Event` (Grundfelder, ohne Feature-Details)
- [x] Prisma Migrate für initiales Schema eingerichtet

### Konfigurationskonzept
- [x] Konfigurationsdatei-Format definiert: YAML (`config.example.yml`) für OIDC-Provider und DB-Provider-Wahl
- [x] Konfiguration wird beim Backend-Start geladen und validiert (Joi-Schema, fail-fast; kein Admin-UI im MVP)

### Deployment & Self-Hosting
- [x] Ein Dockerfile für die gesamte App (Single-Container: NestJS baut & serviert das React-Build via `ServeStaticModule`, kein separates Frontend-/nginx-Image — Entscheidung, siehe Umsetzungsplan)
- [x] `docker-compose.yml` für lokalen Self-Hosting-Betrieb (ein `backend`-Service, Volume für SQLite-Datei)
- [x] Beispiel-Konfigurationsdatei (`config.example.yml`) für Homelab-Nutzer

### CI-Grundgerüst
- [x] CI-Pipeline für Lint, Test, Build (Backend & Frontend) — ursprünglich zurückgestellt (es war noch keine Git-Hosting-Plattform/kein Remote gewählt), nachträglich umgesetzt via `.github/workflows/ci.yml` (GitHub Actions: Jobs für Lint/Format, Backend, Frontend sowie einen Docker-Build inkl. optionalem Push nach GHCR als Platzhalter-Registry bei Push auf `main`).

## Definition of Done

- `docker compose up` startet die App (Backend + ausgeliefertes Frontend) lauffähig
- Health-Check-Endpoint ist erreichbar
- Prisma-Migrationen laufen gegen SQLite durch
- CI-Pipeline ist grün (nachträglich umgesetzt, siehe oben — nicht mehr auf dem initialen Commit, sondern ab Einführung von `.github/workflows/ci.yml`)
