# Phase 1: Authentifizierung & Multiuser-Grundlage

**Bezug im PRD:** Abschnitt 3 (Nutzerrollen), 4.1 (Multiuser & Familienverbund), 5.1 (Authentifizierung), 5.2 (Multiuser-Datenmodell)

## Ziel

Nutzer können sich lokal oder per OIDC registrieren/anmelden, einen Haushalt gründen, weitere Nutzer einladen und Kind-Profile anlegen. Rechteprüfung basiert auf der Haushalts-Mitgliedschaft.

## Voraussetzungen

Phase 0 abgeschlossen (Backend-/Frontend-Grundgerüst, Basis-Datenmodell, Konfigurationskonzept).

## Aufgaben

### Lokale Authentifizierung
- [x] Registrierung mit E-Mail/Passwort
- [x] Passwort-Hashing mit Argon2
- [x] Login-Endpoint für lokale Zugangsdaten
- [x] Session-/Token-Handling festlegen und implementieren (JWT oder Server-Session) — Entscheidung: JWT (Access + Refresh) in httpOnly-Cookies, mit DB-gestützter Refresh-Token-Rotation samt Reuse-Detection; Details und Begründung siehe [ADR-0001](../adr/0001-jwt-httponly-cookie-session-handling.md)

### OIDC-Authentifizierung
- [x] Authorization Code Flow + PKCE gegen mehrere, config-gesteuerte Provider — Entscheidung: direkte `openid-client`-Service-Integration statt Passport-Strategie (aktuelles `openid-client` v6 hat keine für Passport passende Klassenform, und Passport erwartet eine Strategie-Instanz pro festem Namen, nicht eine dynamische, erst zur Laufzeit aus `config.yml` bekannte Provider-Liste); Details siehe [ADR-0004](../adr/0004-oidc-authentication.md)
- [x] OIDC-Provider-Konfiguration über die Konfigurationsdatei aus Phase 0 (mehrere Provider möglich, z. B. Keycloak, Authentik, Google, Entra ID) — `clientSecret` liegt bewusst in `config.yml`, nicht in einer Env-Var (strukturierte, mehrteilige Provider-Liste statt eines einzelnen Secrets); siehe ADR-0004
- [x] Provider-übergreifendes User-Mapping (externe OIDC-Identität ↔ internes `User`-Konto) via neuem `OidcIdentity`-Modell — **OIDC-Logins mit passender E-Mail werden automatisch verknüpft, unabhängig vom `email_verified`-Claim — eine bewusste, vom Nutzer freigegebene Risikoabwägung für den self-hosted/Familien-Kontext dieser App, siehe ADR-0004 für die volle Begründung und die Warnung vor öffentlichen/offenen OIDC-Providern**
- [x] Login-Auswahl (Backend-Seite): `GET /api/auth/oidc/providers` liefert die konfigurierten Provider (nur `id`/`displayName`, keine Secrets) für eine künftige Frontend-Auswahl-UI; das eigentliche Frontend folgt in einem separaten Schritt

### Rollen- & Rechtemodell
- [x] `Membership`-Entity mit Rolle (Owner, Co-Parent für MVP) vervollständigen — Rolle wird als TypeScript-`HouseholdRole`-Enum auf Anwendungsebene durchgesetzt (Prisma-Enums werden auf SQLite nicht unterstützt, Spalte bleibt `String`); Details siehe [ADR-0002](../adr/0002-application-level-household-roles-and-invites.md)
- [x] NestJS-Guards zur Rechteprüfung auf Basis der `Membership`-Rolle — `HouseholdMembershipGuard` + `@RequireRole()`-Decorator
- [x] Zugriffsprüfung: Ein Nutzer darf nur auf Haushalte/Kinder zugreifen, denen er zugeordnet ist — für Kinder als wiederverwendbare Erweiterungsstelle (`HouseholdAccessService`) vorbereitet, Kind-Profile selbst folgen in einem separaten Schritt

### Haushalt & Einladung
- [x] Haushalt erstellen (erster Nutzer wird automatisch Owner)
- [x] Einladungsmechanismus per Link oder Code — ein einzelner, gehashter Opaque-Token dient als Link und Code; Details siehe [ADR-0002](../adr/0002-application-level-household-roles-and-invites.md). Widerruf/Auflisten offener Einladungen bewusst zurückgestellt (`revokedAt`-Spalte existiert bereits als Vorbereitung)
- [x] Einladung annehmen → Nutzer wird `Membership` im Haushalt zugeordnet
- [x] Unterstützung für Nutzer in mehreren Haushalten (z. B. getrenntlebende Eltern)

### Kind-Profile
- [x] Kind-Profil anlegen (Name, Geburtsdatum, Foto optional) — Foto-Upload läuft über Multer (In-Memory) mit MIME-Type-Sniffing und 2-MB-Limit, Speicherung lokal auf Disk (selbes Docker-Volume wie SQLite); Details siehe [ADR-0003](../adr/0003-child-photo-storage-on-local-disk.md)
- [x] Kind-Profil bearbeiten/löschen — Rollen-Feinschliff gegenüber der Checklisten-Kurzform "nur Owner": Anlegen/Löschen bleibt Owner-only (strukturelle Haushalts-Änderung), Lesen/Bearbeiten ist für Co-Parent erlaubt, passend zu PRD Abschnitt 3 und der Definition of Done dieser Phase; Details siehe [ADR-0003](../adr/0003-child-photo-storage-on-local-disk.md)
- [x] Mehrere Kind-Profile pro Haushalt (Geschwister)

### Frontend
- [x] i18n-Infrastruktur (DE/EN) eingerichtet — bewusst aus Phase 6/PRD 4.2 vorgezogen, siehe ADR-0005
- [x] Login-/Registrierungs-UI (lokal)
- [x] OIDC-Redirect-Flow im Frontend (Login-Button je konfiguriertem Provider) — Button je konfiguriertem Provider auf Login/Register, `<a href>`-Navigation (kein XHR) für den Redirect+Cookie-Flow, Fehlerdarstellung für `oidc_error` per i18n-Mapping
- [ ] Haushalts-Verwaltung: Haushalt anlegen, Einladungslink generieren/anzeigen, Einladung annehmen
- [ ] Kind-Profil-Verwaltung UI (Anlegen/Bearbeiten/Löschen)
- [x] Geschützte Routen (nur mit gültiger Session/Token erreichbar)

## Definition of Done

- Login funktioniert sowohl lokal als auch über mindestens einen OIDC-Provider (Erfolgskriterium PRD Abschnitt 6)
- Zwei Nutzer können sich demselben Haushalt zuordnen und sehen dieselben Kind-Profile
- Rechteprüfung verhindert Zugriff auf fremde Haushalte/Kinder
- Owner kann weitere Nutzer einladen, Co-Parent kann Kind-Profile lesen/bearbeiten aber keine Nutzer verwalten
