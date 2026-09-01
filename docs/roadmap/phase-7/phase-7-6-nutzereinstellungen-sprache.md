# Teilphase 7.6: Nutzereinstellungen & Sprachumschaltung

**Bezug im PRD:** Abschnitt 4.2 (Mehrsprachigkeit), [ADR-0005](../../adr/0005-i18n-infrastructure-brought-forward.md)
**Übergeordnet:** [Phase 7 – Übersicht](README.md)

## Ziel

Die Profilseite wird zu einem echten Einstellungsbereich ausgebaut, in dem unter anderem die
Oberflächensprache gewählt wird. Die Wahl wird am Benutzerkonto gespeichert und gilt damit auf
jedem Gerät — der provisorische Sprachumschalter in der App-Shell entfällt.

Das ist der letzte offene Punkt der Mehrsprachigkeit aus Phase 7. Die i18n-Infrastruktur und die
Übersetzung der bestehenden Oberflächen sind bereits erledigt (siehe ADR-0005); offen ist
ausdrücklich nur der Ort, an dem die Sprache dauerhaft gewählt wird.

## Voraussetzungen

- Phase 6 (Design-System) ist abgeschlossen; bestehende Seite `pages/Profile.tsx` mit dem
  Namensformular.
- Bestehende Benachrichtigungseinstellungen aus Phase 5 (`NotificationController`).
- Unabhängig von 7.1–7.5 und jederzeit vorziehbar. **Empfehlung:** vor
  [7.3](phase-7-3-medikamente-impfungen.md) umsetzen, damit deren Erinnerungs-Einstellungen direkt
  hier andocken statt eine provisorische Stelle zu bekommen, die später umgebaut wird.

## Scope-Abgrenzung

**Enthalten:** Ausbau der Profilseite zu einem gegliederten Einstellungsbereich, serverseitig
gespeicherte Sprachwahl, Entfernen des provisorischen Umschalters, Einbindung der vorhandenen
Benachrichtigungseinstellungen.

**Nicht enthalten:**
- Keine weiteren Sprachen über Deutsch und Englisch hinaus.
- Kein Übersetzungs-Workflow/Redaktionssystem — Übersetzungen bleiben JSON-Dateien im Repository.
- Keine Zeitzonen-Einstellung pro Nutzer (bleibt die Server-Lokalzeit-Vereinfachung aus Phase 5;
  sie ist in [7.3](phase-7-3-medikamente-impfungen.md) als bekannte Einschränkung erfasst).
- Keine Konto-Löschung/Datenexport nach DSGVO-Muster.
- Kein E-Mail- oder Passwortwechsel, sofern nicht bereits vorhanden.

## Fachliche Anforderungen

