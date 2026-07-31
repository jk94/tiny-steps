# Product Requirements Document: Baby Tracking App

**Version:** 0.1 (Entwurf)
**Datum:** 30.07.2026
**Autor:** Jan

---

## 1. Zusammenfassung

Eine App zur Dokumentation und Verfolgung der täglichen Bedürfnisse und Entwicklung eines Babys (Stillen/Füttern, Schlaf, Windeln, Wachstum, Meilensteine). Die App richtet sich primär an Eltern(-paare), die gemeinsam, aber getrennt voneinander, Einträge für dasselbe Kind erfassen und einsehen können sollen.

### 1.1 Zielgruppe
- Frischgebackene Eltern (0–3 Jahre)
- Paare, die sich die Betreuung teilen und synchron auf dieselben Daten zugreifen wollen
- Optional: Großeltern/Babysitter als Mitleser oder Miterfasser (Rollenkonzept)

### 1.2 Ziele
- Schnelle, unkomplizierte Eingabe von Ereignissen (möglichst mit wenigen Taps)
- Gemeinsame, in Echtzeit synchronisierte Sicht auf ein Kind für mehrere Nutzer
- Auswertung/Trends (Schlafrhythmus, Fütterungsintervalle, Wachstum)
- Datenhoheit: selbst hostbar bzw. flexible Login-Optionen

---

## 2. Nicht-funktionale Kernanforderungen (vom Auftraggeber vorgegeben)

| Anforderung | Beschreibung |
|---|---|
| **Multiuser-Fähigkeit** | Mehrere Nutzer (z. B. Mutter und Vater) besitzen eigene Accounts, sind aber demselben Kind/Haushalt zugeordnet und sehen dieselben Daten |
| **Login-Flexibilität** | Lokaler Login (E-Mail/Passwort) **und** OIDC (z. B. Google, Keycloak, Authentik, Azure AD) müssen unterstützt werden |
| **Plattform** | Web-App (responsive), mobil nutzbar (Mobile-first UI), später installierbar (PWA und/oder native Wrapper) |

Diese drei Punkte sind architekturprägend und werden in Abschnitt 5 vertieft.

---

## 3. Nutzerrollen

| Rolle | Rechte |
|---|---|
| **Owner/Elternteil** | Volles Bearbeitungsrecht, kann weitere Nutzer einladen, Kind-Profile anlegen/löschen |
| **Mitpflegender (Co-Parent)** | Volle Lese-/Schreibrechte auf zugeordnete Kind-Profile |
| **Betreuer (optional, später)** | Eingeschränkte Rechte, z. B. nur Erfassen von Ereignissen, kein Löschen/Verwalten |
| **Beobachter (optional, später)** | Nur Lesezugriff (z. B. Großeltern) |

Ein **Haushalt/Familienverbund** kann mehrere Nutzer und mehrere Kind-Profile enthalten (Geschwister). Nutzer können theoretisch mehreren Haushalten angehören (z. B. getrenntlebende Eltern).

---

## 4. Kernfunktionen (Features)

### 4.1 MVP (Version 1.0)

**Tracking-Grundfunktionen**
- **Stillen/Füttern**: Start/Stopp-Timer für Stillen (links/rechts), Fläschchen (Menge in ml), Beikost (Notiz/Menge)
- **Schlaf**: Start/Stopp-Timer, manuelle Nachtragung, Tagesübersicht
- **Windeln**: Pipi / Stuhlgang / beides, Konsistenz-Notiz optional
- **Schnelleingabe**: Ein-Tap-Buttons für die häufigsten Ereignisse auf dem Startbildschirm

**Multiuser & Familienverbund**
- Registrierung/Login (lokal + OIDC)
- Erstellen eines Haushalts, Einladen weiterer Nutzer per Link/Code
- Anlegen eines oder mehrerer Kind-Profile (Name, Geburtsdatum, Foto optional)
- Alle Nutzer eines Haushalts sehen dieselben Einträge in Echtzeit (oder nahezu Echtzeit)
- Anzeige, **wer** welchen Eintrag erfasst hat (Nachvollziehbarkeit)

