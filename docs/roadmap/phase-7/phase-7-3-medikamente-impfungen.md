# Teilphase 7.3: Medikamente & Impfungen

**Bezug im PRD:** Abschnitt 4.2 (Medikamente/Impfungen mit Erinnerungsfunktion)
**Übergeordnet:** [Phase 7 – Übersicht](README.md)

## Ziel

Eltern dokumentieren verabreichte Medikamente und erhaltene Impfungen, tragen geplante Termine
(z. B. „nächste Impfung am 14.03.") ein und werden rechtzeitig per Push daran erinnert.

Der Erinnerungsteil setzt auf der in Phase 5 gebauten Infrastruktur auf: `NotificationSettings`
(pro Nutzer und Kind), `NotificationSchedulerService` (`@nestjs/schedule`-Cron) und
`PushSenderService`. Es entsteht **kein** zweiter Benachrichtigungsmechanismus.

## Voraussetzungen

- MVP (Phasen 0–5) und Phase 6 (Design-System) sind abgeschlossen; insbesondere die Push-Strecke
  aus Phase 5 ([ADR-0012](../../adr/0012-capacitor-native-wrapper.md)).
- Keine Abhängigkeit zu 7.1/7.2 — parallel bearbeitbar.
- **Empfehlung:** [7.6 (Nutzereinstellungen)](phase-7-6-nutzereinstellungen-sprache.md) vorziehen,
  falls die Erinnerungs-Einstellungen einen echten Einstellungsbereich brauchen. Andernfalls
  entsteht hier eine provisorische Einstellungsstelle, die 7.6 anschließend wieder umbaut.

## Scope-Abgrenzung

**Enthalten:** Erfassung verabreichter Medikamente und Impfungen, geplante Termine mit manuell
gesetztem Fälligkeitsdatum, Push-Erinnerung dazu, Übersicht, Übersichtskarte auf `ChildHome`,
Rohdatenexport.

**Nicht enthalten:**
- **Keine wiederkehrenden Dosierungsschemata** („alle 8 Stunden über 5 Tage"). Bewusst
  ausgeschlossen: erfordert Zeitzonen-Behandlung pro Nutzer, Quittierung einzelner Gaben und
  Nachholen verpasster Gaben — eine eigene Teilphase wert, kein Nebenbei-Feature.
- **Kein hinterlegter Impfkalender** (z. B. STIKO), der Fälligkeiten automatisch aus dem
  Geburtsdatum ableitet. Ausgeschlossen wegen der fachlichen Verantwortung (das wäre eine
  medizinische Empfehlung) und des laufenden Pflegeaufwands der Daten.
- Kein Echtzeit-Sync, kein Offline-Erfassen; keine Aufnahme in die Tages-Timeline.
- Keine Wechselwirkungs- oder Dosierungsprüfung. Die App rechnet keine Dosis aus und warnt vor
  nichts — sie protokolliert, was Eltern eingeben.

## Fachliche Anforderungen

| ID | Anforderung |
|---|---|
| MED-1 | Ein Eintrag ist entweder eine **Medikamentengabe** oder eine **Impfung**. Beide haben Bezeichnung, optional Notiz und den erfassenden Nutzer. |
| MED-2 | Ein Eintrag ist entweder **erfolgt** (mit Zeitpunkt der Verabreichung) oder **geplant** (mit Fälligkeitsdatum) oder beides (geplanter Termin, der später als erfolgt markiert wurde). Mindestens eines von beidem muss gesetzt sein. |
| MED-3 | Bei einer Medikamentengabe können Dosis (Zahl) und Einheit (z. B. ml, mg, Tropfen, Stück) erfasst werden; beide sind optional, aber nur gemeinsam sinnvoll — eine Dosis ohne Einheit wird abgelehnt. |
| MED-4 | Bei einer Impfung kann zusätzlich eine Chargen-/Impfstoffbezeichnung erfasst werden (frei, optional) — der Wert, den Eltern typischerweise aus dem Impfpass abschreiben. |
| MED-5 | Ein geplanter Eintrag kann mit einem Tap als „erfolgt" markiert werden; dabei wird der Verabreichungszeitpunkt auf „jetzt" vorbelegt und bleibt änderbar. |
| MED-6 | Ein Verabreichungszeitpunkt darf nicht vor dem Geburtsdatum und nicht in der Zukunft liegen. Ein Fälligkeitsdatum darf in der Vergangenheit liegen (überfälliger Termin) und wird dann als überfällig gekennzeichnet. |
| MED-7 | Für geplante Einträge kann eine Erinnerung aktiviert werden. Sie wird mit einem konfigurierbaren Vorlauf vor dem Fälligkeitsdatum als Push zugestellt (Standard: 3 Tage vorher), zusätzlich am Fälligkeitstag selbst. |
| MED-8 | Erinnerungen werden pro Nutzer und Kind ein-/ausschaltbar; der Vorlauf ist einstellbar. Umgesetzt als Erweiterung des bestehenden `NotificationSettings`-Modells, nicht als neues Einstellungsmodell. |
| MED-9 | Eine Erinnerung wird pro Eintrag und Auslöser **höchstens einmal** zugestellt. Die Entdoppelung folgt dem bestehenden Muster (`feedingReminderLastSentAt`): gesendet wird nur, wenn seit dem letzten Versand kein erneuter Anlass entstanden ist. |
| MED-10 | Ein als „erfolgt" markierter oder gelöschter Eintrag löst keine weiteren Erinnerungen mehr aus. |
| MED-11 | Tippt der Nutzer auf die Push-Benachrichtigung, öffnet die App den betreffenden Eintrag — konsistent zum in Phase 5 etablierten Deep-Link-Verhalten. |
| MED-12 | Die Übersicht zeigt zwei Abschnitte: anstehende/überfällige Termine (aufsteigend nach Fälligkeit) und die Historie erfolgter Gaben/Impfungen (absteigend). |
| MED-13 | `ChildHome` erhält eine Karte „Medizin" mit dem nächsten fälligen Termin (bzw. einem Hinweis auf Überfälligkeit) und Link auf die Übersicht. Ohne Einträge zeigt sie einen Empty State. |
| MED-14 | Einträge sind bearbeitbar und löschbar. |
| MED-15 | Ohne Netzverbindung schlägt das Speichern sichtbar fehl; es wird kein Erfolgszustand vorgetäuscht. |

## Datenmodell

Ein gemeinsames Modell mit Unterscheidungsmerkmal statt zweier fast identischer Tabellen —
Medikamentengabe und Impfung unterscheiden sich in genau zwei Feldern, teilen aber Zeitpunkt,
Fälligkeit, Erinnerungszustand und Übersichtsdarstellung. Zwei Tabellen würden die
Scheduler-Abfrage und die Übersichtsliste jeweils verdoppeln.

```prisma
model HealthRecord {
  id      String @id @default(cuid())
  childId String
  userId  String
  // 'MEDICATION' | 'VACCINATION'. Plain String, kein Prisma-`enum`
  // (SQLite-Connector, siehe ADR-0002); Zugriff über `toHealthRecordKind()`.
  kind    String
  name    String

  // Gesetzt, sobald tatsächlich verabreicht. Null bei einem rein geplanten
  // Termin. Mindestens eines von `administeredAt`/`dueAt` muss gesetzt sein
  // (MED-2) — im Service geprüft, auf Schemaebene nicht ausdrückbar.
  administeredAt DateTime?
  dueAt          DateTime?

  // Nur bei kind = MEDICATION.
  doseAmount Float?
  doseUnit   String?
  // Nur bei kind = VACCINATION (Impfstoff-/Chargenbezeichnung aus dem Impfpass).
  vaccineBatch String?

  note String?

  reminderEnabled Boolean   @default(false)
  // Letzter tatsächlich zugestellter Erinnerungs-Push für diesen Eintrag —
  // die Entdoppelungsgrundlage (MED-9), analog
  // `NotificationSettings.feedingReminderLastSentAt`.
  reminderLastSentAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  child Child @relation(fields: [childId], references: [id])
  user  User  @relation(fields: [userId], references: [id])

  @@index([childId, dueAt])
  @@index([childId, administeredAt])
}
```

Erweiterung des bestehenden `NotificationSettings`-Modells:

```prisma
  medicalReminderEnabled  Boolean @default(true)
  medicalReminderLeadDays Int     @default(3)
```

Die feldweise Gültigkeit je `kind` (Dosis nur bei Medikament, Charge nur bei Impfung) wird im
Service/DTO geprüft, nicht im Schema. Das ist derselbe Kompromiss, den `FeedingDetail` bereits
eingeht (siehe [ADR-0006](../../adr/0006-event-base-table-with-per-type-detail-tables.md)), und
gehört als Kommentar ans Modell.

## Erinnerungs-Scheduler

- Neue Cron-Methode in `NotificationSchedulerService` (bestehende Klasse erweitern, keine zweite
  Scheduler-Klasse), benannt und über Nests `SchedulerRegistry` prüfbar wie
  `FEEDING_REMINDER_CRON`/`DAILY_SUMMARY_CRON`.
- Lauf **einmal täglich** zu einer festen Stunde, nicht stündlich: Es geht um Fälligkeiten auf
  Tagesebene, ein häufigerer Lauf brächte keinen Nutzen und mehr Entdoppelungsaufwand.
- Auswahlkriterium: `reminderEnabled = true`, `administeredAt IS NULL`, `dueAt` innerhalb des
  Vorlauffensters oder überfällig, und der zuständige `NotificationSettings`-Eintrag aktiv.
- Wie im Bestand wird „jetzt" aus dem injizierten `ClockService` gelesen, damit Tests mit fixierter
  Zeit direkt gegen die Methode laufen können statt gegen die Wanduhr.
- **Zeitzonen:** Es gilt weiterhin die MVP-Vereinfachung „Server-Lokalzeit" aus Phase 5. Das ist
  hier spürbarer als bei der Tageszusammenfassung (ein Fälligkeitstag kann sich um einen Tag
  verschieben, wenn Server und Nutzer weit auseinanderliegen) und wird deshalb ausdrücklich als
  bekannte Einschränkung dokumentiert, nicht stillschweigend übernommen.

## API

| Methode | Pfad | Zweck |
|---|---|---|
| `GET` | `/households/:householdId/children/:childId/health-records` | Liste, filterbar nach `kind` und Status (geplant/erfolgt) |
| `POST` | `/households/:householdId/children/:childId/health-records` | Anlegen |
| `PATCH` | `/households/:householdId/children/:childId/health-records/:id` | Ändern, inkl. „als erfolgt markieren" (MED-5) |
| `DELETE` | `/households/:householdId/children/:childId/health-records/:id` | Löschen |

Die Erinnerungs-Einstellungen laufen über den bestehenden `NotificationController` — dessen DTO
wird um die zwei neuen Felder erweitert, es entsteht kein zweiter Einstellungs-Endpunkt.

## Frontend

- Neue Route `…/children/:childId/health` (Übersicht mit den zwei Abschnitten aus MED-12) sowie
  Erfassungs-/Bearbeitungsansichten.
- Umschaltung Medikament/Impfung über die `Tabs`-Primitive; die kind-spezifischen Felder erscheinen
  abhängig davon.
- Überfällige Termine werden über eine `Badge`-Variante (`warning`/`destructive`) gekennzeichnet —
  bestehende Varianten, keine neuen Farb-Tokens nötig.
- Die Erinnerungs-Einstellungen erscheinen dort, wo die Push-Einstellungen aus Phase 5 bereits
  leben (siehe Voraussetzung zu 7.6).
- Zwei neue Icons (Medikament, Impfung) im Stil des bestehenden hand-gezeichneten
  Event-Typ-Icon-Sets unter `components/ui/icons/`.

## Zu treffende Entscheidungen

1. **Ein Modell mit `kind`-Unterscheidung statt zweier Tabellen** — im ADR zur Domänen-Modellierung
   aus [7.1](phase-7-1-wachstumstracking.md) mit aufnehmen oder kurz im PR begründen.
2. **Täglicher statt stündlicher Cron-Lauf** — im Code-Kommentar begründen, analog zum bestehenden
   Scheduler.
3. **Standard-Vorlauf von 3 Tagen** — Produktentscheidung; als benannte Konstante, nicht als
   Magic Number, und über die Einstellungen änderbar.

## Offene Punkte

- **Push-Zustellung real verifizieren:** Die Zustellung auf echten Geräten ist bereits aus Phase 5
  ein offener manueller Punkt in [`docs/known-issues.md`](../../known-issues.md). Die
  Erinnerungen dieser Teilphase erben diese Einschränkung — sie sind automatisiert nur bis zum
  `PushSenderService` prüfbar.
- **Mehrere Erinnerungszeitpunkte:** Aktuell zwei feste Auslöser (Vorlauf + Fälligkeitstag). Ob
  Eltern mehrere frei wählbare Erinnerungen pro Termin brauchen, ist offen — vorerst nein.

## Aufgaben

- [x] Datenmodell `HealthRecord` und Erweiterung von `NotificationSettings` inkl. Prisma-Migration
- [x] Backend-Modul `health` (Controller, Service, DTOs, kind-abhängige Validierung nach MED-1 bis MED-6)
- [x] Cron-Methode für Fälligkeits-Erinnerungen im bestehenden `NotificationSchedulerService`, inkl. Entdoppelung (MED-9/MED-10)
- [x] `NotificationController`-DTO um die zwei neuen Einstellungsfelder erweitern
- [x] Deep-Link vom Push in den betreffenden Eintrag (MED-11)
- [x] Übersichtsansicht mit den zwei Abschnitten und Überfälligkeits-Kennzeichnung
- [x] Erfassungs-/Bearbeitungs-UI inkl. „als erfolgt markieren" (MED-5)
- [x] Zwei neue Icons im Stil des bestehenden Icon-Sets
- [x] Übersichtskarte „Medizin" auf `ChildHome` (MED-13)
- [x] i18n-Texte (de/en) inkl. der Push-Benachrichtigungstexte
- [x] Rohdaten-Export um Medikamente/Impfungen erweitern (Abstimmung mit [7.4](phase-7-4-erweiterter-export-pdf.md))
- [x] Zeitzonen-Einschränkung in `docs/known-issues.md` dokumentieren
- [x] Unit-Tests: Validierung je `kind`, Scheduler-Auswahl und Entdoppelung mit fixierter Uhr, Statuswechsel geplant→erfolgt

## Definition of Done

- Medikamentengaben und Impfungen können erfasst, geplant, als erfolgt markiert, geändert und
  gelöscht werden.
- Erinnerungen werden zum Vorlauf- und zum Fälligkeitszeitpunkt ausgelöst, höchstens einmal je
  Anlass, und hören nach Erledigung oder Löschung auf — jeweils durch Tests mit fixierter Uhr
  belegt.
- Erinnerungen sind pro Nutzer und Kind abschaltbar, der Vorlauf ist einstellbar.
- Die Übersicht trennt anstehende/überfällige Termine sichtbar von der Historie.
- Alle neuen Texte, einschließlich der Push-Inhalte, liegen in Deutsch und Englisch vor.
- Medikamente/Impfungen sind im Rohdaten-Export enthalten.
- Keine Regression in der bestehenden Testsuite.
