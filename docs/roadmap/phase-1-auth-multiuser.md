# Phase 1: Authentifizierung & Multiuser-Grundlage

**Bezug im PRD:** Abschnitt 3 (Nutzerrollen), 4.1 (Multiuser & Familienverbund), 5.1 (Authentifizierung), 5.2 (Multiuser-Datenmodell)

## Ziel

Nutzer können sich lokal oder per OIDC registrieren/anmelden, einen Haushalt gründen, weitere Nutzer einladen und Kind-Profile anlegen. Rechteprüfung basiert auf der Haushalts-Mitgliedschaft.

## Voraussetzungen

Phase 0 abgeschlossen (Backend-/Frontend-Grundgerüst, Basis-Datenmodell, Konfigurationskonzept).

## Aufgaben

### Lokale Authentifizierung
- [ ] Registrierung mit E-Mail/Passwort
- [ ] Passwort-Hashing mit Argon2
- [ ] Login-Endpoint für lokale Zugangsdaten
- [ ] Session-/Token-Handling festlegen und implementieren (JWT oder Server-Session)

### OIDC-Authentifizierung
- [ ] Passport-Strategie(n) für OIDC (Authorization Code Flow + PKCE) integrieren (`@nestjs/passport`, `openid-client`)
- [ ] OIDC-Provider-Konfiguration über die Konfigurationsdatei aus Phase 0 (mehrere Provider möglich, z. B. Keycloak, Authentik, Google, Entra ID)
- [ ] Provider-übergreifendes User-Mapping (externe OIDC-Identität ↔ internes `User`-Konto)
- [ ] Login-Auswahl: Nutzer wählt zwischen lokalem Login und verfügbaren OIDC-Providern

### Rollen- & Rechtemodell
- [ ] `Membership`-Entity mit Rolle (Owner, Co-Parent für MVP) vervollständigen
- [ ] NestJS-Guards zur Rechteprüfung auf Basis der `Membership`-Rolle
- [ ] Zugriffsprüfung: Ein Nutzer darf nur auf Haushalte/Kinder zugreifen, denen er zugeordnet ist

### Haushalt & Einladung
- [ ] Haushalt erstellen (erster Nutzer wird automatisch Owner)
- [ ] Einladungsmechanismus per Link oder Code
- [ ] Einladung annehmen → Nutzer wird `Membership` im Haushalt zugeordnet
- [ ] Unterstützung für Nutzer in mehreren Haushalten (z. B. getrenntlebende Eltern)

### Kind-Profile
- [ ] Kind-Profil anlegen (Name, Geburtsdatum, Foto optional)
- [ ] Kind-Profil bearbeiten/löschen (nur Owner)
- [ ] Mehrere Kind-Profile pro Haushalt (Geschwister)

### Frontend
- [ ] Login-/Registrierungs-UI (lokal)
- [ ] OIDC-Redirect-Flow im Frontend (Login-Button je konfiguriertem Provider)
- [ ] Haushalts-Verwaltung: Haushalt anlegen, Einladungslink generieren/anzeigen, Einladung annehmen
- [ ] Kind-Profil-Verwaltung UI (Anlegen/Bearbeiten/Löschen)
- [ ] Geschützte Routen (nur mit gültiger Session/Token erreichbar)

## Definition of Done

- Login funktioniert sowohl lokal als auch über mindestens einen OIDC-Provider (Erfolgskriterium PRD Abschnitt 6)
- Zwei Nutzer können sich demselben Haushalt zuordnen und sehen dieselben Kind-Profile
- Rechteprüfung verhindert Zugriff auf fremde Haushalte/Kinder
- Owner kann weitere Nutzer einladen, Co-Parent kann Kind-Profile lesen/bearbeiten aber keine Nutzer verwalten