**Übersicht & Auswertung**
- Tages-Timeline aller Ereignisse
- Einfache Statistiken: Schlafstunden/Tag, Anzahl Fütterungen/Tag, Zeit seit letztem Ereignis
- Erinnerung/Hinweis: "Letzte Fütterung vor X Stunden"

**Daten & Benachrichtigungen**
- Datenexport/Backup (z. B. JSON/CSV-Export der Rohdaten für Sicherung und Portabilität)
- Push-Benachrichtigungen (z. B. Erinnerung an fällige Fütterung, Zusammenfassung) — Umsetzung über plattformspezifische native Wrapper (Capacitor/Tauri), nicht über Web Push

**Plattform**
- Responsive Web-App, mobil-optimiert (Mobile-first)
- Installierbar als PWA (Icon auf Homescreen, Offline-Grundfunktion für Eingabe)

### 4.2 Version 2.0 (nach MVP)
- Wachstumstracking (Gewicht, Größe, Kopfumfang) inkl. Perzentilen-Kurven
- Meilensteine (erstes Lächeln, erste Schritte, Zähne …)
- Medikamente/Impfungen mit Erinnerungsfunktion
- Erweiterter Export (PDF-Bericht für Kinderarzt)
- Erweiterte Rollen (Betreuer, Beobachter)
- Mehrsprachigkeit

### 4.3 Später / Vision
- Smartwatch-Companion (schnelle Eingabe per Wear OS/watchOS)
- Integration mit Smart-Home (z. B. Babyphone-Daten, Raumtemperatur/-Luftfeuchtigkeit via Home Assistant)
- KI-gestützte Musteranalyse (z. B. Schlafprognose)

---

## 5. Technische Leitplanken

### 5.0 Betriebsmodell
- **Self-Hosting only** — kein SaaS/Cloud-Angebot geplant. Deployment z. B. via Docker/Docker Compose, passend für Homelab-Betrieb
- Konfiguration (inkl. OIDC-Provider) erfolgt über eine Konfigurationsdatei, nicht über eine Admin-UI im MVP

### 5.1 Authentifizierung
- **Lokaler Login**: E-Mail/Passwort mit sicherem Hashing (z. B. Argon2), optional 2FA später
- **OIDC**: Standard-konforme Anbindung (Authorization Code Flow + PKCE). Ein oder mehrere OIDC-Provider (z. B. Keycloak, Authentik, Google, Microsoft Entra) werden über eine Konfigurationsdatei eingetragen — kein Code-Deploy nötig, um einen weiteren Provider hinzuzufügen
- Beide Methoden (lokal + OIDC) koexistieren nebeneinander; ein Nutzer wählt beim Login die gewünschte Methode
- Session-Handling: JWT (Access- und Refresh-Token) in httpOnly-Cookies, mit serverseitig widerrufbaren Refresh-Tokens — Entscheidung inkl. Begründung siehe [ADR-0001](docs/adr/0001-jwt-httponly-cookie-session-handling.md)

### 5.2 Multiuser-Datenmodell (Grobentwurf)
```
User ──< Membership >── Household ──< Child
                                        └──< Event (Feeding/Sleep/Diaper/…)
```
- `Event` referenziert immer `Child` und den erfassenden `User`
- Rechteprüfung erfolgt über `Membership` (Rolle innerhalb des Haushalts)
- Echtzeit-Sync zwischen Nutzern eines Haushalts (z. B. via WebSockets oder Polling/SSE für MVP)

### 5.3 Plattform-Strategie
- **Frontend**: React + Vite (Single-Page-App, kein Next.js — SSR/SSG wird für eine interne, eingeloggte Familien-App nicht benötigt)
- **Backend**: **NestJS** (Entscheidung, siehe Begründung unten)
- **Bereits für MVP nötig**: ein minimaler nativer Wrapper (Capacitor oder Tauri) um die React-Codebasis, da Push-Benachrichtigungen plattformspezifisch über den Wrapper laufen — reine PWA ohne Wrapper reicht dafür nicht aus
- Mobile-first Design von Anfang an, damit der native Wrapper ohne UI-Neubau auskommt

#### Begründung Backend-Framework-Entscheidung (NestJS vs. Next.js)