| ID | Anforderung |
|---|---|
| SET-1 | Die Profilseite wird in klar getrennte Abschnitte gegliedert: **Konto** (Name, E-Mail als Anzeige), **Sprache**, **Benachrichtigungen**. |
| SET-2 | Der Abschnitt Benachrichtigungen bindet die bestehenden Einstellungen aus Phase 5 ein (Fütterungs-Erinnerung, Tageszusammenfassung), statt sie an anderer Stelle zu belassen. Da diese pro Kind gelten, ist eine Kind-Auswahl nötig — die Gruppierung ist Teil dieser Teilphase. |
| SET-3 | Die Sprachwahl bietet Deutsch und Englisch sowie die Option **„Sprache des Geräts"** an. Letztere ist der Standard für bestehende und neue Konten und entspricht dem heutigen Verhalten (Browser-Erkennung). |
| SET-4 | Die gewählte Sprache wird am Benutzerkonto gespeichert und beim Anmelden auf jedem Gerät angewandt. |
| SET-5 | Reihenfolge der Auflösung: gespeicherte Nutzereinstellung → Gerätesprache → Rückfallsprache Deutsch. Die vorhandene `localStorage`-Erkennung bleibt als Vorabwert erhalten, damit die Oberfläche vor dem Laden des Nutzerprofils nicht kurz in der falschen Sprache aufblitzt; nach dem Laden gewinnt die Kontoeinstellung. |
| SET-6 | Die Umschaltung wirkt sofort, ohne Neuladen der Seite. |
| SET-7 | Der provisorische Sprachumschalter in `Layout.tsx` (inklusive der beiden Flaggen-Icons) wird entfernt. Die Icons bleiben nur erhalten, wenn sie im neuen Einstellungsbereich weiterverwendet werden. |
| SET-8 | Nicht angemeldete Seiten (Login/Registrierung) verhalten sich weiter wie bisher — Gerätesprache mit Rückfall auf Deutsch. Ob dort ein Umschalter nötig ist, siehe „Offene Punkte". |
| SET-9 | Der Einstellungsbereich ist über die vorhandene Navigation erreichbar; es entsteht kein zweiter Weg zu denselben Einstellungen. |
| SET-10 | Alle Texte des Einstellungsbereichs liegen in Deutsch und Englisch vor; Sprachnamen werden in der jeweiligen Sprache selbst angezeigt („Deutsch", „English"), nicht übersetzt. |
| SET-11 | Speichern zeigt Erfolg und Fehlschlag sichtbar an, im Muster der bestehenden Formulare (`role="status"`-Zeile plus Inline-Fehler, wie in `Profile`/`ChildSettings`). |
| SET-12 | Die Route heißt künftig `settings`; die bisherige Route `profile` bleibt als Weiterleitung dorthin bestehen, damit gespeicherte Links und Lesezeichen nicht ins Leere laufen. |

## Datenmodell

Eine Spalte am bestehenden `User`-Modell:

```prisma
  // Bevorzugte Oberflächensprache ('de' | 'en'). Null bedeutet ausdrücklich
  // "Sprache des Geräts verwenden" — kein fehlender Wert, sondern eine
  // gültige Wahl (SET-3). Als String gespeichert, kein Prisma-`enum`
  // (SQLite-Connector, siehe ADR-0002); Zugriff über `toLocale()`.
  locale String?
```

Migration: reines Hinzufügen einer Nullable-Spalte, keine Datenmigration — bestehende Konten stehen
damit automatisch auf „Sprache des Geräts", also auf dem heutigen Verhalten.

## API

Der vorhandene `PATCH /auth/me` (heute nur für den Anzeigenamen) wird um das Feld `locale`
erweitert; die Antwort des `me`-Endpunkts liefert es mit aus, damit das Frontend die Sprache direkt
nach dem Anmelden anwenden kann. **Kein neuer Endpunkt** — die Einstellung gehört zum Konto, das
bereits über diesen Weg gepflegt wird.

Validierung: nur `de`, `en` oder `null` werden angenommen; die erlaubten Werte kommen aus derselben
Konstante, die auch `supportedLngs` in `src/i18n/index.ts` speist, damit Backend und Frontend nicht
auseinanderlaufen können.

## Frontend

- `pages/Profile.tsx` wird zum Einstellungsbereich mit `Card`-Abschnitten je Thema und dabei nach
  `pages/Settings.tsx` umbenannt; die Route wird `settings`, `profile` leitet dorthin weiter
  (SET-12). Mit umzuziehen sind die Navigationsverweise in `Layout.tsx` und der i18n-Schlüsselraum
  `profile.*` — Letzteres ist eine reine Umbenennung, aber sie muss vollständig sein, sonst bleiben
  tote Schlüssel zurück.
- Sprachwahl über die `Select`-Primitive mit drei Optionen (Gerätesprache, Deutsch, English).
- Nach erfolgreichem Speichern wird `i18next.changeLanguage()` aufgerufen; die
  `localStorage`-Zwischenspeicherung wird auf denselben Wert gesetzt, damit SET-5 auch beim
  nächsten Kaltstart greift.
- Der Benachrichtigungsabschnitt braucht eine Kind-Auswahl, weil die Einstellungen pro Kind gelten
  — die Auswahl gehört sichtbar zum Abschnitt und nicht in eine globale Kopfzeile.
