# Teilphase 7.7: Entwicklungskalender

**Bezug im PRD:** keiner — nachträglicher Funktionswunsch (2026-10-18), nicht aus PRD 4.2 abgeleitet
**Übergeordnet:** [Phase 7 – Übersicht](README.md)
**Status:** Umgesetzt (2026-10-18)

## Ziel

Eltern sehen im Dashboard des Kindes (`ChildHome`) zu jeder Lebenswoche einen kurzen Text dazu, was
um diese Zeit herum typisch ist („Um diese Zeit beginnen viele Babys, gezielt zu greifen …"). Ein
Tipp auf die Kachel öffnet eine Detailseite mit ausführlicherem Text, Alltagsideen und Links zu
seriösen Quellen.

## Scope-Abgrenzung

**Enthalten:**

- 52 Einträge für das erste Lebensjahr (eine **Lebenswoche** je Eintrag), danach 24 Einträge für
  den 13. bis 36. **Lebensmonat**. Ab dem dritten Geburtstag zeigt die Kachel einen kurzen
  Abschluss-Hinweis; der Kalender bleibt durchblätterbar.
- Dashboard-Kachel und Detailseite mit Blättern (vor/zurück) durch den ganzen Kalender.
- Vollständige Texte auf Deutsch und Englisch.
- Abkürzung „Schon erlebt? Als Meilenstein festhalten" in das bestehende Meilenstein-Formular
  (`?templateKey=`), wo ein Eintrag zu einer Katalogvorlage aus 7.2 passt.

**Nicht enthalten:**

- **Korrigiertes Alter für Frühgeborene.** Der Kalender rechnet ab dem tatsächlichen Geburtsdatum;
  die Detailseite weist auf das korrigierte Alter hin. Ein optionaler Entbindungstermin am `Child`
  ist als Folgepunkt in [`known-issues.md`](../../known-issues.md) erfasst.
- Kein Backend, keine Persistenz, keine Push-Benachrichtigung („Neue Woche!").
- Kein Redaktionssystem — die Texte sind Code im Repository.
- Keine „Sprünge"/„Wonder Weeks": Das Modell ist wissenschaftlich nicht belegt und wird bewusst
  nicht verwendet.

## Fachliche Anforderungen

| ID | Anforderung |
|---|---|
| EK-1 | Die aktuelle Stufe ergibt sich aus dem Geburtsdatum und dem lokalen Kalendertag: Lebenswoche *n* umfasst die Tage 7(*n*−1) bis 7*n*−1 (Tag 0 = Geburtstag). Ab dem ersten Geburtstag gilt der Lebensmonat (= vollendete Monate + 1), bis einschließlich Lebensmonat 36. |
| EK-2 | Die letzten ein bis zwei Tage vor dem ersten Geburtstag bleiben in Lebenswoche 52 — es gibt keine Woche 53. |
| EK-3 | Altersangaben sind Spannbreiten und Orientierung („um diese Zeit herum", „zwischen X und Y Monaten"), nie Fristen. Nichts wird als „überfällig" markiert — dieselbe Haltung wie der Meilenstein-Katalog (M-3). |
| EK-4 | Jede Woche hat einen eigenen Schwerpunkt. Weil sich Entwicklung selten im Wochentakt ändert, darf ein Schwerpunkt auch Alltag, Pflege, Sicherheit oder eine anstehende U-Untersuchung sein — statt einer erfundenen wochengenauen Fähigkeit. |
| EK-5 | Jeder Eintrag nennt mindestens eine Quelle; Links öffnen in einem neuen Tab (`noopener noreferrer`). Eine Quelle in der jeweils anderen Sprache wird gekennzeichnet. |
| EK-6 | Schnell veraltende Vorgaben (insbesondere Impftermine) werden nur allgemein genannt und verlinkt (STIKO-Impfkalender), nicht im Detail wiedergegeben. |
| EK-7 | Die Detailseite enthält immer den Hinweis, dass die Texte Orientierung sind und keine ärztliche Beratung ersetzen, sowie den Hinweis zum korrigierten Alter. |
| EK-8 | Lesen dürfen alle Rollen. Die Meilenstein-Abkürzung erscheint nur für Rollen mit Schreibrecht auf Einträge (`ENTRY_WRITE_ROLES`). |
| EK-9 | Die Inhalte funktionieren offline (statischer Inhalt im vorab gecachten App-Shell). Scheitert das Laden trotzdem, verschwindet die Kachel kommentarlos; die Detailseite zeigt einen Fehler. |

## Quellen und Inhaltsgrundsätze

Die Texte sind **eigens formuliert**, nicht kopiert. Sie stützen sich auf:

- **BIÖG / kindergesundheit-info.de** — Entwicklung im 1. Lebensjahr, Schreien, Babyschlaf,
  sicherer Schlaf, Früherkennungsuntersuchungen U1–U9
- **G-BA-Kinder-Richtlinie** (über kindergesundheit-info.de und das BMG) — Zeitfenster der
  U-Untersuchungen (U2: 3.–10. Tag, U3: 4.–5. Woche, U4: 3.–4. Monat, U5: 6.–7. Monat,
  U6: 10.–12. Monat, U7: 21.–24. Monat, U7a: 34.–36. Monat)
- **STIKO/RKI** — Impfkalender (nur verlinkt, siehe EK-6)
- **Netzwerk Gesund ins Leben** — Beikost frühestens zu Beginn des 5., spätestens zu Beginn des
  7. Lebensmonats; Reifezeichen; Übergang zum Familienessen
- **Nationales Zentrum Frühe Hilfen (elternsein.info)** — Schreien, Überforderung, Schütteltrauma
- **CDC/AAP-Meilenstein-Checklisten (Revision 2022)** — was mindestens 75 % der Kinder bis zu
  einem Alter können (2, 4, 6, 9, 12, 15, 18, 24, 30, 36 Monate)
- **WHO Motor Development Study** (Martorell et al. 2006) — Zeitfenster (1.–99. Perzentile) für
  sechs grobmotorische Meilensteine, z. B. freies Sitzen ca. 4–9 Monate, freies Laufen ca. 8–18
  Monate
- **NHS** — Bauchlage („tummy time"), Beruhigen eines schreienden Babys

Alle Links stehen an genau einer Stelle (`apps/frontend/src/development/developmentSources.ts`).

## Technische Umsetzung

- **Nur Frontend.** Die Inhalte ändern sich nur mit einem Release; ein Endpunkt würde nur
  ausliefern, was der Client ohnehin hat (gleiche Begründung wie beim Meilenstein-Katalog).
- **Texte als eigene Sprachmodule** (`development/content/de.ts`, `en.ts`) statt in
  `de.json`/`en.json`, per dynamischem `import()` nachgeladen. **Bewusste Abweichung von
  Festlegung 8** der [Phase-7-Übersicht](README.md): Die beiden JSON-Dateien werden statisch für
  beide Sprachen in den Haupt-Chunk gebündelt, und die 76 Einträge Prosa pro Sprache (ca. 55–59 kB,
  ca. 20 kB gzip) sind größer als die gesamte übrige Oberfläche (ca. 40–43 kB je Sprache) — sie
  hätten die Übersetzungen mehr als verdoppelt, für einen Screen, den die meisten Besuche nie öffnen.
  Der Kern von Festlegung 8 (keine hartkodierten Anzeigetexte, beide Sprachen vollständig) bleibt
  erfüllt: Beide Module teilen sich ein Interface (`DevelopmentContent`), und
  `developmentContent.spec.ts` prüft Vollständigkeit, Längen und Quellen pro Sprache. Die
  UI-Beschriftungen (Kachel, Detailseite) liegen ganz normal in `de.json`/`en.json` unter
  `development.*`.
- Der Service Worker cacht jeden gebauten Chunk vorab, die Inhalte sind also offline verfügbar.
- Routen: `…/children/:childId/development` (aktuelle Stufe — darauf verlinkt die Kachel, ein
  Lesezeichen wächst also mit dem Kind) und `…/development/:stageKey` (`week-12`, `month-18`).

## Definition of Done

- [x] `ChildHome` zeigt unter der Kind-Karte die Kachel der aktuellen Lebenswoche bzw. des
  aktuellen Lebensmonats; die ganze Kachel ist ein Link zur Detailseite.
- [x] Die Detailseite zeigt Text, Alltagsideen, Quellen-Links, Hinweise (EK-7) und erlaubt das
  Blättern über den gesamten Kalender, auch über die Grenze Woche 52 → Monat 13.
- [x] 52 + 24 Einträge in Deutsch und Englisch, abgesichert durch einen Vollständigkeitstest.
- [x] Stufenberechnung inkl. Sommerzeitwechsel, Schaltjahr, Woche-52-Grenze und drittem
  Geburtstag unit-getestet.
- [x] Meilenstein-Abkürzungen verweisen nur auf existierende Katalogvorlagen (Test) und sind
  rollenabhängig (Test).
- [ ] Fachliche Durchsicht der Texte durch eine Hebamme oder einen Kinderarzt bzw. eine
  Kinderärztin (offen, siehe [`known-issues.md`](../../known-issues.md)).
- [ ] Manuelle Prüfung aller Quellen-Links im Browser (offen, siehe
  [`known-issues.md`](../../known-issues.md)).
