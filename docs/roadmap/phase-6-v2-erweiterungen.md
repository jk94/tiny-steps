# Phase 6: Version 2.0 – Erweiterungen

**Bezug im PRD:** Abschnitt 4.2 (Version 2.0 nach MVP)

## Ziel

Funktionsumfang über den MVP hinaus erweitern: Wachstum, Meilensteine, Medikamente/Impfungen, erweiterter Export, erweiterte Rollen, Mehrsprachigkeit.

## Voraussetzungen

MVP (Phasen 0–5) ist produktiv im Einsatz und stabil.

## Aufgaben

### Wachstumstracking
- [ ] Datenmodell für Wachstumsmessungen (Gewicht, Größe, Kopfumfang, Zeitpunkt)
- [ ] Erfassungs-UI für Wachstumsmessungen
- [ ] Perzentilen-Kurven (Referenzdaten recherchieren/einbinden, z. B. WHO-Wachstumsstandards)
- [ ] Visualisierung als Diagramm im zeitlichen Verlauf

### Meilensteine
- [ ] Datenmodell für Meilensteine (Typ, Datum, Notiz, optional Foto)
- [ ] Vordefinierte Meilenstein-Vorlagen (erstes Lächeln, erste Schritte, erster Zahn, …) plus freie Einträge
- [ ] Übersichts-/Timeline-Ansicht für Meilensteine

### Medikamente/Impfungen
- [ ] Datenmodell für Medikamentengaben und Impfungen
- [ ] Erinnerungsfunktion (z. B. nächste Impfung fällig) über bestehende Push-Infrastruktur aus Phase 5
- [ ] Erfassungs- und Übersichts-UI

### Erweiterter Export
- [ ] PDF-Bericht-Generierung (z. B. für Kinderarzt-Termine) mit Auswahl relevanter Daten/Zeitraum

### Erweiterte Rollen
- [ ] Rolle „Betreuer“: nur Erfassen von Ereignissen, kein Löschen/Verwalten
- [ ] Rolle „Beobachter“: nur Lesezugriff
- [ ] Guards/Rechteprüfung aus Phase 1 um die neuen Rollen erweitern
- [ ] UI zur Rollenzuweisung bei Einladung/Verwaltung von Haushaltsmitgliedern

### Mehrsprachigkeit
- [ ] i18n-Infrastruktur im Frontend einrichten
- [ ] Übersetzung der bestehenden UI-Texte (mindestens Deutsch/Englisch)
- [ ] Sprachumschaltung in den Nutzereinstellungen

## Definition of Done

- Wachstums- und Meilenstein-Daten können erfasst und ausgewertet werden
- Erinnerungen für Medikamente/Impfungen funktionieren zuverlässig
- PDF-Bericht enthält alle relevanten Daten in lesbarer Form
- Betreuer- und Beobachter-Rollen greifen korrekt in der Rechteprüfung
- UI ist vollständig in mindestens zwei Sprachen nutzbar
