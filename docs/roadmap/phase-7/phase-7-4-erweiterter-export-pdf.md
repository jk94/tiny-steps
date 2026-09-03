# Teilphase 7.4: Erweiterter Export (PDF-Bericht)

**Bezug im PRD:** Abschnitt 4.2 (Erweiterter Export – PDF-Bericht für Kinderarzt)
**Übergeordnet:** [Phase 7 – Übersicht](README.md)

## Ziel

Eltern erzeugen für einen frei wählbaren Zeitraum einen lesbaren PDF-Bericht, den sie zum
Kinderarzttermin mitnehmen können — mit Wachstumsverlauf, Meilensteinen, Medikamenten/Impfungen und
einer Zusammenfassung des Alltags-Trackings.

Der bestehende Export aus Phase 5 liefert Rohdaten (JSON/CSV) für Archiv- und Weiterverarbeitungs-
zwecke. Der PDF-Bericht ist etwas anderes: ein **kuratiertes, für Menschen gestaltetes Dokument**.
Beide Wege bleiben nebeneinander bestehen.

## Voraussetzungen

- [7.1](phase-7-1-wachstumstracking.md), [7.2](phase-7-2-meilensteine.md) und
  [7.3](phase-7-3-medikamente-impfungen.md) sind abgeschlossen — sie liefern den Inhalt. Der
  Renderer-Unterbau ließe sich vorziehen, der Bericht wäre dann aber weitgehend leer.
- Bestehendes `export`-Modul (`apps/backend/src/export/`) aus Phase 5.
- Design-Tokens aus Phase 6 und das Token-Build-Skript (`bun run design-tokens:build`).

## Scope-Abgrenzung

**Enthalten:** PDF-Berichtserzeugung mit Zeitraum- und Abschnittsauswahl, austauschbarer Renderer
(eingebaut/extern), Erweiterung des Rohdaten-Exports um die neuen Domänen aus 7.1–7.3.

**Nicht enthalten:**
- Kein E-Mail-Versand des Berichts, keine Freigabe-Links.
- Keine Vorlagenverwaltung/Anpassung des Berichtslayouts durch Betreiber oder Nutzer.
- Keine digitale Signatur, kein PDF/A.
- Keine Meilenstein-Fotos im Bericht (Arztrelevanz gering, Dateigröße hoch) — bewusst weggelassen.

## Fachliche Anforderungen

| ID | Anforderung |
|---|---|
| EXP-1 | Der Bericht wird pro Kind für einen frei wählbaren Zeitraum erzeugt; der Zeitraum ist Pflichtangabe mit sinnvoller Vorbelegung (z. B. die letzten drei Monate). |
| EXP-2 | Die enthaltenen Abschnitte sind einzeln an-/abwählbar: Stammdaten, Wachstum, Meilensteine, Medikamente/Impfungen, Tracking-Zusammenfassung. |
| EXP-3 | Der Bericht enthält im Kopf: Kindname, Geburtsdatum, Alter zum Berichtsdatum, Berichtszeitraum und Erstellungsdatum. |
| EXP-4 | Der Wachstumsabschnitt enthält eine Messwerttabelle (Datum, Alter, Werte, Perzentile) und die Verlaufskurve mit WHO-Perzentilbändern. |
| EXP-5 | Der Meilensteinabschnitt listet die im Zeitraum erreichten Meilensteine mit Datum und Alter. |
| EXP-6 | Der Medizinabschnitt listet erfolgte Gaben/Impfungen im Zeitraum sowie alle noch anstehenden Termine — Letztere bewusst zeitraumunabhängig, weil sie beim Arztbesuch relevant sind. |
| EXP-7 | Die Tracking-Zusammenfassung enthält aggregierte Kennzahlen aus Fütterung/Schlaf/Windel (z. B. Durchschnitte pro Tag im Zeitraum), **keine** Einzelereignisliste — die gehört in den CSV-Export, nicht in einen Arztbericht. |
| EXP-8 | Der Bericht ist vollständig in der aktiven Oberflächensprache; die Sprache wird beim Erzeugen mitgegeben, nicht serverseitig geraten. |
| EXP-9 | Der Bericht folgt sichtbar dem Design-System der Anwendung (Farben, Typografie, Abstände aus den Design-Tokens) und wirkt nicht wie ein fremdes Dokument. |
| EXP-10 | Es gibt **zwei austauschbare Renderer**: einen eingebauten, ohne zusätzliche Systemabhängigkeit, und einen externen HTTP-Dienst. Der eingebaute ist der Standard. |
| EXP-11 | Die Renderer-Wahl erfolgt über die Konfiguration nach dem etablierten Muster: Code-Default → YAML-Konfiguration → Umgebungsvariable. Ohne jede Konfiguration läuft der eingebaute Renderer. |
| EXP-12 | Ist der externe Renderer konfiguriert, aber nicht erreichbar, schlägt die Berichtserzeugung mit einer verständlichen Fehlermeldung fehl. Es wird **nicht** stillschweigend auf den eingebauten zurückgefallen — sonst bekäme der Nutzer unbemerkt ein anders aussehendes Dokument. |
| EXP-13 | Der bestehende Rohdaten-Export wird um die Daten aus 7.1–7.3 erweitert, ohne die bestehende event-förmige CSV-Spaltenliste zu verändern. |
| EXP-14 | Die Berichtserzeugung ist wie die bestehenden Export-Endpunkte lesend abgesichert (Mitgliedschaft im Haushalt erforderlich). |
| EXP-15 | Die Erzeugung eines Berichts über einen langen Zeitraum darf den Server nicht blockieren; Laufzeit und Speicherbedarf sind zu messen und die Zeitraumlänge nötigenfalls zu begrenzen. |

