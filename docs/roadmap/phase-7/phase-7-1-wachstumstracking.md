# Teilphase 7.1: Wachstumstracking

**Bezug im PRD:** Abschnitt 4.2 (Wachstumstracking inkl. Perzentilen-Kurven)
**Übergeordnet:** [Phase 7 – Übersicht](README.md)
**Status:** Umgesetzt (2026-09-02). Alle Aufgaben und die Definition of Done sind erfüllt.
Einzige offene Nachverfolgung: die manuelle Real-Device-Verifikation der Touch-Long-Press- und
Tastaturbedienung des Diagramms — die automatisierten Tests laufen in jsdom (ohne echtes
`touch-action`/Layout). Als aufgeschobener manueller Punkt in
[`docs/known-issues.md`](../../known-issues.md) geführt, analog zu den Geräte-Checks aus Phase 4/5.

## Ziel

Eltern können Gewicht, Körperlänge/-größe und Kopfumfang ihres Kindes zu beliebigen Zeitpunkten
erfassen (typischerweise nach einer U-Untersuchung), sehen den zeitlichen Verlauf als Diagramm und
können diesen gegen die WHO-Wachstumsstandards einordnen („Gewicht liegt auf der 42. Perzentile").

Der Wert der Funktion liegt im **Einordnen**, nicht im reinen Protokollieren — ein Verlauf ohne
Referenzkurven beantwortet die eigentliche Elternfrage („ist das normal?") nicht. Die
Perzentilenberechnung ist daher Kern der Teilphase, nicht Beiwerk.

## Voraussetzungen

- MVP (Phasen 0–5) und Phase 6 (Design-System) sind abgeschlossen.
- Keine Abhängigkeit zu 7.2/7.3 — parallel bearbeitbar.

## Scope-Abgrenzung

**Enthalten:** Erfassung, Bearbeitung und Löschung von Messungen; WHO-Perzentilen für die drei
Messgrößen; Verlaufsdiagramm mit Referenzbändern; Übersichtskarte auf `ChildHome`; Rohdatenexport.

**Nicht enthalten:**
- Kein Echtzeit-Sync und kein Offline-Erfassen (siehe bereichsübergreifende Festlegung 2).
- Keine Aufnahme in die Tages-Timeline.
- Kein BMI/Gewicht-für-Länge im ersten Schritt (siehe „Offene Punkte").
- Keine Frühgeborenen-Korrektur des Alters (siehe „Offene Punkte").
- Keine medizinische Bewertung/Warnung („zu leicht") — die App zeigt Daten, sie diagnostiziert nicht.

## Fachliche Anforderungen

| ID | Anforderung |
|---|---|
| W-1 | Eine Wachstumsmessung besteht aus Zeitpunkt (Datum, ohne Uhrzeit-Zwang) und mindestens **einem** der drei Werte Gewicht, Länge/Größe, Kopfumfang. Eine Messung ohne jeden Wert ist ungültig. |
| W-2 | Alle drei Werte sind einzeln optional, damit ein Wiegen zu Hause (nur Gewicht) genauso erfassbar ist wie eine vollständige U-Untersuchung. |
| W-3 | Einheiten sind intern fix: Gewicht in Gramm (Ganzzahl), Länge und Kopfumfang in Millimetern (Ganzzahl). Die Eingabe-UI arbeitet mit den gewohnten Einheiten (kg mit einer Nachkommastelle bzw. cm mit einer Nachkommastelle) und rechnet um. Fließkomma-Speicherung wird bewusst vermieden. |
| W-4 | Werte werden gegen fachliche Plausibilitätsgrenzen validiert (z. B. Gewicht 200 g – 60 kg, Länge 200 mm – 1500 mm, Kopfumfang 200 mm – 700 mm). Grenzen sind benannte Konstanten, keine Magic Numbers, und werden serverseitig **und** im Formular geprüft. |
| W-5 | Der Messzeitpunkt darf nicht vor dem Geburtsdatum des Kindes und nicht in der Zukunft liegen. |
| W-6 | Mehrere Messungen am selben Tag sind erlaubt (z. B. Nachwiegen); es gibt keine Eindeutigkeitsregel pro Tag. |
| W-7 | Zu jeder Messung wird — wie bei `Event` — der erfassende Nutzer gespeichert und in der Liste angezeigt. |
| W-8 | Messungen sind bearbeitbar und löschbar. Löschen erfolgt hart (kein Soft-Delete), konsistent zum bestehenden Event-Verhalten. |
| W-9 | Zu jedem Messwert wird eine Perzentile und ein z-Score gegen die WHO-Wachstumsstandards berechnet und angezeigt, sofern Geschlecht und Alter des Kindes eine Zuordnung erlauben. |
| W-10 | Das Kindprofil erhält ein **optionales** Geschlechtsfeld (`FEMALE`/`MALE`/nicht angegeben), da die WHO-Referenzen geschlechtsspezifisch sind. Ohne Angabe werden Messwerte und Verlauf normal angezeigt, Perzentilen jedoch **nicht** — mit einem erklärenden Hinweis samt Link ins Kindprofil, nicht mit einer stillschweigenden Leerstelle und ausdrücklich nicht mit einem stillschweigend geratenen Default. |
| W-11 | Liegt das Alter außerhalb des Referenzbereichs (WHO-Standards decken 0–5 Jahre ab), wird der Verlauf ohne Referenzbänder und ohne Perzentilenangabe dargestellt, mit entsprechendem Hinweis. |
| W-12 | Das Verlaufsdiagramm zeigt je Messgröße die eigenen Messpunkte als Linie über dem Alter des Kindes sowie die WHO-Perzentilbänder (mindestens P3, P15, P50, P85, P97) als Hintergrund. |
| W-13 | Im Diagramm kann ein Zeitpunkt untersucht werden: Zeigegerät-Hover bzw. auf Touch ein Long-Press aktiviert einen Cursor entlang der Zeitachse, der Datum, Messwert und Perzentile des nächstgelegenen Messpunkts anzeigt. |
| W-14 | Das Diagramm ist ohne Zeigegerät bedienbar: Es ist fokussierbar, mit Pfeiltasten wird von Messpunkt zu Messpunkt navigiert, und der jeweils aktive Wert wird über eine `aria-live`-Region als Text ausgegeben. |
| W-15 | `ChildHome` erhält eine Karte „Wachstum" mit der jüngsten Messung (Wert, Perzentile, Alter zum Messzeitpunkt) und Link auf die Wachstumsseite. Ohne Messungen zeigt sie einen Empty State mit Erfassungs-Aufruf. |
| W-16 | Ohne Netzverbindung schlägt das Speichern sichtbar fehl; es wird kein Erfolgszustand vorgetäuscht. |
| W-17 | Die WHO unterscheidet bei der Körpermaß-Referenz zwischen liegend gemessener **Länge** (bis 24 Monate) und stehend gemessener **Größe** (ab 24 Monate). Die Anwendung wählt die passende Referenz automatisch aus dem Alter zum Messzeitpunkt (berechnet aus dem Geburtsdatum). |
| W-18 | Die automatische Wahl aus W-17 kann pro Messung **manuell überschrieben** werden, weil die tatsächliche Messmethode vom Alter abweichen kann. Die Überschreibung wird an der Messung gespeichert; ohne Überschreibung gilt dauerhaft die automatische Wahl (der Wert wird also **nicht** beim Anlegen eingefroren). |
| W-19 | Die verwendete Messmethode ist an der Messung und im Diagramm erkennbar, und die Umschaltung erklärt in einem kurzen Hinweis, warum sie existiert — sonst wirkt sie wie eine willkürliche Option. |

## Datenmodell

Neues Modell neben `Event`, **nicht** als Event-Typ (siehe bereichsübergreifende Festlegung 1):

```prisma
model GrowthMeasurement {
  id        String   @id @default(cuid())
  childId   String
  userId    String   // wer erfasst hat, analog Event.userId
  measuredAt DateTime
  weightGrams          Int?
  lengthMillimeters    Int?
  headCircumferenceMillimeters Int?
  // Manuelle Überschreibung der Messmethode für das Körpermaß (W-18):
  // 'LYING' | 'STANDING'. Null bedeutet "automatisch aus dem Alter
  // ableiten" (W-17) — kein fehlender Wert, sondern der Normalfall.
  // Als String gespeichert, kein Prisma-`enum` (SQLite-Connector, ADR-0002).
  lengthMeasurementPosition String?
  note      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  child Child @relation(fields: [childId], references: [id])
  user  User  @relation(fields: [userId], references: [id])

  @@index([childId, measuredAt])
}
```

Ergänzung am bestehenden `Child`-Modell:

```prisma
  // Optional; steuert die Auswahl der geschlechtsspezifischen WHO-Referenz.
  // Als String gespeichert (kein Prisma-`enum`), da der SQLite-Connector
  // keine Enums unterstützt — dieselbe Begründung wie bei
  // `Membership.role`/`Event.type`, siehe ADR-0002. Zugriff ausschließlich
  // über `toChildSex()`.
  sex String?
```

Hinweise:
- `updatedAt` ist vorhanden, **ohne** dass die Last-Write-Wins-Logik aus
  [ADR-0011](../../adr/0011-offline-edit-stop-and-last-write-wins.md) greift — ohne
  Offline-Pufferung gibt es keine verspäteten Schreibvorgänge. Das Feld dient nur der
  Nachvollziehbarkeit und dem Export.
- Migration: reines Hinzufügen (neue Tabelle, neue Nullable-Spalte) — keine Datenmigration nötig,
  bestehende Kindprofile bleiben ohne Geschlechtsangabe.

## Referenzdaten (WHO)

- Verwendet werden die **WHO Child Growth Standards (0–5 Jahre)** in Form der LMS-Parameter
  (`L`, `M`, `S`) je Indikator, Geschlecht und Alter: *weight-for-age*, *length/height-for-age*,
  *head-circumference-for-age*.
- *length/height-for-age* zerfällt in zwei Referenzsätze: **length-for-age** (liegend, 0–24 Monate)
  und **height-for-age** (stehend, 24–60 Monate). Die Auswahl trifft die Berechnung selbst anhand
  des Alters zum Messzeitpunkt (W-17), sofern die Messung keine manuelle Überschreibung trägt
  (W-18). Die Auswahlregel gehört in dieselbe reine Funktion wie die z-Score-Berechnung und
  bekommt eigene Testfälle um die 24-Monats-Grenze herum — inklusive des Falls „Überschreibung
  widerspricht dem Alter", der ausdrücklich erlaubt ist.
- Die Tabellen werden als statische Datendateien **im Repository mitgeliefert** und zur Laufzeit
  geladen — kein Netzwerkzugriff, passend zum Self-hosted-Prinzip.
- z-Score aus LMS:
  `z = ((X/M)^L − 1) / (L·S)` für `L ≠ 0`, sonst `z = ln(X/M) / S`.
  Die Perzentile ergibt sich aus dem z-Score über die Standardnormalverteilung.
- Das Alter für den Tabellen-Lookup wird in **vollen Tagen seit Geburtsdatum** bestimmt; zwischen
  Stützstellen wird nicht interpoliert, sondern die nächstliegende Stützstelle verwendet (die
  WHO-Tabellen liegen für die ersten Lebensjahre tagesgenau vor).
- Die Berechnung liegt als **reine, seiteneffektfreie Funktion** vor und wird gegen die
  veröffentlichten WHO-Beispielwerte getestet — das ist der fachlich kritischste Testfall dieser
  Teilphase.
- **Vor Umsetzung zu klären:** Lizenz-/Nutzungsbedingungen der WHO-Tabellen prüfen und die
  Herkunft samt Abrufdatum in der Datendatei dokumentieren.

## API

Alle Endpunkte unterhalb der bestehenden Haushalts-/Kind-Hierarchie, abgesichert wie die
bestehenden Event-Controller (`JwtAuthGuard`, `HouseholdMembershipGuard`, `CsrfGuard` bei
schreibenden Zugriffen):

| Methode | Pfad | Zweck |
|---|---|---|
| `POST` | `/households/:householdId/children/:childId/growth` | Messung anlegen |
| `GET` | `/households/:householdId/children/:childId/growth` | Messungen chronologisch, optional `from`/`to` |
| `PATCH` | `/households/:householdId/children/:childId/growth/:id` | Messung ändern |
| `DELETE` | `/households/:householdId/children/:childId/growth/:id` | Messung löschen |

- Die Antwort einer Messung enthält die **berechneten Perzentilen/z-Scores mit** (serverseitig
  berechnet), damit die Logik nicht in zwei Sprachen existiert und der PDF-Bericht aus 7.4 dieselben
  Werte nutzt.
- Die Perzentilbänder für das Diagramm werden über einen eigenen Lesepfad ausgeliefert
  (`GET .../growth/reference?indicator=…`), damit das Frontend die WHO-Tabellen nicht spiegeln muss.
- Zeitangaben als ISO-8601-Instants, konsistent zu `events/daily` — Tagesgrenzen bleiben
  Frontend-Sache (`lib/dayBoundaries.ts`).

## Frontend

- Neue Route `households/:householdId/children/:childId/growth` (Liste + Diagramm + Erfassung),
  eingehängt in `App.tsx` und in die Kind-Navigation.
- Diagramm mit **visx**: Achsen/Skalen/Flächen werden einzeln über die Design-Tokens gestylt, damit
  das Chart nicht als Fremdkörper wirkt. Tooltip über `@visx/tooltip`, Cursor-Position über
  `localPoint` aus `@visx/event` plus Bisector auf der Messreihe.
- Touch-Bedienung: unsichtbares Overlay-`<rect>` über der Zeichenfläche; `pointerdown` startet einen
  Long-Press-Timer, danach folgt der Cursor `pointermove`. Während des Scrubbens `touch-action: none`,
  damit die Seite nicht mitscrollt.
- `prefers-reduced-motion` wird respektiert (keine Einblende-Animationen der Kurven), analog
  `styles/animations.css`.
- Erfassungsformular auf Basis der bestehenden Primitives (`Card`, `Input`, `Button`, `Select`);
  Umschaltung zwischen den drei Messgrößen über `Tabs`.
- Neue Farb-Tokens für die drei Messgrößen in `design-system/tokens/color.json`, erzeugt über
  `bun run design-tokens:build` — keine hartkodierten Chart-Farben.
- Kindprofil (`ChildForm`/`ChildSettings`) bekommt das Geschlechtsfeld mit expliziter Option
  „keine Angabe".

## Zu treffende Entscheidungen (ADR-Kandidaten)

1. **Chart-Bibliothek visx** — festgelegt (vollständige Design-Token-Kontrolle, Tooltip-/Cursor-
   Anforderungen W-13/W-14 abgedeckt). Als ADR festhalten, inklusive der Absage an Recharts/Chart.js
   und der Bundle-Size-Auswirkung (Bundle-Größe ist nachrangig, wird aber gemessen und im
   ADR dokumentiert; Chart-Code wird als Lazy-Chunk geladen).
2. **Eigene Tabelle statt Event-Typ** — bereichsübergreifend entschieden; in dieser Teilphase als
   Addendum zu [ADR-0006](../../adr/0006-event-base-table-with-per-type-detail-tables.md)
   dokumentieren, da hier zum ersten Mal eine Kind-Domäne bewusst *neben* `Event` entsteht.
3. **Geschlechtsfeld am Kind** — Datenschutz-/Produktentscheidung (optionales Feld, nur für
   Perzentilen genutzt, nirgends sonst wirksam) kurz im ADR zu Punkt 2 mitfesthalten.

## Offene Punkte

- **Frühgeborenen-Korrektur:** Für Frühgeborene wird üblicherweise das korrigierte Alter verwendet.
  Bewusst zurückgestellt; erfordert ein Gestationsalter-Feld am Kind. Falls gewünscht, eigener
  Folgeschritt.
- **BMI-/Gewicht-für-Länge-Kurve:** WHO liefert auch diese Indikatoren. Zurückgestellt, bis die drei
  Basisgrößen stehen.
- ~~**Umgang mit „Länge" vs. „Größe"**~~ — entschieden: automatische Referenzwahl über das Alter,
  manuell pro Messung überschreibbar (W-17 bis W-19).

## Aufgaben

- [x] Datenmodell `GrowthMeasurement` und `Child.sex` inkl. Prisma-Migration und `toChildSex()`-Guard
- [x] Backend-Modul `growth` (Controller, Service, DTOs mit Validierung nach W-1 bis W-6)
- [x] WHO-Referenzdaten recherchieren, Lizenz klären, als statische Datendateien einpflegen, Herkunft dokumentieren
- [x] Perzentilen-/z-Score-Berechnung als reine Funktion inkl. Tests gegen veröffentlichte WHO-Beispielwerte
- [x] Automatische Länge-/Größe-Referenzwahl über das Alter samt manueller Überschreibung (W-17 bis W-19), inkl. Grenzfalltests um 24 Monate
- [x] Lesepfad für Perzentilbänder (`GET .../growth/reference`)
- [x] ADR: Chart-Bibliothek (visx) und Domänen-Modellierung neben `Event`
- [x] Chart-Komponente mit visx (Perzentilbänder, Messreihe, Tooltip, Long-Press-Cursor)
- [x] Tastatur-/Screenreader-Äquivalent des Cursors (W-14) inkl. Test
- [x] Erfassungs-/Bearbeitungs-UI und Messwertliste auf Basis der Design-System-Primitives
- [x] Geschlechtsfeld in der Kind-Profil-Verwaltung ergänzen
- [x] Übersichtskarte „Wachstum" auf `ChildHome` (W-15)
- [x] Farb-Tokens für die Messgrößen ergänzen und `design-tokens:build` ausführen
- [x] i18n-Texte (de/en) für alle neuen Oberflächen
- [x] Rohdaten-Export um Wachstumsmessungen erweitern (Abstimmung mit [7.4](phase-7-4-erweiterter-export-pdf.md))
- [x] Unit-/Komponententests: Validierung, Perzentilen, Chart-Interaktion, Empty-/Fehlerzustände

## Definition of Done

- [x] Messungen können erfasst, geändert, gelöscht und chronologisch eingesehen werden; Validierung
  greift server- und clientseitig.
- [x] Perzentilen stimmen nachweisbar mit den veröffentlichten WHO-Referenzwerten überein (Testfälle
  im Repo).
- [x] Fehlt die Geschlechtsangabe oder liegt das Alter außerhalb des Referenzbereichs, verhält sich die
  UI wie in W-10/W-11 beschrieben — ohne stillschweigende Annahmen.
- [x] Die Körpermaß-Referenz wird altersabhängig automatisch gewählt und lässt sich pro Messung
  überschreiben; die 24-Monats-Grenze ist durch Tests abgesichert.
- [x] Das Diagramm ist per Maus, Touch **und** Tastatur bedienbar; Kontraste und Fokus-Sichtbarkeit
  entsprechen dem in Phase 6 M4 etablierten Standard. (Automatisiert in jsdom abgedeckt; die
  Real-Device-Verifikation von Touch-Long-Press-Scrub und Tastaturnavigation ist als manueller
  Punkt in `docs/known-issues.md` geführt.)
- [x] Alle neuen Texte liegen in Deutsch und Englisch vor.
- [x] Wachstumsmessungen sind im Rohdaten-Export enthalten.
- [x] Keine Regression in der bestehenden Testsuite. (Voll grün: Backend 653 Unit + 101 e2e,
  Frontend 861 — Stand 2026-09-02.)
