# Phase 6: Design-System & moderne User Experience

**Bezug im PRD:** Abschnitt 4.1 (Mobile-first, alle MVP-Kernfunktionen), 5.3 (Frontend-Architekturentscheidung React+Vite, SPA, kein SSR-Bedarf)

## Ziel

Die bisherige UI (Phasen 0–5) ist funktional vollständig, wirkt aber noch technisch/roh, da bislang kein
einheitliches Design-System existiert (kein Styling-Framework, keine gemeinsame Farb-/Typografie-/
Abstands-Skala, keine wiederverwendbaren UI-Primitives). Phase 6 führt ein konsistentes Design-System ein
und hebt die bestehenden Oberflächen (Login/Registrierung, App-Shell/Navigation, Haushalts- und
Kind-Profil-Verwaltung, Timer/QuickEntry-Komponenten, Tages-Timeline, Statistiken) auf ein modernes,
zusammenhängendes visuelles und interaktives Niveau, ohne bestehende Funktionalität, Tests oder
Barrierefreiheit zu regressieren.

Das Design-System besteht dabei bewusst aus **zwei komplementären Artefakten**, nicht nur aus Code:

1. **React-Komponenten-Bibliothek** (konkrete Implementierung für dieses Frontend, kompatibel zu Claude
   Design) — wird direkt von M2/M3 konsumiert.
2. **Plattformagnostischer Styleguide in Markdown** (Design-Tokens, Komponenten-Spezifikationen,
   Zustände, Interaktionsmuster als Text-/Tabellen-Beschreibung statt als Code) — dient als
   implementierungsunabhängige Referenz, damit dasselbe Design-System später auch auf andere
   UI-Technologien (z. B. Flutter für den nativen Wrapper aus Phase 5, Angular, o. Ä.) übertragen werden
   kann, ohne die React-Bibliothek reverse-engineeren zu müssen.

Beide Artefakte müssen aus derselben Quelle der Wahrheit (den Design-Tokens) abgeleitet und synchron
gehalten werden — der Markdown-Styleguide ist keine nachträgliche Dokumentation, sondern verbindliche
Spezifikation, gegen die die React-Komponenten (und künftige Implementierungen in anderen Frameworks)
geprüft werden.

## Voraussetzungen

MVP (Phasen 0–5) ist funktional abgeschlossen und produktiv nutzbar. Phase 6 ändert bewusst **keine**
Datenmodelle, API-Verträge oder Geschäftslogik — reiner Frontend-/Präsentationsschicht-Scope.

## Struktur & Parallelisierbarkeit

Die Aufgaben sind in drei Meilensteine gegliedert. **M1 ist eine harte Voraussetzung** für M2 und M3, da
beide auf den dort definierten Design-Tokens und Basis-Komponenten aufbauen. Innerhalb von M2 und
innerhalb von M3 sind die Teilaufgaben jedoch weitgehend unabhängig voneinander (unterschiedliche
Screens/Komponenten, keine gemeinsamen Dateien) und können auf mehrere Entwickler:innen bzw. parallele
Branches aufgeteilt werden. M2 und M3 können zudem grundsätzlich parallel zueinander laufen, sobald M1
steht, da M2 sich auf App-Shell/Navigation/Auth-Screens konzentriert und M3 auf die
Tracking-/Event-bezogenen Screens — beide Bereiche teilen sich nur die in M1 geschaffenen gemeinsamen
Komponenten, nicht aber Feature-Code untereinander.

```
M1 (Fundament: Tokens, Komponenten-Bibliothek, Doku)
   ├─> M2 (App-Shell, Navigation, Auth-/Verwaltungs-Screens)   ─┐
   └─> M3 (Tracking-/Timeline-/Statistik-Screens)              ─┴─> M4 (Bereichsübergreifende Politur, A11y/Perf-Audit)
```

Innerhalb M1 können die Unteraufgaben "Tokens/Theming", "React-Komponenten-Bibliothek (M1a)", "Markdown-
Styleguide (M1b)" und "Icon-/Illustrations-Set" parallel begonnen werden, sollten aber vor Freigabe von
M2/M3 zusammengeführt und synchron gehalten werden (M1a und M1b müssen dieselben Tokens/Zustände
beschreiben), damit M2/M3 nicht auf unterschiedlichen Zwischenständen aufbauen.

## Aufgaben

### M1 — Fundament: Design-Tokens & Komponenten-Bibliothek

- [x] Entscheidung für einen Styling-Ansatz treffen und dokumentieren (z. B. Tailwind CSS vs. CSS-Module
      vs. vorgefertigte Komponenten-Bibliothek wie Radix/shadcn-ähnlich) — als ADR festhalten, analog zu
      bestehenden Architekturentscheidungen (siehe `docs/adr/`)
- [x] Design-Tokens definieren: Farbpalette (inkl. Dark-Mode-Betrachtung), Typografie-Skala,
      Abstands-/Spacing-Skala, Radien, Schatten, Breakpoints — Ablösung/Konsolidierung der bestehenden
      Breakpoints-CSS aus Phase 0; Tokens als plattformneutrale Werte (z. B. JSON/YAML) definieren, aus
      denen sowohl die React-Implementierung als auch der Markdown-Styleguide (siehe unten) generiert
      bzw. abgeleitet werden, statt die Tokens nur hart in React-/CSS-Code zu kodieren