## Architektur: austauschbarer Renderer

Das Kernproblem: Der eingebaute Weg kann kein HTML, ein browserbasierter Dienst kein JSX — ohne
Gegenmaßnahme würde das Berichtslayout zweimal gepflegt.

Gegenmaßnahme ist eine **Zwischendarstellung**. Der Export-Service erzeugt genau einmal ein
`ReportDocument`: eine serialisierbare Beschreibung des Berichts aus wenigen Blocktypen
(Dokumentkopf, Abschnittsüberschrift, Kennzahlenblock, Tabelle, Diagramm-SVG, Fließtext). Jeder
Renderer bildet nur diese Blocktypen ab. Damit existieren Datenauswahl, Zeitraumlogik,
Aggregation, Perzentilenberechnung und Reihenfolge **einmal**; doppelt gepflegt wird nur die
Darstellung einer kleinen, stabilen Blockmenge.

```
ExportService
   └─> ReportDocumentBuilder ──> ReportDocument (Blockliste, renderer-neutral)
                                      ├─> ReactPdfRenderer   (Standard, reines Node)
                                      └─> RemoteHtmlRenderer (HTML → HTTP → PDF-Dienst)
```

- **`ReactPdfRenderer` (Standard):** `@react-pdf/renderer` — React-JSX auf einer eigenen
  Layout-Engine, kein Browser, kein Systembinary, läuft im bestehenden Node-Container. Die
  Design-Tokens werden als **zusätzliches Ausgabeziel des vorhandenen Token-Build-Skripts** in ein
  react-pdf-`StyleSheet` erzeugt — dieselbe Quelle der Wahrheit wie CSS und Markdown-Styleguide,
  kein handgepflegtes Farbduplikat.
