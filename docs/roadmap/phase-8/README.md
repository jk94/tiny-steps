# Phase 8: Alexa-Integration

**Bezug im PRD:** Abschnitt 4.3 (Vision: Smart-Home-Integration), Abschnitt 5.0 (Self-Hosting only)
**Ausgangspunkt:** [Brainstorm](brainstorm.md)
**Entscheidung:** [ADR-0017](../../adr/0017-alexa-skill-account-linking-and-in-process-endpoint.md)

## Ziel

Eltern können die wichtigsten Alltagsaktionen per Sprache erledigen, ohne das Handy in die Hand zu
nehmen — typischerweise mit einem Kind auf dem Arm: Fütterungen, Windeln und Schlaf eintragen,
nachfragen, wann zuletzt gefüttert/gewickelt/geschlafen wurde, sich den Tag zusammenfassen lassen
und Erinnerungen für die nächste Fütterung oder ein Medikament stellen.

Jede Instanz ist selbst gehostet; es gibt deshalb **keinen zentralen, veröffentlichten Skill**.
Jede Betreiberin legt in ihrer eigenen Amazon-Developer-Konsole einen privaten (Entwicklungs-)Skill
an, der auf die eigene Instanz zeigt. Das Repository liefert dafür das komplette Skill-Paket
(Interaktionsmodelle, Manifest, Account-Linking-Vorlage) und eine Schritt-für-Schritt-Anleitung.

## Voraussetzungen

- Phasen 0–5 (Konten inkl. OIDC, Haushalte/Rollen, Tracking-Kern, Echtzeit-Sync).
- Phase 7.3 (Medikamente) für die Medikamenten-Erinnerung und die Abfrage geplanter Gaben.
- Phase 7.5 (Rollen) — die Sprachbefehle unterliegen derselben Berechtigungsmatrix wie die App.
- Betrieb der Instanz unter einer **öffentlich erreichbaren HTTPS-Adresse** mit gültigem
  Zertifikat (Amazon ruft den Skill-Endpunkt aus dem Internet auf). Ohne das ist die Integration
  nicht nutzbar; sie ist deshalb optional und standardmäßig aus.

## Scope-Abgrenzung

**Enthalten:** Custom Skill (Deutsch, Englisch), Account Linking über einen in die App eingebauten
OAuth-2.0-Autorisierungsserver, Sprachbefehle für Fütterung/Windel/Schlaf, Abfragen, Tages-
zusammenfassung, Erinnerungen über die Alexa-Reminders-API, mehrere Kinder mit Standardkind,
Fallback-Antworten für jede Fehlerlage, Verwaltung der Verknüpfungen in der App, anpassbare
Antworten über `config.yml`.

**Nicht enthalten:**
- Kein zentral gehosteter oder im Alexa-Store veröffentlichter Skill (widerspräche Self-Hosting).
- Keine AWS-Lambda-Funktion — der Skill-Endpunkt ist Teil des Backends (siehe ADR-0017).
- Keine Smart-Home-Skill-API, keine Routinen-Trigger, keine Bildschirm-Oberflächen (APL).
- Kein Eintragen von Wachstum, Meilensteinen oder Medikamentengaben per Sprache — nur Abfrage
  geplanter Medikamente/Impfungen und Erinnerungen daran.
- Kein Bearbeiten oder Löschen bestehender Einträge per Sprache (Fehlerkorrektur bleibt in der App).
- Keine weiteren Sprachassistenten (Google Assistant, Siri) — die Account-Linking-Infrastruktur ist
  aber generisch genug, um sie später wiederzuverwenden.

## Fachliche Anforderungen