- `Layout.tsx` wird um den provisorischen Umschalter bereinigt; der freiwerdende Platz in der
  Kopfzeile ist bewusst kein Anlass, dort etwas Neues zu platzieren.

## Zu treffende Entscheidungen

1. **Update von ADR-0005.** Der ADR beschreibt den Umschalter in der App-Shell ausdrücklich als
   Provisorium. Dessen Ablösung gehört als kurzes Addendum dorthin, nicht in einen neuen ADR.

## Offene Punkte

- **Sprachumschalter auf den Anmeldeseiten:** Ohne Konto gibt es keine gespeicherte Präferenz. Ob
  ein Umschalter auf Login/Registrierung nötig ist oder die Gerätesprache genügt, ist zu
  entscheiden. Vorschlag: vorerst genügt die Gerätesprache.
- **Dunkles Farbschema als Einstellung:** Die Design-Tokens unterstützen bereits sowohl
  `prefers-color-scheme` als auch einen `[data-theme]`-Übersteuerungs-Hook — eine Auswahl
  Hell/Dunkel/System wäre hier mit geringem Aufwand ergänzbar. Bewusst **nicht** eingeplant, weil es
  über den PRD-Umfang hinausgeht; als Kandidat notiert.
- **Reihenfolge zu [7.3](phase-7-3-medikamente-impfungen.md):** Falls 7.3 zuerst umgesetzt wird,
  muss diese Teilphase dessen Erinnerungs-Einstellungen mit in den Bereich einsortieren.

## Aufgaben

- [ ] `User.locale` inkl. Prisma-Migration und `toLocale()`-Guard
- [ ] `PATCH /auth/me` und die `me`-Antwort um `locale` erweitern, inkl. Validierung gegen die gemeinsame Sprachkonstante
- [ ] Gemeinsame Konstante der unterstützten Sprachen, von Frontend-`supportedLngs` und Backend-Validierung genutzt
- [ ] Profilseite in Abschnitte gliedern (Konto, Sprache, Benachrichtigungen)
- [ ] Benachrichtigungseinstellungen aus Phase 5 inkl. Kind-Auswahl in den Bereich einbinden
- [ ] Sprachauswahl mit Option „Sprache des Geräts" und sofortiger Wirkung
- [ ] Auflösungsreihenfolge nach SET-5 umsetzen (Vorabwert aus `localStorage`, danach Kontoeinstellung)
- [ ] Provisorischen Umschalter aus `Layout.tsx` entfernen; Flaggen-Icons je nach Weiterverwendung entfernen oder umziehen
- [ ] Route auf `settings` umbenennen, Weiterleitung von `profile` einrichten, Navigationsverweise und i18n-Schlüssel mitziehen
- [ ] i18n-Texte (de/en) für den Einstellungsbereich
- [ ] ADR-0005 um ein Addendum zur Ablösung des Provisoriums ergänzen
- [ ] Offenen Punkt „Sprachumschaltung in den Nutzereinstellungen" in `phase-7-v2-erweiterungen.md` bzw. dieser Teilphase abhaken
- [ ] Tests: Auflösungsreihenfolge, sofortige Umschaltung, Persistenz über Anmeldung hinweg, Validierung unzulässiger Werte

## Definition of Done

- Die Sprache ist im Einstellungsbereich wählbar, wirkt sofort und bleibt nach erneuter Anmeldung
  auf einem anderen Gerät erhalten.
- Die Option „Sprache des Geräts" existiert, ist der Standard und entspricht dem bisherigen
  Verhalten.
- Der provisorische Umschalter aus der App-Shell ist entfernt; es gibt genau einen Ort für die
  Sprachwahl.
- Konto-, Sprach- und Benachrichtigungseinstellungen sind unter `settings` an einer Stelle
  erreichbar und vollständig übersetzt; die alte Adresse `profile` leitet dorthin weiter.
- ADR-0005 ist um die Ablösung des Provisoriums ergänzt.
- Keine Regression in der bestehenden Testsuite.
