# Phase 7: Version 2.0 – Erweiterungen (Teilphasen)

**Bezug im PRD:** Abschnitt 4.2 (Version 2.0 nach MVP)

Phase 7 war ursprünglich eine einzelne Sammelphase
([`phase-7-v2-erweiterungen.md`](../phase-7-v2-erweiterungen.md)) mit sechs thematisch unabhängigen
Themenblöcken. Da diese Blöcke unterschiedliche Schichten betreffen, unterschiedlich groß sind und
teilweise voneinander abhängen, ist Phase 7 hier in **sechs eigenständig lieferbare Teilphasen**
zerlegt. Jede Teilphase hat ein eigenes Dokument mit ausformulierten Anforderungen, Datenmodell-,
API- und UI-Vorgaben, zu treffenden Entscheidungen und einer eigenen Definition of Done.

Die ursprüngliche Phasendatei bleibt als Einstiegs-/Verweisdokument bestehen und enthält keine
Aufgabenliste mehr.

## Teilphasen

| # | Teilphase | Umfang | Status |
|---|---|---|---|
| 7.1 | [Wachstumstracking](phase-7-1-wachstumstracking.md) | Messwerte, WHO-Perzentilen, Verlaufsdiagramm | Umgesetzt (2026-09-02) |
| 7.2 | [Meilensteine](phase-7-2-meilensteine.md) | Vorlagen + freie Einträge, Fotogalerie, Timeline | Umgesetzt (2026-09-02) |
| 7.3 | [Medikamente & Impfungen](phase-7-3-medikamente-impfungen.md) | Erfassung, Fälligkeiten, Push-Erinnerungen | Umgesetzt (2026-09-03) |
| 7.4 | [Erweiterter Export (PDF-Bericht)](phase-7-4-erweiterter-export-pdf.md) | Arztbericht, austauschbarer Renderer | Teilweise umgesetzt (2026-09-03) — externer Renderer offen, siehe [Umsetzungsnotiz](phase-7-4-erweiterter-export-pdf.md#umsetzungsnotiz-reduzierter-scope) |
| 7.5 | [Erweiterte Rollen](phase-7-5-erweiterte-rollen.md) | Betreuer/Beobachter, Mitglieder- & Rollenverwaltung | Offen |
| 7.6 | [Nutzereinstellungen & Sprache](phase-7-6-nutzereinstellungen-sprache.md) | Settings-Bereich, persistierte Sprachwahl | Offen |

## Reihenfolge & Abhängigkeiten

```
7.1 Wachstum  ─┐
7.2 Meilensteine ─┼─> 7.4 PDF-Bericht ─> 7.5 Rollen ─> 7.6 Einstellungen & Sprache
7.3 Medizin   ─┘
```

- **7.1, 7.2 und 7.3 sind untereinander unabhängig** und können parallel bearbeitet werden. Sie
  teilen sich lediglich das in 7.1 erstmals etablierte Muster für „Nicht-Event-Domänen" (siehe
  unten) sowie die Erweiterung von `ChildHome` — dort ist eine gemeinsame Konvention für die
  Übersichtskarten abzustimmen, damit nicht drei unterschiedliche Kartenformate entstehen.
- **7.4 (PDF-Bericht) setzt fachlich auf 7.1–7.3 auf**, weil der Arztbericht genau diese Daten
  enthalten soll. Technisch könnte der Renderer-Unterbau vorgezogen werden; der Bericht selbst
  wäre dann aber zunächst inhaltsleer.
- **7.5 (Rollen) kommt bewusst zum Schluss** — siehe die Notiz zur Reihenfolge unten.
- **7.6** ist von allem unabhängig und kann jederzeit vorgezogen werden, wenn Kapazität frei ist.
  Wenn 7.3 einen eigenen Einstellungsbereich für Erinnerungen braucht, lohnt es sich, 7.6 vorher
  zu ziehen, damit 7.3 dort andockt statt eine eigene Einstellungsseite zu erfinden.

### Bewusste Entscheidung: Rollen zuletzt

Die PRD-Reihenfolge (Features vor Rollen) wird beibehalten. Der Preis dafür ist explizit
akzeptiert und wird hier festgehalten, damit er in 7.5 nicht überrascht:

Heute gilt im Backend faktisch **„Haushaltsmitgliedschaft = volles Schreibrecht"** — der
`HouseholdMembershipGuard` prüft nur, *ob* eine Mitgliedschaft existiert; `@RequireRole` ist bislang
nur an sehr wenigen Stellen gesetzt. Die Einführung von Betreuer/Beobachter erfordert deshalb ein
Audit **aller** schreibenden Endpunkte. Da 7.1–7.3 drei weitere Controller hinzufügen, wächst diese
Audit-Fläche um genau diese drei Module. 7.5 plant dieses Nachziehen daher explizit als Aufgabe
ein — die neuen Module werden in 7.1–7.3 ohne Rollenprüfung gebaut.

## Bereichsübergreifende Festlegungen (Ergebnis des Refinements)

Diese Entscheidungen gelten für alle Teilphasen und werden in den Einzeldokumenten nicht erneut
begründet:

1. **Eigene Tabellen statt neuer Event-Typen.** Wachstumsmessungen, Meilensteine und
   Medikamenten-/Impfeinträge bekommen jeweils eigene Prisma-Modelle neben `Event`. Sie werden
   **nicht** in die Event-Basistabelle aus [ADR-0006](../../adr/0006-event-base-table-with-per-type-detail-tables.md)
   aufgenommen. Grund: grundlegend andere Abfragemuster (Verlauf über Monate/Jahre bzw.
   Fälligkeiten in der Zukunft statt einer Tages-Timeline) und keine Nutzung der
   Timer-/Start-Ende-Semantik von `Event`. Die Kehrseite ist bewusst in Kauf genommen: die neuen
   Domänen erben **nichts** von der Event-Infrastruktur und müssen jede benötigte Querschnitts-
   funktion selbst mitbringen (siehe Punkt 2).
2. **Kein Echtzeit-Sync, kein Offline-First für die neuen Domänen.** Weder
   Socket.IO-Broadcasts ([ADR-0007](../../adr/0007-websocket-realtime-sync.md)) noch die
   IndexedDB-Optimistic-Engine und Sync-Queue
   ([ADR-0009](../../adr/0009-indexeddb-optimistic-create-engine.md)/
   [ADR-0010](../../adr/0010-offline-sync-queue-reconnect-retry.md)/
   [ADR-0011](../../adr/0011-offline-edit-stop-and-last-write-wins.md)) werden auf die neuen
   Domänen ausgedehnt. Begründung: Es sind keine Nachts-um-drei-Schnelleingaben, sondern seltene,
   geplante Erfassungen (Arzttermin, Meilenstein, Impfung) — der Aufwand pro Domäne stünde in
   keinem Verhältnis. Die UI muss deshalb bei fehlender Verbindung einen **ehrlichen Fehlerzustand**
   zeigen und darf nicht so aussehen, als sei gespeichert worden.
3. **Keine Aufnahme in die Tages-Timeline.** `GET .../events/daily` bleibt unverändert auf
   Fütterung/Schlaf/Windel beschränkt.
4. **Aber: Anzeige in der Übersicht.** Jede der drei Domänen ergänzt `ChildHome` (die Kind-
   Startseite mit den „Zeit seit …"-Karten) um genau eine kompakte Karte mit dem jeweils
   relevantesten Wert und einem Link auf die Detailseite. Ein globales Dashboard existiert seit
   Phase 6 M2 nicht mehr (bewusst entfernt zugunsten der Haushaltsliste als Startseite) — `ChildHome`
   ist die Übersicht.
5. **Aufnahme in den bestehenden Rohdaten-Export.** Die neuen Daten müssen zusätzlich zum
   PDF-Bericht auch über den vorhandenen Export aus Phase 5 abrufbar sein. Da dessen CSV-Spalten
   (`RawExportRow` in `apps/backend/src/export/export.service.ts`) ein stabiler, event-förmiger
   Vertrag sind, werden die neuen Domänen **nicht** in diese Spaltenliste gequetscht, sondern als
   je eigener Datensatz (eigener Endpunkt/eigene Datei) exportiert, der `toCsv` mit einer eigenen
   Spaltenliste wiederverwendet. Details in [7.4](phase-7-4-erweiterter-export-pdf.md).

   > **Nachtrag (2026-09-03, mit 7.4 umgesetzt):** Diese Festlegung wurde **nicht** so umgesetzt.
   > 7.1, 7.2 und 7.3 haben ihre Domäne jeweils an die bestehende flache Liste angehängt — ein
   > `recordKind`-Diskriminator plus eigene Spalten strikt am Ende von `RawExportRow`/`CSV_COLUMNS`,
   > die bestehenden Event-Spalten unverändert. Damit ist die eigentliche Anforderung (EXP-13:
   > „neue Daten abrufbar, Event-Spaltenliste unverändert") bereits erfüllt, und 7.4 hat die drei
   > zusätzlichen Endpunkte bewusst weggelassen: sie wären eine dritte Exportform für Daten, die
   > schon in der ersten stehen. Die domänenweise **Aufbereitung** liegt stattdessen im PDF-Bericht.
   > Begründung in [ADR-0015](../../adr/0015-pdf-report-generation.md#divergence-no-separate-per-domain-csv-endpoints).
6. **Rechte bleiben haushaltsweit.** Eine Rechtevergabe auf Ebene einzelner Kindprofile wird
   **nicht** eingeführt. Die PRD-Formulierung „Co-Parent: Schreibrecht auf zugewiesene Kindprofile"
   ist damit als „alle Kinder des Haushalts" zu lesen; die Präzisierung erfolgt in 7.5.
7. **Design-System ist verbindlich.** Jede neue Oberfläche baut auf den Primitives aus
   `apps/frontend/src/components/ui/` auf. Neue Farben/Icons (z. B. für Meilenstein-Kategorien)
   gehören in `design-system/tokens/*.json` und durchlaufen `bun run design-tokens:build`; neue
   Primitives brauchen Spec, Story und Test gemäß
   [`docs/design-system/reconciliation-process.md`](../../design-system/reconciliation-process.md).
8. **i18n ist Teil jeder Teilphase.** Alle neuen Texte kommen nach `de.json`/`en.json`. Kein
   hartkodierter Anzeigetext, auch nicht in Vorlagenlisten (Meilenstein-Vorlagen, Impfnamen).

## Nicht enthalten

Die Vision-Punkte aus PRD 4.3 (Smartwatch, Smart-Home-Integration, KI-Musteranalyse) bleiben
unverplant. Ebenfalls nicht Teil von Phase 7: die aus früheren Phasen offenen manuellen
Geräte-Verifikationen, die in [`docs/known-issues.md`](../../known-issues.md) geführt werden.