- [x] Konsistentes Icon- und ggf. Illustrations-Set einbinden (z. B. für Event-Typen Stillen/Fläschchen/
      Beikost/Schlaf/Windel), inkl. Farbcodierung je Event-Typ

#### M1a — React-Komponenten-Bibliothek (Claude-Design-kompatibel)

- [x] Wiederverwendbare Basis-Komponenten für dieses Frontend bauen (Button, Input, Select, Card,
      Modal/Dialog, Toast/Notification, Badge, Tabs, Avatar, Loading-/Skeleton-States, leere Zustände/
      "Empty States")
- [x] Komponenten-API/Props-Konventionen so gestalten, dass sie kompatibel zu Claude Design sind (gleiche
      Grundprinzipien bei Benennung, Theming-Mechanismus und Komponentenstruktur), damit bestehende
      Claude-Design-Patterns/-Tooling ohne größere Anpassung wiederverwendet werden können
- [x] Komponenten-Dokumentation/-Katalog anlegen (z. B. Storybook oder eine einfache interne
      Katalog-Route im Frontend), damit M2/M3 auf denselben Bausteinen aufsetzen
- [x] Komponenten-Tests für die neuen Basis-Komponenten (Rendering, Interaktions-States, Barrierefreiheit
      wie Fokus-Reihenfolge/ARIA-Attribute)

#### M1b — Plattformagnostischer Styleguide (Markdown)

- [x] Markdown-Styleguide anlegen (z. B. `docs/design-system/`), der Design-Tokens, Komponenten-Zustände,
      Interaktionsmuster und Layout-Regeln implementierungsunabhängig beschreibt (Tabellen/Prosa statt
      Code), sodass er als Spezifikation für weitere UI-Technologien (Flutter, Angular, o. Ä.) dient
- [x] Pro Basis-Komponente aus M1a einen Markdown-Eintrag mit Zweck, visuellen Zuständen (Default/Hover/
      Focus/Disabled/Error), Barrierefreiheits-Anforderungen und Abbildungsvorschlägen anlegen
- [x] Abgleichsprozess definieren und dokumentieren, wie Änderungen an Tokens/Komponenten künftig sowohl
      in der React-Bibliothek als auch im Markdown-Styleguide nachgezogen werden (z. B. als Teil der
      PR-Checkliste), damit beide Artefakte nicht auseinanderlaufen

### M2 — App-Shell, Navigation & Auth-/Verwaltungs-Screens

