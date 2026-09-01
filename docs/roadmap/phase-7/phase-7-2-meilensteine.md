# Teilphase 7.2: Meilensteine

**Bezug im PRD:** Abschnitt 4.2 (Meilensteine: erstes Lächeln, erste Schritte, Zähne …)
**Übergeordnet:** [Phase 7 – Übersicht](README.md)

## Ziel

Eltern halten Entwicklungsschritte ihres Kindes fest — aus einer vorgegebenen Liste typischer
Meilensteine oder als freien Eintrag — versehen mit Datum, Notiz und Fotos, und sehen sie als
chronologische Timeline.

Anders als das Tracking aus Phase 2 ist das kein Protokollier-, sondern ein **Erinnerungsfeature**:
Es wird selten geschrieben und oft gelesen, und der emotionale Wert steckt in der Rückschau. Die
Ansicht ist deshalb wichtiger als die Eingabegeschwindigkeit; die 2-Taps-Vorgabe aus Phase 2 gilt
hier ausdrücklich nicht.

## Voraussetzungen

- MVP (Phasen 0–5) und Phase 6 (Design-System) sind abgeschlossen.
- Bestehende Foto-Infrastruktur aus [ADR-0003](../../adr/0003-child-photo-storage-on-local-disk.md)
  (lokale Platte, Pfad in der DB, Auslieferung nur über einen authentifizierten Endpunkt) — wird
  wiederverwendet, nicht ersetzt.
- Keine Abhängigkeit zu 7.1/7.3 — parallel bearbeitbar.

## Scope-Abgrenzung

**Enthalten:** Vorlagenkatalog und freie Einträge, Erfassung/Bearbeitung/Löschung, Fotogalerie pro
Meilenstein, Timeline-Ansicht, Übersichtskarte auf `ChildHome`, Rohdatenexport.

