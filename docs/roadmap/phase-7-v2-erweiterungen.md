# Phase 7: Version 2.0 – Erweiterungen

**Bezug im PRD:** Abschnitt 4.2 (Version 2.0 nach MVP)

## Ziel

Funktionsumfang über den MVP hinaus erweitern: Wachstum, Meilensteine, Medikamente/Impfungen, erweiterter Export, erweiterte Rollen, Mehrsprachigkeit.

## Voraussetzungen

MVP (Phasen 0–5) ist produktiv im Einsatz und stabil. Phase 6 (Design-System & UX) ist abgeschlossen, da die hier neu hinzukommenden UIs (Wachstum, Meilensteine, Medikamente/Impfungen, Rollenzuweisung) auf dem dort etablierten Design-System aufbauen sollen.

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
- [x] i18n-Infrastruktur im Frontend einrichten — bewusst aus Phase 6 in Phase 1 vorgezogen (vor der
      Login-/Registrierungs-UI), da die UI-Oberfläche zu diesem Zeitpunkt noch klein war; Details und
      Begründung siehe [ADR-0005](../adr/0005-i18n-infrastructure-brought-forward.md)
- [x] Übersetzung der bestehenden UI-Texte (mindestens Deutsch/Englisch) — bezieht sich auf die zum
      Zeitpunkt von ADR-0005 existierende UI-Oberfläche (Loading-Anzeige, App-Shell/Navigation,
      Dashboard-Platzhalter); Übersetzung neuer UI-Oberflächen (Login/Registrierung, Haushalts- und
      Kind-Profil-Verwaltung, …) ist laufende Arbeit im jeweiligen Sub-Schritt, nicht hier
      abgeschlossen
- [ ] Sprachumschaltung in den Nutzereinstellungen — ein einfacher, provisorischer Umschalter existiert
      bereits in der App-Shell (siehe ADR-0005), bleibt aber offen, bis ein echter
      Nutzereinstellungen-Bereich existiert

## Definition of Done

- Wachstums- und Meilenstein-Daten können erfasst und ausgewertet werden
- Erinnerungen für Medikamente/Impfungen funktionieren zuverlässig
- PDF-Bericht enthält alle relevanten Daten in lesbarer Form
- Betreuer- und Beobachter-Rollen greifen korrekt in der Rechteprüfung
- UI ist vollständig in mindestens zwei Sprachen nutzbar