| ID | Anforderung |
|---|---|
| ALX-1 | **Eintragen per Sprache:** Fütterung (Flasche mit Menge, Beikost, Stillen links/rechts — mit Dauer als abgeschlossener Eintrag, ohne Dauer als laufender Timer), Windel (nass/voll/beides), Schlaf (Start, Ende, oder abgeschlossen mit Dauer). Stillen und Schlaf lassen sich per Sprache beenden. |
| ALX-2 | Fehlende Pflichtangaben werden nachgefragt statt geraten (Fütterungsart, Flaschenmenge, Windelart, Schlafdauer). Es gelten dieselben Grenzen wie in der App (z. B. 1–2000 ml). |
| ALX-3 | **Abfragen:** „Wann wurde zuletzt gefüttert/gewickelt/geschlafen?" — mit relativer Zeit („vor 2 Stunden und 10 Minuten") und Uhrzeit in der Zeitzone des Echo-Geräts. Laufende Timer werden als solche benannt („schläft seit 40 Minuten"). Ohne Angabe der Aktivität werden alle drei genannt. |
| ALX-4 | **Tageszusammenfassung** für heute oder ein genanntes Datum: Anzahl Fütterungen, Windeln (nach Art), Schlafdauer, laufender Schlaf. Tagesgrenzen in der Zeitzone des Geräts. |
| ALX-5 | **Erinnerungen** über die Alexa-Reminders-API: „Erinnere mich in 3 Stunden ans Füttern" (relativ) und „Erinnere mich um 20 Uhr an das Vitamin D" (absolut, optional täglich). Ohne genanntes Medikament wird ein eindeutig geplantes Medikament des Kindes übernommen. Abfrage „Welche Medikamente/Impfungen stehen an?". |
| ALX-6 | Die Erinnerungs-Berechtigung wird per Sprache angefragt (Voice Permissions), sobald sie fehlt; nach Zustimmung wird die ursprünglich gewünschte Erinnerung ohne erneute Ansage angelegt. Bei Ablehnung: erklärende Antwort plus Berechtigungs-Karte in der Alexa-App. |
| ALX-7 | **Account Linking** (OAuth 2.0 Authorization Code Grant): Die Alexa-App öffnet eine Zustimmungsseite der Instanz; wer nicht angemeldet ist, meldet sich dort mit lokalem Konto **oder OIDC** an und kehrt danach automatisch zur Zustimmung zurück. |
| ALX-8 | **Mehrere Familienmitglieder:** Jedes Mitglied verknüpft sein eigenes Amazon-Konto; Einträge werden dem verknüpften Nutzer zugeordnet (wie in der App). Liefert Alexa für eine erkannte Stimme ein eigenes Token (Sprachprofile), hat dieses Vorrang. Per Sprache angelegte Einträge erscheinen per Echtzeit-Sync sofort bei allen anderen. |
| ALX-9 | **Mehrere Kinder:** Das Kind kann im Befehl genannt werden („Emma wurde gewickelt"); sonst gilt das Standardkind der Verknüpfung; gibt es nur ein Kind, ist es automatisch gemeint; andernfalls wird nachgefragt. Das Standardkind wird bei der Verknüpfung, in der App oder per Sprache („Setze Emma als Standardkind") festgelegt. Kinder aller Haushalte des Nutzers sind erreichbar. |
| ALX-10 | **Berechtigungen:** Es gilt die bestehende Rollenmatrix. Beobachter können abfragen und Erinnerungen stellen, aber nichts eintragen; sie erhalten eine erklärende Antwort mit dem Hinweis, was sie stattdessen tun können. Timer stoppen ist — wie in der App — jedem schreibberechtigten Mitglied erlaubt. |
| ALX-11 | **Fallback-Antworten** für: nicht verknüpftes/widerrufenes Konto (mit Verknüpfungs-Karte), unbekannter Kindname (mit Nennung der vorhandenen Kinder), kein Kind angelegt, fehlende Rolle, laufender/fehlender Timer, fehlende Erinnerungs-Berechtigung, nicht verstandene Äußerung (`AMAZON.FallbackIntent`), unerwartete Fehler. Keine Antwort täuscht einen Erfolg vor. |
| ALX-12 | **Verwaltung in der App:** Auf der Profilseite listet ein Abschnitt „Alexa" die Verknüpfungen (verknüpft am, zuletzt benutzt), erlaubt pro Verknüpfung die Wahl des Standardkinds und das Aufheben der Verknüpfung. Aufheben wirkt sofort. Der Abschnitt erscheint nur, wenn die Instanz Alexa konfiguriert hat. |
| ALX-13 | **Anpassbarkeit (optional):** Jede Antwort kann pro Sprache in `config.yml` überschrieben werden; unbekannte Schlüssel oder Platzhalter lassen den Start scheitern (fail-fast). Aufrufname und Beispielsätze passt die Betreiberin im mitgelieferten Interaktionsmodell an, da jede Instanz ihren eigenen Skill besitzt. |
| ALX-14 | **Sicherheit:** Jede Skill-Anfrage wird nach Amazons Vorgaben geprüft (Signatur über die Zertifikatskette, Zeitstempel ± 150 s, Skill-ID). Tokens werden nur gehasht gespeichert; Redirect-URIs müssen exakt einer konfigurierten entsprechen; Client-Authentifizierung am Token-Endpunkt ist Pflicht. |
| ALX-15 | Die Integration ist **standardmäßig aus** und wird allein durch einen `alexa`-Abschnitt in `config.yml` aktiviert. Ohne ihn antworten alle Alexa-Endpunkte mit 404. |

## Prüfung: Eigene Alexa-Endpunkte oder bestehende nutzen?

Die bestehende REST-API ist ausschließlich für die eigene SPA gebaut: Sitzung über httpOnly-Cookies,
CSRF-Double-Submit, kein CORS. Alexa kann davon nichts nutzen — der Skill-Dienst erhält von Amazon
ein **Bearer-Token** und muss Amazons **signierte Anfragen** beantworten. Ergebnis:

- **Neu und nötig** sind nur Protokoll-Endpunkte, die es in der App nicht gibt: der
  Skill-Endpunkt (`POST /api/alexa/skill`), der OAuth-Token-Endpunkt (`POST /api/alexa/oauth/token`),
  die Zustimmung (`GET`/`POST /api/alexa/oauth/authorize`) und die Verwaltung der Verknüpfungen
  (`/api/alexa/links`).
- **Wiederverwendet** wird die gesamte Fachlogik *in-process*: `FeedingService`, `SleepService`,
  `DiaperService`, `EventService`, `HealthRecordService`, die Rollen-Bündel aus
  `household-permissions.ts` und die DTO-Validierung. Damit gelten dieselben Regeln (z. B. „nur ein
  laufender Schlaftimer") und derselbe Echtzeit-Broadcast wie bei der App.
- **Bewusst nicht** werden die Haushalts-REST-Routen für Bearer-Tokens geöffnet: Das würde jede
  Route einem zweiten Authentifizierungsweg aussetzen, den CSRF-Schutz relativieren und Alexa mehr
  Rechte geben als die wenigen Sprachaktionen brauchen.

Die Abwägung (inkl. Lambda-Variante und externem Identity-Provider) steht in ADR-0017.

## Umgang mit unzureichenden Berechtigungen

Drei Ebenen, jede mit eigener Antwort:

1. **Konto nicht verknüpft / Verknüpfung aufgehoben** — Alexa liefert kein oder ein ungültiges
   Token → Ansage „Bitte verknüpfe zuerst dein Konto in der Alexa-App" plus `LinkAccount`-Karte. Die
   Sitzung endet.
2. **Rolle reicht nicht** (Beobachter will eintragen) → Erklärung mit Rolle und Kind, Hinweis auf
   das, was erlaubt ist („Du kannst aber fragen, wann Emma zuletzt gefüttert wurde"). Es wird nichts
   geschrieben; ein 403 der Fachlogik würde ebenso in diese Antwort übersetzt.
3. **Alexa-Berechtigung fehlt** (Erinnerungen) → Voice-Permission-Anfrage
   (`Connections.SendRequest`/`AskFor`), danach automatische Fortsetzung; bei Ablehnung Erklärung
   plus `AskForPermissionsConsent`-Karte.

Dazu kommen fachliche Fallbacks (unbekanntes Kind, kein Timer läuft, nichts verstanden) und ein
generischer Fehler-Fallback, der nie einen Erfolg behauptet.

## Datenmodell

Drei neue Tabellen, keine Änderung an bestehenden Spalten:

- `AlexaAccountLink` — eine Verknüpfung: Nutzer, Hash des (langlebigen) Refresh-Tokens,
  `defaultChildId` (FK, `onDelete: SetNull`), `createdAt`, `lastUsedAt`, `revokedAt`.
- `AlexaAccessToken` — kurzlebige Access-Tokens (1 h) einer Verknüpfung, nur als Hash.
- `AlexaAuthorizationCode` — Einmal-Codes (5 min) mit Redirect-URI, optionaler PKCE-Challenge und
  dem bei der Zustimmung gewählten Standardkind; ein zweites Einlösen widerruft die daraus
  entstandene Verknüpfung.

## API

| Methode & Pfad | Auth | Zweck |
|---|---|---|
| `GET /api/alexa/oauth/authorize` | Cookie-Sitzung | Prüft eine Autorisierungsanfrage, liefert die wählbaren Kinder |
| `POST /api/alexa/oauth/authorize` | Cookie-Sitzung + CSRF | Zustimmung/Ablehnung → Redirect-URL mit `code`/`error` und `state` |
| `POST /api/alexa/oauth/token` | Client-Credentials (Basic oder Body) | `authorization_code` und `refresh_token` Grant |
| `GET /api/alexa/links` | Cookie-Sitzung | Status (`enabled`), eigene Verknüpfungen, erreichbare Kinder |
| `PATCH /api/alexa/links/:linkId` | Cookie-Sitzung + CSRF | Standardkind setzen/entfernen |
| `DELETE /api/alexa/links/:linkId` | Cookie-Sitzung + CSRF | Verknüpfung aufheben |
| `POST /api/alexa/skill` | Amazon-Signatur + Bearer im Request | Skill-Anfragen |

Keine dieser Routen liegt unter `/households/:householdId`; die Rollenprüfung passiert pro Kind im
Skill-Dienst gegen die Mitgliedschaft.

## Frontend

- Neue geschützte Route `/alexa/link` (Zustimmungsseite für die Alexa-App).
- OIDC-Login übernimmt künftig einen sicheren, relativen `returnTo`-Pfad, damit auch OIDC-Nutzer
  nach der Anmeldung auf der Zustimmungsseite (oder einer Einladung) landen statt auf `/`.
- Abschnitt „Alexa" auf der Profilseite (ALX-12). Phase 7.6 baut diese Seite später zum
  Einstellungsbereich aus; der Abschnitt zieht dann als eigener Block mit um.

## Aufgaben

- [x] Phasenplanung und ADR-0017
- [x] Konfigurationsabschnitt `alexa` inkl. Antwort-Überschreibungen und Validierung
- [x] Prisma-Migration für Verknüpfungen, Access-Tokens, Autorisierungscodes
- [x] OAuth-2.0-Autorisierungsserver (Zustimmung, Token-Endpunkt, PKCE optional, Code-Wiederverwendungs-Erkennung)
- [x] Prüfung der Amazon-Anfragesignatur, Zeitstempel- und Skill-ID-Prüfung
- [x] Skill-Dienst: Intents, Kind-Auflösung, Rollen-Fallbacks, Zeitzone des Geräts, Erinnerungen
- [x] Skill-Paket (`alexa/skill-package`, de-DE/en-US) und Einrichtungsanleitung
- [x] Zustimmungsseite, Verwaltungsabschnitt, OIDC-`returnTo`
- [x] Unit-, e2e- und Frontend-Tests; Konsistenztest Interaktionsmodell ↔ Code
- [ ] Manuelle Prüfung mit echtem Echo-Gerät und echter Alexa-App (siehe `docs/known-issues.md`)

## Definition of Done

- Alle Anforderungen ALX-1 bis ALX-15 sind umgesetzt und durch Tests abgedeckt, soweit sie ohne
  Amazon-Infrastruktur prüfbar sind.
- Ohne `alexa`-Abschnitt verhält sich die App exakt wie vorher (alle neuen Routen 404, kein
  Abschnitt in der Profilseite).
- Ein Eintrag per Sprache erscheint bei anderen verbundenen Haushaltsmitgliedern ohne Neuladen.
- Ein Beobachter kann per Sprache nichts schreiben; ein Aufheben der Verknüpfung in der App macht
  das Alexa-Token sofort ungültig.
- Die Einrichtung ist für eine Betreiberin ohne Vorwissen anhand von `alexa/README.md`
  nachvollziehbar.
- Die End-to-End-Prüfung auf echter Hardware ist als offener manueller Punkt erfasst.