- [x] App-Shell/Navigation neu gestalten (Header, Haushaltsliste als Startseite, Verbindungsstatus-
      Indikator aus Phase 3) auf Basis der M1-Komponenten — `Layout.tsx` nutzt `Avatar`/`Button`/`Sheet`,
      Hamburger-Menü öffnet ein rechtsseitiges `Sheet` unterhalb `lg:`, `ConnectionStatusDot` bleibt
      außerhalb des Menüs immer sichtbar. Der ursprünglich geplante globale „Haushalts-Switcher" wurde
      bewusst nicht gebaut — stattdessen wurde der globale Dashboard-Ansatz entfernt zugunsten der
      Haushaltsliste (`HouseholdList`) als Startseite (Commit „remove global dashboard, use household
      list as landing page"); es gibt daher weiterhin kein globales „aktueller Haushalt"-Konzept
- [x] Login-/Registrierungs-Screens überarbeiten (inkl. OIDC-Provider-Auswahl-UI, sofern zu diesem
      Zeitpunkt bereits vorhanden) — `Login.tsx`/`Register.tsx` nutzen `Card`, `AuthForm` nutzt
      `Button`/`Input`, `OidcProviderButtons` bleibt eingebunden
- [x] Haushalts-Verwaltung (Anlegen, Einladungslink) visuell überarbeiten — `HouseholdCreate.tsx`,
      `HouseholdDetail.tsx`, `InviteAccept.tsx`, `HouseholdList.tsx` nutzen `Badge`/`Card`/`EmptyState`
- [ ] Mitgliederliste in der Haushalts-Verwaltung ergänzen und auf M1-Komponenten umsetzen — es gibt
      bislang **keine** dedizierte Mitgliederliste-Ansicht in `HouseholdDetail`/`HouseholdList`; die
      einzige vorhandene User-ID→E-Mail-Auflösung (`listHouseholdMembers`) dient nur intern der
      Nutzeranzeige in der Tages-Timeline (siehe M3). Dies ist über eine reine Visual-Überarbeitung hinaus
      ein fehlendes Feature und daher separat offen
- [x] Kind-Profil-Verwaltung (inkl. Foto-Upload) visuell überarbeiten — `ChildCreate.tsx`,
      `ChildSettings.tsx`, `ChildForm.tsx` (Foto-Dropzone/-Vorschau) nutzen `Button`/`Card`/`Input`
- [x] Responsive Feinschliff für Tablet-/Desktop-Breakpoints (MVP war bewusst mobile-first; hier gezielt
      größere Viewports nachziehen, ohne die Mobile-Priorität zu verlieren) — `lg:`-Breakpoints in
      `Layout.tsx` (Sidebar/Bottom-Tab-Bar-Umschaltung) und den migrierten Home-/Verwaltungs-Screens
- [x] Mikro-Interaktionen/Übergangsanimationen für Navigation und Dialoge (dezent, performant, unter
      Berücksichtigung von `prefers-reduced-motion`) — `Sheet`/`Dialog` (Radix-basiert) mit
      Slide-/Fade-Transitions, `styles/animations.css` deaktiviert Animationen unter
      `prefers-reduced-motion: reduce`

### M3 — Tracking-, Timeline- & Statistik-Screens

- [x] Timer-UI für Stillen/Schlaf visuell überarbeiten (laufende Anzeige, Seitenwahl bei Stillen) unter
      Beibehaltung der bestehenden Tap-Zahl-Erfolgskriterien aus Phase 2 (max. 2 Taps) — `FeedingTimer.tsx`
      /`SleepTimer.tsx` nutzen `Badge`/`Button`/`Card`, bestehende Tap-Zahl-Tests bleiben grün
- [x] QuickEntry-Komponenten (Feeding, Diaper) visuell überarbeiten, ohne die 1-/2-Tap-Schnelleingabe zu
      verändern — `FeedingQuickEntry.tsx`/`DiaperQuickEntry.tsx` nutzen `Badge`/`Button`, Tap-Zahl-Tests
      unverändert grün
- [x] Tages-Timeline neu gestalten (klare chronologische Lesbarkeit, Event-Typ-Farbcodierung aus M1,
      Anzeige des erfassenden Nutzers) — `TimelineEventList.tsx` nutzt `Card`/`Badge` mit
      event-typ-spezifischen Badge-Varianten (`badgeVariantFor`, passend zu den M1-Event-Typ-Tokens) und
      löst den erfassenden Nutzer über `resolveUserLabel`/`listHouseholdMembers` auf
- [x] Statistik-/Übersichts-Widgets ("Letzte Fütterung vor X Stunden" etc.) als ansprechende Karten/Charts
      gestalten — `DailyStatsSummary.tsx`/`TimeSinceCard.tsx` als `Card`-basierte Widgets (Karten-Variante
      der Vorgabe umgesetzt; keine zusätzlichen Charts, was die Vorgabe als Alternative bereits vorsah)
- [x] Optimistische UI-Zustände (Erfolgs-/Fehler-Feedback bei Erfassung, insbesondere im Hinblick auf das
      in Phase 4 geplante Offline-first-Verhalten) konsistent mit den M1-Badge-Komponenten umsetzen —
      `OfflineStatusBadge` (M1 `Badge`, Varianten `warning`/`destructive`) markiert pending/failed-Zeilen
      durchgängig in Timeline und Quick-Entry-Flows. Sonner-`Toast` aus M1 ist seit M1 global in
      `main.tsx` gemountet, wird aber bislang für andere Zwecke vorgehalten und noch nicht aus den
      optimistischen Create-/Timer-Flows heraus ausgelöst — Vorgabe daher bewusst auf die tatsächlich
      genutzten Badge-Komponenten präzisiert

### M4 — Bereichsübergreifende Politur & Qualitätssicherung

- [ ] Visuelle Konsistenzprüfung über alle Screens hinweg (M2- und M3-Ergebnisse zusammenführen,
      Abweichungen von den M1-Tokens bereinigen)
- [ ] Barrierefreiheits-Audit (Farbkontraste, Tastaturbedienbarkeit, Screenreader-Labels) für alle
      überarbeiteten Screens
- [ ] Performance-Check (Bundle-Size-Auswirkung des Styling-Ansatzes, Layout-Shift, Ladezeiten auf
      mobilen Geräten)
- [ ] Bestehende Komponenten-/E2E-Tests aus Phasen 1–3 gegen die neuen Screens nachziehen, sofern sie auf
      inzwischen geänderte Selektoren/Texte referenzieren

## Definition of Done

- Ein dokumentiertes Design-System existiert in zwei synchron gehaltenen Artefakten: einer React-
  Komponenten-Bibliothek (kompatibel zu Claude Design) und einem plattformagnostischen
  Markdown-Styleguide, der die Übertragung auf andere UI-Technologien (z. B. Flutter, Angular) erlaubt
- Alle bestehenden MVP-Screens (Auth, Haushalts-/Kind-Verwaltung, Tracking, Timeline, Statistiken) sind
  auf das neue Design-System migriert, ohne Funktionsverlust
- Bestehende Erfolgskriterien aus Phase 2 (Eingabe eines Standard-Ereignisses in unter 3 Sekunden bzw.
  2 Taps) bleiben nach dem Redesign nachweislich erhalten
- Kein Regressions-Fehler in bestehenden Unit-/Komponenten-/E2E-Tests; ggf. angepasste Tests sind grün
- Barrierefreiheits-Audit zeigt keine kritischen Befunde (ausreichende Kontraste, Tastaturbedienbarkeit)