| Kriterium | Next.js | NestJS |
|---|---|---|
| Self-Hosting ohne Serverless-Overhead | Für Edge/Serverless optimiert, WebSockets nur über Custom-Server-Workaround | Nativer langlebiger Node-Prozess, WebSockets als First-Class-Modul (`@nestjs/websockets`) |
| Echtzeit-Sync zwischen Haushaltsmitgliedern | Umständlich (Route Handler können nicht auf WebSocket upgraden) | Direkt unterstützt |
| Lokaler Login + OIDC parallel | Möglich, aber ohne Struktur (kein eingebautes Guard-/Pipeline-Konzept) | Sauber über Passport-Strategien + Guards abbildbar, reifes OIDC-Ökosystem (`openid-client`, `@nestjs/passport`) |
| SEO/SSR-Bedarf | Kernstärke von Next.js | Nicht relevant für interne, eingeloggte App |
| Push-Benachrichtigungen | Wäre über Server Actions/Edge ein Pro-Argument gewesen | Entfällt als Kriterium, da Push über native Wrapper läuft |
| Modulare, testbare Struktur (passend zu TDD) | Eher unstrukturiert bei API-Routes | Module/Services/DI von Grund auf isoliert testbar |

**Entscheidung**: NestJS als Backend, da Self-Hosting, Echtzeit-Sync und strukturierte Multi-Strategie-Authentifizierung die zentralen Anforderungen sind und Next.js' Kernvorteil (Rendering-Strategien für öffentliche/SEO-relevante Inhalte) hier nicht greift.

### 5.4 Offline-First-Konzept
- Grundprinzip: **Synchronisation wenn Verbindung vorhanden, sonst lokale Zwischenspeicherung**
- Neue Einträge werden zunächst lokal (z. B. IndexedDB) geschrieben und optimistisch angezeigt
- Bei bestehender Verbindung erfolgt Sync mit dem Server nahezu in Echtzeit; bei fehlender Verbindung sammeln sich Änderungen lokal und werden bei Reconnect nachgezogen
- Konfliktbehandlung: Last-Write-Wins reicht für den MVP aus (basierend auf Zeitstempel des Ereignisses)

### 5.5 Datenbank & Persistenz
- **ORM**: Prisma
- **MVP**: SQLite (einfacher Self-Hosting-Betrieb ohne separaten DB-Server, passend für kleine Haushalts-Instanzen)
- **Erweiterbarkeit**: Prisma-Schema so gehalten, dass ein Wechsel auf PostgreSQL oder MySQL ohne größere Code-Änderungen möglich ist (Datenbank-Provider über Konfiguration wählbar, analog zur OIDC-Konfigurationsdatei)
- Migrationslogik von Anfang an über Prisma Migrate, um spätere Wechsel des Datenbank-Providers sauber nachvollziehbar zu halten

### 5.6 Tooling: Package-Manager & Konfigurationsformat
- **Package-Manager**: Bun (Workspaces für das Monorepo, `bun install` statt npm/yarn/pnpm)
- **Laufzeitumgebung**: Node.js — bewusst *kein* Bun-Runtime im Produktivbetrieb (Docker-Images, `nest start`, Prisma-Client), da Bun-Runtime-Kompatibilität mit Prisma's Query-Engine-Bindings und nativen Node-Modulen (z. B. Argon2 für Passwort-Hashing) zum Zeitpunkt der Entscheidung (Phase 0) noch nicht als stabil genug bewertet wurde. Bun bleibt reines Build-/Install-Tool
- **Konfigurationsdatei-Format**: YAML (statt JSON) — menschenfreundlicher für Homelab-Nutzer, erlaubt Kommentare, passt zum bereits YAML-basierten `docker-compose.yml`

---

## 6. Erfolgskriterien (MVP)
- Eintrag eines Ereignisses in unter 3 Sekunden/2 Taps möglich
- Zwei Nutzer im selben Haushalt sehen einen neuen Eintrag ohne manuellen Reload
- Login funktioniert sowohl lokal als auch über mindestens einen OIDC-Provider
- App ist auf Mobilgeräten (Browser) vollständig bedienbar und als PWA installierbar

## 7. Offene Fragen
- Welcher native Wrapper für Push (Capacitor vs. Tauri) — und damit einhergehend, ab wann im Roadmap-Verlauf die native Wrapper-Entwicklung startet
