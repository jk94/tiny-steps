# Phase 7: Version 2.0 – Erweiterungen

**Bezug im PRD:** Abschnitt 4.2 (Version 2.0 nach MVP)

> **Diese Phase ist in Teilphasen zerlegt.** Die ausformulierten Anforderungen, Datenmodelle,
> API-/UI-Vorgaben und Aufgabenlisten stehen in [`docs/roadmap/phase-7/`](phase-7/README.md).
> Dieses Dokument bleibt als Einstiegspunkt bestehen und enthält bewusst keine eigene
> Aufgabenliste mehr — sonst gäbe es zwei Orte, an denen der Fortschritt gepflegt werden müsste.

## Ziel

Funktionsumfang über den MVP hinaus erweitern: Wachstum, Meilensteine, Medikamente/Impfungen,
erweiterter Export, erweiterte Rollen, Mehrsprachigkeit.

## Voraussetzungen

MVP (Phasen 0–5) ist produktiv im Einsatz und stabil. Phase 6 (Design-System & UX) ist
abgeschlossen, da die hier neu hinzukommenden UIs (Wachstum, Meilensteine, Medikamente/Impfungen,
Rollenzuweisung) auf dem dort etablierten Design-System aufbauen sollen.

## Teilphasen

| # | Teilphase | Umfang |
|---|---|---|
| 7.1 | [Wachstumstracking](phase-7/phase-7-1-wachstumstracking.md) | Messwerte, WHO-Perzentilen, Verlaufsdiagramm |
| 7.2 | [Meilensteine](phase-7/phase-7-2-meilensteine.md) | Vorlagen + freie Einträge, Fotogalerie, Timeline |
| 7.3 | [Medikamente & Impfungen](phase-7/phase-7-3-medikamente-impfungen.md) | Erfassung, Fälligkeiten, Push-Erinnerungen |
| 7.4 | [Erweiterter Export (PDF-Bericht)](phase-7/phase-7-4-erweiterter-export-pdf.md) | Arztbericht, austauschbarer Renderer |
| 7.5 | [Erweiterte Rollen](phase-7/phase-7-5-erweiterte-rollen.md) | Betreuer/Beobachter, Mitglieder- & Rollenverwaltung |
| 7.6 | [Nutzereinstellungen & Sprache](phase-7/phase-7-6-nutzereinstellungen-sprache.md) | Settings-Bereich, persistierte Sprachwahl |

Reihenfolge, Abhängigkeiten und die bereichsübergreifenden Festlegungen (eigene Tabellen statt neuer
Event-Typen, kein Echtzeit-Sync/Offline für die neuen Domänen, Anzeige auf `ChildHome`, Rechte
bleiben haushaltsweit) stehen in der [Phase-7-Übersicht](phase-7/README.md).

## Stand der Mehrsprachigkeit

Zwei der ursprünglich hier geführten i18n-Aufgaben sind bereits erledigt und werden daher nicht in
7.6 wiederholt:

- **i18n-Infrastruktur im Frontend** — bewusst aus Phase 6 in Phase 1 vorgezogen (vor der
  Login-/Registrierungs-UI), da die UI-Oberfläche zu diesem Zeitpunkt noch klein war; Details und
  Begründung siehe [ADR-0005](../adr/0005-i18n-infrastructure-brought-forward.md).
- **Übersetzung der bestehenden UI-Texte (Deutsch/Englisch)** — die Übersetzung neuer Oberflächen
  ist laufende Arbeit im jeweiligen Sub-Schritt und wird dort abgehakt, nicht hier.

Offen bleibt allein die **Sprachumschaltung in den Nutzereinstellungen**; sie ist der Kern von
[Teilphase 7.6](phase-7/phase-7-6-nutzereinstellungen-sprache.md).

## Definition of Done

Phase 7 gilt als abgeschlossen, wenn die Definition of Done **aller sechs Teilphasen** erfüllt ist.
Übergreifend heißt das:

- Wachstums- und Meilenstein-Daten können erfasst und ausgewertet werden
- Erinnerungen für Medikamente/Impfungen funktionieren zuverlässig
- PDF-Bericht enthält alle relevanten Daten in lesbarer Form
- Betreuer- und Beobachter-Rollen greifen korrekt in der Rechteprüfung
- UI ist vollständig in mindestens zwei Sprachen nutzbar