- **`RemoteHtmlRenderer` (optional):** rendert das `ReportDocument` zu HTML mit den bestehenden
  CSS-Custom-Properties und schickt es an einen konfigurierten HTTP-Endpunkt, der PDF
  zurückliefert. Als Gegenstelle ist **kein Eigenbau nötig** — [Gotenberg](https://gotenberg.dev)
  ist ein fertiges OSS-Docker-Image für genau diesen Zweck und lässt sich als optionaler zweiter
  Service in `docker-compose.yml` aufnehmen. Chromium bleibt damit außerhalb des Anwendungs-Images.

### Konfiguration

```yaml
# Optional. Ohne diesen Abschnitt läuft der eingebaute Renderer.
export:
  pdf:
    # builtin | remote
    renderer: builtin
    # Nur bei renderer: remote. Über PDF_RENDERER_URL überschreibbar.
    remoteUrl: "http://gotenberg:3000/forms/chromium/convert/html"
```

Der Code-Default (`builtin`) steht im Code, nicht in der YAML-Datei; die Beispielkonfiguration zeigt
den Abschnitt auskommentiert. Die Validierung erfolgt beim Start über das bestehende
Konfigurationsschema und schlägt fehl, wenn `renderer: remote` ohne URL gesetzt ist (fail-fast wie
im Bestand).

### Datenschutz-Hinweis

Der externe Renderer bekommt **Gesundheitsdaten eines Kindes** zu sehen. Solange er wie vorgesehen
im selben Compose-Netzwerk läuft, verlässt nichts die Installation. Ein auf einen fremden Host
gerichteter Endpunkt wäre jedoch eine echte Ausnahme vom Self-hosted-Prinzip — vergleichbar mit der
FCM/APNs-Ausnahme in [ADR-0012](../../adr/0012-capacitor-native-wrapper.md) und ebenso ausdrücklich
zu dokumentieren, sowohl im ADR als auch im Kommentar der Beispielkonfiguration.

## Diagramm im Bericht

Die Wachstumskurve entsteht in 7.1 mit visx, also als React-SVG. Für den Bericht wird sie
serverseitig zu einem SVG-String gerendert und als Diagrammblock in das `ReportDocument`
aufgenommen — dieselbe Komponente, keine zweite Chart-Implementierung. Zwei Punkte sind dabei
früh zu prüfen (siehe „Offene Punkte"): der SVG-Umfang, den `@react-pdf/renderer` unterstützt, und
die Frage, ob die Chart-Komponente ohne Browser-APIs (Messungen, Tooltips) rendert.

## API

| Methode | Pfad | Zweck |
|---|---|---|
| `GET` | `/households/:householdId/children/:childId/export/report.pdf` | Bericht erzeugen; Query: `from`, `to`, `sections`, `locale` |
| `GET` | `/households/:householdId/children/:childId/export/growth.csv` | Wachstumsmessungen als CSV |
| `GET` | `/households/:householdId/children/:childId/export/milestones.csv` | Meilensteine als CSV |
| `GET` | `/households/:householdId/children/:childId/export/health.csv` | Medikamente/Impfungen als CSV |

Die neuen CSV-Endpunkte nutzen die vorhandene `toCsv`-Funktion mit je eigener, explizit
aufgeführter Spaltenliste — genau wie die bestehende `CSV_COLUMNS`-Konstante, damit auch ein leerer
Export eine stabile Kopfzeile hat. Die bestehende `RawExportRow`-Spaltenliste bleibt unangetastet;
der vorhandene JSON-Export wird um die neuen Datensätze als eigene Schlüssel erweitert.

## Frontend

- Die bestehende Export-Seite (`…/children/:childId/settings/export`, `pages/Export.tsx`) wird um
  einen Abschnitt „Bericht" erweitert — keine neue Route, damit alle Ausgabewege an einer Stelle
  liegen.
- Zeitraumwahl mit Schnellauswahl (letzter Monat, letzte 3 Monate, letztes Jahr, frei) und
  Abschnitts-Checkboxen.
- Während der Erzeugung ein Ladezustand mit `Skeleton`/Button-Pending-State; bei Fehlschlag eine
  verständliche Meldung, die zwischen „Dienst nicht erreichbar" und „keine Daten im Zeitraum"
  unterscheidet.

## Zu treffende Entscheidungen (ADR-Kandidaten)

1. **ADR „PDF-Berichtserzeugung"** — dokumentiert: Ablehnung von Chromium im Anwendungsimage, Wahl
   von `@react-pdf/renderer` als Standard, die `ReportDocument`-Zwischendarstellung als Mittel gegen
   doppelte Layoutpflege, den optionalen externen Renderer samt Gotenberg-Hinweis und die
   Datenschutz-Ausnahme.
2. **Token-Build-Skript um ein react-pdf-Ausgabeziel erweitern** — durchläuft den
   [Abgleichsprozess](../../design-system/reconciliation-process.md).
3. **Getrennte CSV-Dateien statt erweiterter Spaltenliste** — kurz im PR begründen; die Alternative
   (ein ZIP mit mehreren CSVs statt mehrerer Endpunkte) ist vor der Umsetzung zu entscheiden.

## Offene Punkte

- **SVG-Fähigkeiten von `@react-pdf/renderer` prüfen** — die Rückfallebene ist entschieden: Reicht
  der unterstützte Umfang nicht, wird das Diagramm serverseitig gerastert und als Bild eingebettet
  (schlechtere Druckqualität, dafür sicher). Offen ist nur, welcher der beiden Wege es wird; der
  Prototyp gehört an den **Anfang** der Teilphase, nicht ans Ende.
- **Schriftarten:** react-pdf braucht eingebettete Schriftdateien. Ob die Schrift des Design-Systems
  dafür lizenzrechtlich und technisch geeignet ist, ist zu prüfen.
- **Laufzeitgrenze:** Ob und ab welcher Zeitraumlänge die Erzeugung begrenzt oder in den
  Hintergrund verlagert werden muss, entscheidet die Messung aus EXP-15.

## Aufgaben

- [x] Prototyp: Diagramm-SVG durch `@react-pdf/renderer` (früh, entscheidet EXP-4); bei zu geringem SVG-Umfang auf serverseitig gerastertes Bild ausweichen
- [x] ADR „PDF-Berichtserzeugung" schreiben
- [x] `ReportDocument`-Zwischendarstellung und `ReportDocumentBuilder` im `export`-Modul
- [x] Datenbeschaffung/Aggregation je Abschnitt (Wachstum, Meilensteine, Medizin, Tracking-Kennzahlen)
- [x] `ReactPdfRenderer` inkl. Schrift-Einbettung
- [x] Token-Build-Skript um react-pdf-`StyleSheet`-Ausgabe erweitern
- [ ] `RemoteHtmlRenderer` inkl. HTML-Ausgabe des `ReportDocument` — **zurückgestellt**, siehe Umsetzungsnotiz
- [ ] Konfigurationsschema um `export.pdf` erweitern (fail-fast bei `remote` ohne URL) und `config.example.yml` kommentiert ergänzen — **zurückgestellt**, siehe Umsetzungsnotiz
- [ ] Optionalen Gotenberg-Service in `docker-compose.yml` dokumentieren (auskommentiert, nicht aktiv) — **zurückgestellt**, siehe Umsetzungsnotiz
- [x] PDF-Endpunkt inkl. Zeitraum-/Abschnitts-/Sprachparametern
- [x] ~~Neue CSV-Endpunkte für Wachstum, Meilensteine, Medizin~~; JSON-Export erweitern — bereits durch 7.1–7.3 erfüllt, siehe Umsetzungsnotiz (1)
- [x] Export-Seite im Frontend um den Berichtsabschnitt erweitern
- [x] i18n-Texte (de/en) für Oberfläche **und** Berichtsinhalte
- [x] Laufzeit-/Speichermessung für lange Zeiträume (EXP-15)
- [x] Tests: `ReportDocument`-Aufbau je Abschnittsauswahl (Renderer-Auswahl aus der Konfiguration und Fehlerverhalten bei nicht erreichbarem externen Dienst entfallen mit dem zurückgestellten Renderer; CSV-Serialisierung ist unverändert durch die Bestandstests abgedeckt)

## Definition of Done

- [x] Ein PDF-Bericht kann für einen wählbaren Zeitraum und wählbare Abschnitte erzeugt und
  heruntergeladen werden; er enthält alle Daten aus 7.1–7.3 in lesbarer Form.
- [x] Der Bericht ist optisch erkennbar dasselbe Design-System wie die Anwendung und liegt in Deutsch
  und Englisch vor.
- [x] Ohne zusätzliche Konfiguration funktioniert die Erzeugung mit dem eingebauten Renderer; kein
  Chromium im Anwendungsimage.
- [ ] **Offen:** Der externe Renderer ist per Konfiguration aktivierbar, fällt bei Nichterreichbarkeit
  sichtbar aus und erzeugt inhaltlich denselben Bericht.
- [x] Wachstum, Meilensteine und Medizin sind zusätzlich über den Rohdaten-Export abrufbar; die
  bestehende Event-CSV-Spaltenliste ist unverändert. (Bereits durch 7.1–7.3 erfüllt — siehe
  Umsetzungsnotiz (1).)
- [ ] **Offen:** Die Datenschutz-Ausnahme beim externen Renderer ist im ADR und in der
  Beispielkonfiguration dokumentiert. (Im ADR als *beabsichtigte künftige Form* beschrieben; die
  Beispielkonfiguration hat noch keinen `export.pdf`-Abschnitt, weil es noch nichts zu konfigurieren
  gibt.)
- [x] Keine Regression in der bestehenden Testsuite.

## Umsetzungsnotiz (reduzierter Scope)

Umgesetzt am 2026-09-03. Der Kern der Teilphase steht — Bericht erzeugen, herunterladen, in beiden
Sprachen, im Design-System, ohne Chromium. Zurückgestellt wurde alles, was ausschließlich den
**zweiten** Renderer betrifft. Volle Begründung in
[ADR-0015](../../adr/0015-pdf-report-generation.md).

### (1) Abweichung: keine getrennten CSV-Endpunkte

Die API-Tabelle oben nennt `growth.csv`, `milestones.csv` und `health.csv`; sie wurden **nicht**
gebaut, und EXP-13 ist trotzdem erfüllt.

7.1, 7.2 und 7.3 haben ihre Domäne jeweils an die bestehende flache Exportliste angehängt: ein
`recordKind`-Diskriminator plus eigene Spalten strikt am Ende von `RawExportRow`/`CSV_COLUMNS`, die
vorhandenen Event-Spalten unangetastet. Wachstum, Meilensteine und Medikamente/Impfungen sind damit
bereits über JSON **und** CSV abrufbar — genau das, was EXP-13 verlangt. Drei weitere Endpunkte
jetzt nachzuziehen hieße, eine dritte Exportform (eine flache Datei, drei schmale Dateien, ein
Bericht) für Daten einzuführen, die schon in der ersten stehen, und zwei überlappende CSV-Formate
dauerhaft synchron zu halten. `export.service.ts` bleibt deshalb in dieser Teilphase unverändert.
Die domänenweise **Aufbereitung** liegt stattdessen im PDF-Bericht.

Damit ist auch [Festlegung 5](README.md#bereichsübergreifende-festlegungen-ergebnis-des-refinements)
der Phasenübersicht überholt; dort ist ein entsprechender Nachtrag ergänzt.

### (2) Zurückgestellt auf eine Folgeaufgabe

- **`RemoteHtmlRenderer` inkl. HTML-Ausgabe des `ReportDocument`** (EXP-10, zweiter Renderer)
- **Gotenberg-Service (auskommentiert) in `docker-compose.yml`**
- **`export.pdf`-Konfigurationsabschnitt** inkl. Schema-Validierung und `config.example.yml`
  (EXP-11/EXP-12)

Der Grund ist derselbe für alle drei: **solange es nur einen Renderer gibt, wäre
`renderer: builtin | remote` ein Konfigurationsschlüssel mit genau einem zulässigen Wert** — also
Konfiguration, die eine Absicht dokumentiert statt Verhalten zu steuern, samt Schema, Tests und
Beispielkonfiguration, die alle nichts prüfen. Die Konfiguration entsteht sinnvoll erst zusammen mit
dem Renderer, den sie auswählt.

Die Vorarbeit dafür ist bewusst geleistet und additiv nutzbar:

- `ReportDocument` ist renderer-neutral (keine `@react-pdf/renderer`-Typen im Builder oder in den
  Typen), sieben stabile Blocktypen, alle Werte bereits formatiert und übersetzt.
- Der aktive Renderer hängt am Injection-Token `REPORT_RENDERER` in `report.module.ts`; ein Wechsel
  ist ein Provider-Eintrag.
- Die Frontend-Fehlerbehandlung unterscheidet heute nur „keine Daten im Zeitraum" von einem
  allgemeinen Fehler. Der dritte Fall „Dienst nicht erreichbar" fehlt **absichtlich** — mit einem
  Codekommentar an der Stelle —, weil es den Dienst noch nicht gibt.

### (3) Weitere Festlegungen dieser Umsetzung

- **Diagramm als SVG, nicht gerastert.** Der Prototyp am Anfang der Teilphase hat gezeigt, dass
  `@react-pdf/renderer` SVG-Strings als Vektoren zeichnet. Die vorbereitete Rückfallebene
  (serverseitiges Rastern) wurde nicht gebraucht; die Abhängigkeit ist nie hinzugekommen.
- **Kein zweites Chart.** Der SVG-Rumpf des Wachstumsdiagramms liegt jetzt im Workspace-Paket
  `packages/growth-chart-static/`, das Frontend legt seine interaktiven Teile darüber.
- **Zeitraum hart begrenzt (EXP-15).** `MAX_REPORT_PERIOD_DAYS = 731`. Die Messung
  (`bun run --cwd apps/backend report:bench`, Tabelle im ADR) ergab ~80–115 ms und ~12–23 MB über
  den gesamten Bereich, also kein Bedarf für Hintergrundverarbeitung.
- **Vollständig leerer Bericht → 422 `REPORT_EMPTY_PERIOD`** statt eines leeren PDFs; ein
  *teilweise* leerer Bericht wird erzeugt und weist die leeren Abschnitte ausdrücklich aus.
