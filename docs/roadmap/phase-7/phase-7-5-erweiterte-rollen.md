# Teilphase 7.5: Erweiterte Rollen (Betreuer & Beobachter)

**Bezug im PRD:** Abschnitt 3 (Rollen & Rechte), Abschnitt 4.2 (Erweiterte Rollen)
**Übergeordnet:** [Phase 7 – Übersicht](README.md)

## Ziel

Neben Owner und Co-Parent gibt es zwei eingeschränkte Rollen: **Betreuer** (darf Ereignisse
erfassen, aber nichts löschen und nichts verwalten) und **Beobachter** (reiner Lesezugriff).
Rollen werden bei der Einladung vergeben und lassen sich später ändern.

Der eigentliche Umfang dieser Teilphase ist nicht das Hinzufügen zweier Enum-Werte, sondern das
**Nachziehen der Rechteprüfung über den gesamten Bestand**. Heute gilt faktisch
„Haushaltsmitgliedschaft = volles Schreibrecht": Der `HouseholdMembershipGuard` prüft, *ob* eine
Mitgliedschaft existiert, und `@RequireRole` ist nur an wenigen Stellen gesetzt. Genau dieser
Zustand macht die neuen Rollen zu einer bereichsübergreifenden Aufgabe.

## Voraussetzungen

- [7.1](phase-7-1-wachstumstracking.md), [7.2](phase-7-2-meilensteine.md) und
  [7.3](phase-7-3-medikamente-impfungen.md) sind abgeschlossen. Bewusste Konsequenz der
  Reihenfolge-Entscheidung (siehe [Phase-7-Übersicht](README.md)): Diese drei Module entstehen ohne
  Rollenprüfung, und ihre Controller gehören hier mit zur Audit-Fläche.
- Rollen-/Einladungsinfrastruktur aus Phase 1
  ([ADR-0002](../../adr/0002-application-level-household-roles-and-invites.md)).

## Scope-Abgrenzung

**Enthalten:** zwei neue Rollen, Rechtematrix, Absicherung aller schreibenden Endpunkte,
Mitgliederliste, Rollenzuweisung bei Einladung und im Nachhinein, rollenabhängige Oberfläche.

**Nicht enthalten:**
- **Keine Rechtevergabe pro Kindprofil** (bereichsübergreifende Festlegung 6). Eine Rolle gilt für
  alle Kinder des Haushalts.