**Nicht enthalten:**
- Kein Echtzeit-Sync, kein Offline-Erfassen (siehe bereichsübergreifende Festlegung 2).
- Keine Aufnahme in die Tages-Timeline.
- Keine Bildbearbeitung (Zuschneiden, Filter, Rotation).
- Kein Teilen nach außen (Link, Social Media, E-Mail-Versand).
- Keine Entwicklungs-Bewertung („Ihr Kind ist spät dran") — die Vorlagen nennen typische
  Altersspannen als Information, nicht als Soll.

## Fachliche Anforderungen

| ID | Anforderung |
|---|---|
| M-1 | Ein Meilenstein besteht aus Datum, einer Bezeichnung und optional Notiz und Fotos. Die Bezeichnung stammt entweder aus einer Vorlage oder ist frei eingegeben. |
| M-2 | Es existiert ein **Vorlagenkatalog** typischer Meilensteine (z. B. erstes Lächeln, erstes Umdrehen, erster Zahn, erstes Krabbeln, erste Schritte, erstes Wort). Vorlagen sind über einen stabilen Schlüssel identifiziert; die Anzeigetexte kommen aus den i18n-Ressourcen. Deutsche und englische Bezeichnungen sind Übersetzungen desselben Schlüssels, keine getrennten Kataloge. |
| M-3 | Jede Vorlage trägt eine typische Altersspanne (in Monaten) und eine Kategorie (z. B. Motorik, Sprache, Sozial, Körperlich). Beides dient der Sortierung/Gruppierung und der Einordnung, **nicht** einer Bewertung. |
| M-4 | Ein freier Eintrag ist gleichwertig: eigene Bezeichnung, optional eine Kategorie. |
| M-5 | Derselbe Vorlagen-Meilenstein kann pro Kind nur **einmal** erfasst werden; ein bereits erfasster wird im Vorlagenkatalog als erledigt markiert und öffnet beim Antippen den vorhandenen Eintrag statt einen neuen anzulegen. |
| M-6 | Das Datum darf nicht vor dem Geburtsdatum und nicht in der Zukunft liegen. Das Alter des Kindes zum Zeitpunkt des Meilensteins wird berechnet und angezeigt (z. B. „mit 7 Monaten"). |
| M-7 | Zu einem Meilenstein können mehrere Fotos gehören. Obergrenzen: max. 10 Fotos pro Meilenstein, je max. 2 MB, erlaubte Typen JPEG/PNG/WebP — dieselben Grenzen wie beim Kind-Foto (`child-photo.constants.ts`), als gemeinsam genutzte Konstanten statt einer zweiten Kopie. |
| M-8 | Fotos werden auf der lokalen Platte gespeichert (Muster aus ADR-0003), niemals als Pfad an Clients ausgeliefert und nur über einen authentifizierten, mitgliedschaftsgeprüften Endpunkt abgerufen. |
| M-9 | Einzelne Fotos sind löschbar; das Löschen eines Meilensteins löscht auch dessen Fotodateien von der Platte. Bleiben beim Löschen Dateien zurück (z. B. Fehler beim Dateisystemzugriff), darf das den Datenbank-Löschvorgang nicht scheitern lassen — der Fehler wird protokolliert. |
| M-10 | Die Reihenfolge der Fotos innerhalb eines Meilensteins ist stabil (Sortierindex), damit die Galerie nicht bei jedem Laden springt. |
| M-11 | Die Timeline zeigt alle Meilensteine eines Kindes chronologisch absteigend, mit Datum, Alter, Kategorie-Kennzeichnung und einer Fotovorschau. |
| M-12 | Der Vorlagenkatalog ist als zweite Ansicht erreichbar („Was kommt als Nächstes?"), gruppiert nach Altersspanne, mit Kennzeichnung der bereits erfassten Einträge. |
| M-13 | `ChildHome` erhält eine Karte „Meilensteine" mit dem zuletzt erfassten Meilenstein (Bezeichnung, Datum, Alter) und Link auf die Timeline. Ohne Einträge zeigt sie einen Empty State. |
| M-14 | Zu jedem Meilenstein wird der erfassende Nutzer gespeichert und angezeigt. |
| M-15 | Ohne Netzverbindung schlägt das Speichern sichtbar fehl; es wird kein Erfolgszustand vorgetäuscht. Insbesondere darf ein fehlgeschlagener Foto-Upload nicht als erfolgreich angezeigt werden. |

## Datenmodell

```prisma
model Milestone {
  id          String   @id @default(cuid())
  childId     String
  userId      String
  // Schlüssel aus dem Vorlagenkatalog (z. B. "FIRST_SMILE") oder null bei
  // einem freien Eintrag. Als String gespeichert, nicht als Prisma-`enum`
  // (SQLite-Connector, siehe ADR-0002); Zugriff über `toMilestoneTemplate()`.
  templateKey String?
  // Nur bei freien Einträgen gesetzt; bei Vorlagen kommt der Anzeigetext
  // aus den i18n-Ressourcen, damit ein Sprachwechsel bestehende Einträge
  // mit übersetzt.
  customTitle String?
  category    String?
  achievedAt  DateTime
  note        String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  child  Child            @relation(fields: [childId], references: [id])
  user   User             @relation(fields: [userId], references: [id])
  photos MilestonePhoto[]

  // Erzwingt M-5 auf Datenbankebene. Greift nur für Vorlagen; freie Einträge
  // haben `templateKey = null` und sind davon nicht betroffen.
  @@unique([childId, templateKey])
  @@index([childId, achievedAt])
}

model MilestonePhoto {
  id          String   @id @default(cuid())
  milestoneId String
  // Pfad relativ zu `resolveUploadsDir()`, analog `Child.photoPath`;
  // wird NIE an API-Clients ausgeliefert. Siehe ADR-0003.
  path        String
  mimeType    String
  sortIndex   Int
  createdAt   DateTime @default(now())

  milestone Milestone @relation(fields: [milestoneId], references: [id], onDelete: Cascade)

  @@index([milestoneId, sortIndex])
}
```

Hinweise:
- Die Eindeutigkeitsregel `@@unique([childId, templateKey])` behandelt in SQLite mehrere
  `NULL`-Werte als verschieden — freie Einträge kollidieren also nicht. Dieses Verhalten ist
  gewollt und gehört in einen Kommentar am Modell, weil es je nach Datenbank abweichen kann und
  beim späteren Wechsel auf PostgreSQL/MySQL erneut zu prüfen ist.
- Genau **eine** der beiden Angaben `templateKey`/`customTitle` muss gesetzt sein. Das ist auf
  Schemaebene nicht ausdrückbar und wird deshalb im Service/DTO geprüft — mit Test.
- Der Vorlagenkatalog selbst (Schlüssel, Kategorie, typische Altersspanne) liegt **im Code**, nicht
  in der Datenbank: Er ändert sich nur mit Releases, ist übersetzt und braucht keine
  Betreiber-Pflege.

## Speicherplatz

Fotos sind der erste Ort in dieser Anwendung, an dem Nutzerdaten unbegrenzt wachsen können — bei
10 Fotos × 2 MB pro Meilenstein und mehreren Kindern summiert sich das auf einer selbst
gehosteten Instanz spürbar. In dieser Teilphase wird das über die Obergrenzen aus M-7 begrenzt und
in der Betreiber-Dokumentation (Backup-/Volumen-Hinweis) erwähnt; eine Kontingentierung pro
Haushalt ist bewusst **nicht** Teil des Umfangs.

## API

| Methode | Pfad | Zweck |
|---|---|---|
| `GET` | `/households/:householdId/children/:childId/milestones` | Timeline, chronologisch |
| `POST` | `/households/:householdId/children/:childId/milestones` | Meilenstein anlegen |
| `PATCH` | `/households/:householdId/children/:childId/milestones/:id` | Ändern |
| `DELETE` | `/households/:householdId/children/:childId/milestones/:id` | Löschen (inkl. Fotodateien) |
| `POST` | `/households/:householdId/children/:childId/milestones/:id/photos` | Foto hochladen |
| `GET` | `/households/:householdId/children/:childId/milestones/:id/photos/:photoId` | Foto ausliefern |
| `DELETE` | `/households/:householdId/children/:childId/milestones/:id/photos/:photoId` | Foto löschen |

- Der Vorlagenkatalog wird **nicht** über die API ausgeliefert — er liegt im Frontend-Code und in
  den i18n-Ressourcen. Das Backend kennt nur die Schlüssel und validiert gegen sie.
- Upload analog `ChildController` (Multer-`limits`, `ParseFilePipeBuilder`, Endung aus dem
  validierten MIME-Typ, nie aus dem Dateinamen des Clients).

## Frontend

- Neue Routen: `…/children/:childId/milestones` (Timeline) und `…/children/:childId/milestones/new`
  (Erfassung, wahlweise aus Vorlage vorbelegt).
- Timeline auf Basis der bestehenden Timeline-Muster aus Phase 6 M3 (`Card`/`Badge`), aber mit
  eigenem Zuschnitt: Datum + Alter links, Fotovorschau rechts.
- Kategorie-Kennzeichnung über `Badge`-Varianten; die vier Kategorien brauchen eigene Farb-Tokens
  in `design-system/tokens/color.json` inklusive `*-foreground`-Gegenfarben, damit sie den in
  Phase 6 M4 eingeführten Kontrast-Regressionstest bestehen.
- Fotogalerie: Vorschau in der Timeline, Vollansicht über die vorhandene `Dialog`-Primitive.
- Upload-UI folgt der bestehenden Foto-Dropzone aus `ChildForm`, erweitert auf Mehrfachauswahl
  mit sichtbarem Fortschritt und Einzelfehler je Datei (eine fehlgeschlagene Datei darf die
  übrigen nicht verwerfen).

## Zu treffende Entscheidungen

1. **Vorlagenkatalog im Code statt in der Datenbank** — im Umsetzungs-PR kurz begründen; ein
   eigener ADR ist dafür vermutlich zu schwer, sofern die Entscheidung unstrittig bleibt.
2. **Anzeigetext bei Vorlagen nicht mitspeichern** (Übersetzung zur Laufzeit) — hat die Folge, dass
   ein späteres Umbenennen einer Vorlage rückwirkend alle Einträge umbenennt. Das ist gewollt
   (Sprachwechsel soll wirken), muss aber bewusst bestätigt sein.
3. **Kategorie-Farben** in die Design-Tokens aufnehmen — durchläuft den
   [Abgleichsprozess](../../design-system/reconciliation-process.md).

## Offene Punkte

- **Konkreter Vorlageninhalt:** Welche Meilensteine der Katalog enthält, ist noch nicht festgelegt.
  Vorschlag: 15–20 Einträge über die ersten drei Lebensjahre. Muss vor der Umsetzung inhaltlich
  abgestimmt werden — auch, weil die Auswahl implizit eine Aussage über „normale" Entwicklung
  trifft und deshalb bewusst zurückhaltend formuliert sein sollte.
- **Fotos im PDF-Bericht:** Ob Meilenstein-Fotos in den Arztbericht aus 7.4 gehören, ist dort zu
  entscheiden — vermutlich nein (Arztrelevanz gering, Dateigröße hoch).

## Aufgaben

- [ ] Datenmodell `Milestone`/`MilestonePhoto` inkl. Prisma-Migration
- [ ] Vorlagenkatalog definieren (Schlüssel, Kategorie, typische Altersspanne) und inhaltlich abstimmen
- [ ] Backend-Modul `milestone` (Controller, Service, DTOs, Validierung nach M-1 bis M-6)
- [ ] Foto-Upload/-Auslieferung/-Löschung unter Wiederverwendung der Konstanten und Muster aus ADR-0003
- [ ] Gemeinsame Foto-Konstanten aus `child-photo.constants.ts` extrahieren, statt sie zu duplizieren
- [ ] Timeline-Ansicht mit Kategorie-Kennzeichnung und Fotovorschau
- [ ] Vorlagenkatalog-Ansicht mit Erledigt-Kennzeichnung (M-12)
- [ ] Erfassungs-/Bearbeitungs-UI inkl. Mehrfach-Upload mit Einzelfehlerbehandlung
- [ ] Kategorie-Farb-Tokens ergänzen, `design-tokens:build` ausführen, Kontrasttest erweitern
- [ ] Übersichtskarte „Meilensteine" auf `ChildHome` (M-13)
- [ ] i18n-Texte (de/en) inkl. aller Vorlagenbezeichnungen
- [ ] Rohdaten-Export um Meilensteine erweitern (Abstimmung mit [7.4](phase-7-4-erweiterter-export-pdf.md))
- [ ] Betreiber-Dokumentation um den Speicherplatz-/Backup-Hinweis ergänzen
- [ ] Unit-/Komponententests: Vorlagen-Eindeutigkeit, Validierung, Foto-Grenzen, Löschkaskade, Fehlerzustände

## Definition of Done

- Meilensteine können aus Vorlagen und frei erfasst, geändert und gelöscht werden; die
  Eindeutigkeitsregel für Vorlagen greift nachweislich.
- Mehrere Fotos pro Meilenstein können hochgeladen, angezeigt und einzeln gelöscht werden; beim
  Löschen eines Meilensteins bleiben keine Dateien zurück.
- Fotos sind nur für Haushaltsmitglieder abrufbar; Dateipfade verlassen den Server nie.
- Timeline und Vorlagenkatalog sind vollständig übersetzt (de/en); Vorlagentexte kommen aus den
  i18n-Ressourcen, nicht aus der Datenbank.
- Kategorie-Farben erfüllen den WCAG-AA-Kontrast und sind über den Kontrast-Regressionstest
  abgesichert.
- Meilensteine sind im Rohdaten-Export enthalten.
- Keine Regression in der bestehenden Testsuite.