- Keine frei definierbaren Rollen oder Einzelrechte — die vier Rollen sind fest.
- Keine Rechteprüfung auf Feldebene (z. B. „darf Notizen sehen, aber keine Fotos").
- Kein Übertragen der Eigentümerschaft an einen anderen Haushalt.

## Rechtematrix

| Aktion | Owner | Co-Parent | Betreuer | Beobachter |
|---|:--:|:--:|:--:|:--:|
| Daten lesen (Events, Timeline, Statistiken, Wachstum, Meilensteine, Medizin) | ✓ | ✓ | ✓ | ✓ |
| Ereignisse erfassen (Fütterung, Schlaf, Windel) | ✓ | ✓ | ✓ | – |
| Wachstum/Meilensteine/Medizin erfassen | ✓ | ✓ | ✓ | – |
| Eigene Einträge bearbeiten | ✓ | ✓ | ✓ | – |
| Fremde Einträge bearbeiten | ✓ | ✓ | – | – |
| Einträge löschen | ✓ | ✓ | – | – |
| Kindprofile anlegen/ändern/löschen | ✓ | ✓ | – | – |
| Export/Bericht erzeugen | ✓ | ✓ | ✓ | – |
| Mitglieder einladen | ✓ | – | – | – |
| Rollen ändern, Mitglieder entfernen | ✓ | – | – | – |
| Haushalt umbenennen/löschen | ✓ | – | – | – |
| Eigene Benachrichtigungseinstellungen | ✓ | ✓ | ✓ | ✓ |

Die Matrix ist vollständig entschieden; die drei zuvor offenen Punkte sind eingearbeitet: Ein
**Betreuer darf eigene Einträge bearbeiten** (sonst wäre ein Tippfehler für ihn nicht korrigierbar)
und **exportieren**, aber weiterhin nichts löschen und nichts verwalten. Ein **Co-Parent darf nicht
einladen** — Mitgliederverwaltung bleibt allein beim Owner.

Ein **Beobachter** hat keine Schreibrechte und keinen Export — er darf ausschließlich lesen und
seine eigenen Benachrichtigungseinstellungen pflegen.

Für den Einladungs-Endpunkt ist „nur Owner" bereits heute umgesetzt
(`@RequireRole(HouseholdRole.OWNER)` in `household.controller.ts`) — hier ändert sich also nichts,
die Regel wird lediglich in der Matrix festgeschrieben.

## Fachliche Anforderungen

| ID | Anforderung |
|---|---|
| ROL-1 | Die Rollen `CAREGIVER` (Betreuer) und `OBSERVER` (Beobachter) ergänzen `HouseholdRole`. Die bestehende Absicherung über `toHouseholdRole()` bleibt die einzige Stelle, an der Rollen-Strings interpretiert werden. |
| ROL-2 | Jeder **schreibende** Endpunkt trägt eine ausdrückliche Rollenanforderung. Ein schreibender Endpunkt ohne Rollenangabe ist ein Fehler, nicht ein stiller „alle dürfen"-Fall. |
| ROL-3 | Ein automatisierter Test stellt sicher, dass kein `POST`/`PATCH`/`PUT`/`DELETE`-Handler unterhalb von `/households/:householdId` ohne Rollenanforderung existiert. Dieser Test ist der eigentliche Schutz vor künftigem Auseinanderlaufen — ohne ihn wiederholt sich der heutige Zustand beim nächsten neuen Modul. |
| ROL-4 | Rechteverstöße antworten mit `403`, nicht mit `404` — die Existenz des Haushalts ist dem Mitglied ohnehin bekannt. Fehlende Mitgliedschaft bleibt wie bisher `404`. |
| ROL-5 | Eine Rollenänderung wirkt sofort für die nächste Anfrage; es gibt kein Rollen-Caching in Sitzung oder Token. |
| ROL-6 | Ein Haushalt hat immer mindestens einen Owner. Der letzte Owner kann weder herabgestuft noch entfernt werden; der Versuch scheitert mit verständlicher Meldung. |
| ROL-7 | Niemand kann die eigene Rolle ändern — auch ein Owner nicht. Das verhindert das versehentliche Aussperren aus dem eigenen Haushalt. |
| ROL-8 | Beim Erstellen einer Einladung wählt der Owner die Zielrolle. Die Rolle wird weiterhin ausschließlich serverseitig aus der Einladung übernommen, nie aus einer Client-Angabe beim Annehmen. |
| ROL-9 | Es gibt eine Mitgliederliste je Haushalt mit Name/E-Mail, Rolle, Beitrittsdatum und den für die eigene Rolle erlaubten Aktionen. Dies schließt zugleich den offenen M2-Punkt aus Phase 6 („Mitgliederliste ergänzen"). |
| ROL-10 | Die eigene Rolle im jeweiligen Haushalt ist für das Frontend abrufbar, damit es Aktionen ausblenden statt sie erst nach dem Fehlschlag erklären zu müssen. |
| ROL-11 | Die Oberfläche blendet nicht erlaubte Aktionen aus, statt sie deaktiviert zu zeigen — ausgenommen Fälle, in denen das Fehlen verwirrender wäre als eine Erklärung (dann deaktiviert mit Begründung). Serverseitige Prüfung bleibt in jedem Fall die maßgebliche. |
| ROL-12 | WebSocket-Räume bleiben lesend für alle Rollen zugänglich; ein Beobachter darf Live-Aktualisierungen sehen. Die Broadcasts tragen ohnehin keine Nutzdaten ([ADR-0007](../../adr/0007-websocket-realtime-sync.md)). |
| ROL-13 | Bestehende Mitgliedschaften behalten ihre Rolle unverändert; die Migration ändert keine Daten. |

## Technische Umsetzung

- **`HouseholdRole`** wird um zwei Werte erweitert. Da die Rolle als `String` gespeichert ist
  (SQLite-Beschränkung, ADR-0002), ist **keine Datenmigration** nötig — nur die Aufnahme in den
  Enum und `toHouseholdRole()`.
- **Rechteprüfung** läuft weiter über `HouseholdMembershipGuard` und den `@RequireRole`-Dekorator.
  Der Dekorator wird um eine schreibende Standardsemantik ergänzt, damit die Anforderung an den
  Endpunkten kurz und lesbar bleibt (z. B. `@RequireRole(...WRITE_ROLES)` als benannte Konstante
  statt einer wiederholten Aufzählung).
- **Besitz-abhängige Rechte** (Betreuer bearbeitet nur eigene Einträge) sind mit reinen
  Rollen-Metadaten nicht ausdrückbar, weil dafür der Datensatz gelesen werden muss. Sie gehören in
  die jeweiligen Services, an genau eine gemeinsame Hilfsfunktion — nicht als kopierte
  `if`-Bedingung in jedes Modul.
- **Audit-Umfang:** `child`, `feeding`, `sleep`, `diaper`, `household`, `invite`, `export`,
  `notification`, `push` sowie die drei in 7.1–7.3 neu entstandenen Module. Das Ergebnis des
  Audits gehört als Tabelle (Endpunkt → erlaubte Rollen) in den Umsetzungs-PR.

## API

| Methode | Pfad | Zweck |
|---|---|---|
| `GET` | `/households/:householdId/members` | vorhanden; wird um Rolle, Name und Beitrittsdatum erweitert |
| `PATCH` | `/households/:householdId/members/:userId` | Rolle ändern (nur Owner) |
| `DELETE` | `/households/:householdId/members/:userId` | Mitglied entfernen (nur Owner) |
| `POST` | `/households/:householdId/invites` | vorhanden; nimmt künftig die Zielrolle entgegen |

Der vorhandene `GET .../members`-Endpunkt dient bislang nur der internen Auflösung von Nutzer-IDs
zu E-Mail-Adressen für die Tages-Timeline. Die Erweiterung ist rückwärtskompatibel (zusätzliche
Felder), aber die aufrufende Stelle in `DailyTimeline` ist mit zu prüfen.

## Frontend

- **Mitgliederliste** in `HouseholdDetail` auf Basis der Design-System-Primitives (`Card`, `Badge`,
  `Avatar`); Rolle als `Badge`, Aktionen im Überlaufmenü.
- **Rollenwahl** im Einladungsdialog über die `Select`-Primitive, mit erklärendem Text je Rolle —
  die Rollennamen allein sagen einem Familienmitglied nichts.
- **Rollenänderung** mit Bestätigungsdialog (`Dialog`), insbesondere beim Herabstufen.
- **Rollenabhängige Oberfläche:** Die eigene Rolle wird zentral bereitgestellt (Kontext/Hook), nicht
  in jeder Komponente einzeln geholt. Eine kleine Hilfsfunktion (z. B. `canWrite(role)`) kapselt die
  Rechtematrix an einer Stelle im Frontend — die Matrix darf nicht über Komponenten verstreut
  nachgebaut werden.
- Alle Rollennamen und Erklärtexte über i18n (de/en).

## Zu treffende Entscheidungen

1. **Betreuer-Rechte, Co-Parent-Einladung** — entschieden, siehe Rechtematrix oben.
2. **ADR-Addendum zu [ADR-0002](../../adr/0002-application-level-household-roles-and-invites.md)**
   statt eines neuen ADR: Die Grundentscheidung (anwendungsseitige Rollen, String-Spalte) bleibt;
   ergänzt werden die zwei Rollen, die Rechtematrix und die Default-Deny-Regel aus ROL-2/ROL-3.

## Offene Punkte

- ~~**Rechteprüfung auch für Kind-Fotos und Meilenstein-Fotos:**~~ Erledigt im Backend-Audit
  (Umsetzungsstand unten): Foto-Ausliefer-Endpunkte (Kind, Meilenstein) sind reine `GET`-Routen ohne
  Rollenbeschränkung (Lesen für alle Rollen), Foto-*Upload* läuft über die bereits erfassten
  `POST`/`PATCH`-Routen (`FULL_WRITE_ROLES` bzw. `ENTRY_WRITE_ROLES` je nach Endpunkt).
- **PRD-Präzisierung:** Die Formulierung „Co-Parent: Schreibrecht auf zugewiesene Kindprofile" in
  PRD Abschnitt 3 ist im Zuge dieser Teilphase auf „alle Kinder des Haushalts" zu korrigieren, damit
  Dokument und Implementierung übereinstimmen. **Weiterhin offen**, siehe Umsetzungsstand unten.
- **ADR-0003 ist durch diese Teilphase inhaltlich überholt:** Die dortige Rollenzuordnung „create/
  delete sind Owner-only, read/edit sind jedes Mitglied" stimmt nicht mehr — `child`-Anlegen/-Ändern/
  -Löschen ist jetzt `FULL_WRITE_ROLES` (OWNER+CO_PARENT). Braucht ein Addendum analog zu den
  Sleep-/Diaper-Addenda in ADR-0006. **Neu gefunden während der Umsetzung, noch offen.**

## Aufgaben

- [x] `HouseholdRole` um `CAREGIVER`/`OBSERVER` erweitern
- [x] Rechtematrix (siehe oben) als Konstante im Code abbilden — genau eine Quelle für Backend-Prüfung und Frontend-Anzeige
- [x] Audit aller schreibenden Endpunkte inkl. der Module aus 7.1–7.3; Ergebnis als Tabelle im PR
- [x] `@RequireRole` an allen schreibenden Endpunkten setzen
- [x] Test, der unannotierte schreibende Handler erkennt (ROL-3)
- [x] Besitz-abhängige Prüfung („nur eigene Einträge") als gemeinsame Hilfsfunktion
- [x] Owner-Schutzregeln ROL-6/ROL-7 inkl. Tests
- [x] Endpunkte für Rollenänderung und Mitglieder-Entfernung
- [x] `GET .../members` um Rolle/Name/Beitrittsdatum erweitern; Aufrufer in `DailyTimeline` prüfen
- [x] Rollenwahl im Einladungsdialog
- [x] Mitgliederliste in `HouseholdDetail` (schließt den offenen M2-Punkt aus Phase 6)
- [x] Eigene Rolle zentral im Frontend bereitstellen; `canWrite`-Hilfsfunktion
- [ ] Rollenabhängiges Ausblenden von Aktionen in allen betroffenen Screens — **teilweise**: Child-
      Screens (`ChildList`/`ChildCreate`/`ChildSettings`), `MemberList`, `InviteGenerator`,
      `HouseholdList` sind fertig; Feeding/Sleep/Diaper/Growth/Milestone/HealthRecord-Screens
      (Edit/Delete/Export-Buttons) und der Export-Button auf `ChildSettings` (`EXPORT_ROLES`
      schließt OBSERVER aus, wird dort noch angezeigt) stehen aus — siehe Umsetzungsstand unten.
- [x] i18n-Texte (de/en) für Rollennamen und Erklärungen
- [ ] ADR-0002 um ein Addendum ergänzen
- [ ] PRD Abschnitt 3 präzisieren; offenen M2-Punkt in `phase-6-design-system-ux.md` abhaken
- [x] Tests je Rolle gegen einen repräsentativen Satz Endpunkte (erlaubt/verboten)

## Umsetzungsstand (Stand 2026-09-05)

Backend und Frontend-Fundament sind implementiert, review-durchlaufen und lokal in `feature/version-2`
gemerged (zwei Merge-Commits, **noch nicht gepusht**). Zwei separate `/develop`-Läufe:

1. **Backend** (2 Review-Runden): `CAREGIVER`/`OBSERVER`, Rechtematrix-Konstanten
   (`apps/backend/src/household/household-permissions.ts`), `@RequireRole` an allen schreibenden
   Endpunkten inkl. Fail-closed-Guard (schreibende Route ohne Rollenangabe → 403 zur Laufzeit,
   zusätzlich zum ROL-3-Test), gemeinsamer Ownership-Helper (`assertMayEditEntry`, aus den
   Rollen-Bündeln abgeleitet statt eine Rolle hartzucodieren), Member-Endpunkte
   (`PATCH`/`DELETE .../members/:userId`) inkl. transaktional abgesicherter Owner-Schutzregeln,
   Invite mit Zielrolle. Review-Fixes: entfernte Mitglieder bekamen sonst weiter Push-Benachrichtigungen
   mit Kind-Daten (Membership-Filter in den Notification-Schedulern ergänzt); Last-Owner-Prüfung war
   ohne Transaktion racy (zwei gleichzeitige Owner konnten sich gegenseitig auf 0 Owner herabstufen);
   Betreuer darf jetzt fremde laufende Timer stoppen und fremde geplante Medizin-Einträge als erledigt
   markieren (bewusste Erweiterung — sonst wäre die Schichtübergabe zwischen Eltern und Betreuer
   blockiert).
2. **Frontend-Fundament** (2 Review-Runden): `lib/householdPermissions.ts` (Backend-Spiegel),
   `useHouseholdRole`-Hook, Mitgliederliste mit Rolle/Name/Beitrittsdatum sowie Rollenänderung
   (inklusive **Beförderung zu OWNER** — das Backend erlaubt das gezielt zum Teilen/Übertragen von
   Eigentümerschaft zwischen bekannten Mitgliedern, im Unterschied zur Einladung, die OWNER bewusst
   ausschließt) und Entfernen, Rollenwahl im Einladungsdialog, i18n. Reviews deckten zwei echte
   Regressionen auf, die durch die Rollenlockerung selbst entstanden: `ChildCreate` blockte
   CO_PARENT trotz sichtbarem „Kind hinzufügen"-Link (Sackgasse), und `ChildSettings` zeigte
   CAREGIVER/OBSERVER ein voll editierbares, ungegatetes Profilformular (403 erst beim Absenden).
   Beide behoben.

**Für die Fortsetzung offen:**
- Rollenabhängiges Ausblenden in den verbleibenden Domain-Screens (siehe Aufgaben-Checkbox oben) —
  dritter `/develop`-Lauf, nutzt die in diesem Lauf bereits definierten, aber noch nicht konsumierten
  Bündel `ENTRY_WRITE_ROLES`/`EXPORT_ROLES` aus `lib/householdPermissions.ts`.
- Dokumentations-Lauf: ADR-0002-Addendum, **ADR-0003-Korrektur** (neu während der Umsetzung
  gefunden, siehe „Offene Punkte" oben), PRD-Abschnitt-3-Präzisierung, M2-Haken in
  `phase-6-design-system-ux.md`.
- Branch lokal gemerged, aber **nicht gepusht** — Push/PR gegen `feature/version-2` steht noch aus.

## Definition of Done

- [x] Betreuer und Beobachter existieren, sind bei Einladung wählbar und nachträglich änderbar.
- [x] Jeder schreibende Endpunkt unterhalb von `/households/:householdId` trägt eine ausdrückliche
  Rollenanforderung; der Test aus ROL-3 belegt das und verhindert Rückfälle.
- [x] Ein Beobachter kann nachweislich nichts schreiben, ein Betreuer nachweislich nichts löschen und
  nichts verwalten — je Rolle durch Tests gegen echte Endpunkte belegt.
- [x] Der letzte Owner eines Haushalts kann nicht entfernt oder herabgestuft werden.
- [x] Die Mitgliederliste zeigt alle Mitglieder mit Rolle; der offene M2-Punkt aus Phase 6 ist damit
  fachlich geschlossen (Checkbox in `phase-6-design-system-ux.md` steht noch aus, siehe oben).
- [ ] Die Oberfläche zeigt keine Aktionen an, die die eigene Rolle nicht ausführen darf — **teilweise**,
  siehe Umsetzungsstand.
- [x] Rollennamen und Erklärungen liegen in Deutsch und Englisch vor.
- [x] Keine Regression in der bestehenden Testsuite (Backend 1012/83 Unit + 155/12 e2e; Frontend
  1100/148 — beide zuletzt grün).
