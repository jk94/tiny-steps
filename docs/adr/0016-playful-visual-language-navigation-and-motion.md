# ADR-0016: Playful visual language — four-item child navigation, quick-add FAB, view transitions and an SVG illustration set

## Status

Accepted

## Context

After Phase 6 every screen ran on the design-system primitives, but the result read as "technical
and functional": white cards on a white page, slate greys, a system font, and per-child navigation
that had grown with every Phase 7 sub-phase. By 7.3 the mobile bottom tab bar held **eight** items
(overview, feeding, sleep, diaper, growth, milestones, medical, settings); at 390 px each label had
~45 px and broke mid-word ("Füt-tern", "Medizi-n"). The user asked (2026-11-01) for:

1. a simple, uncluttered mobile navigation instead of the eight tabs;
2. animations — specifically an *expanding page change* where the tapped child tile grows into the
   child's overview;
3. a floating action button for the per-area quick-add actions;
4. milestone tiles that show the first photo as a cover, without the note, opening a detail view
   that holds edit/delete;
5. more accents and pictures, in a simple comic / line-drawing style (stock or AI-generated images
   were explicitly acceptable).

Constraints that shaped the answers: the app is **self-hosted only** (no CDN calls at runtime), an
installed PWA must keep working offline, the router is the declarative `<BrowserRouter>`, the PDF
report is generated from the same color tokens, and Phase 6 M4's contrast/motion rules still apply.

## Decision

### Navigation: four destinations, a "more" sheet, and a docked FAB

- The mobile bottom bar shows **Overview, Timeline, Milestones, More**. "More" opens a bottom
  `Sheet` with illustrated tiles for feeding, sleep, diaper, growth, medical and development plus
  the child's settings. Feeding/sleep/diaper move behind "more" deliberately: their everyday
  actions are one tap away on the FAB, and their latest state is a tile on the overview.
- The desktop sidebar keeps every destination (there is room) but groups them ("Alltag" /
  "Großwerden") with area-colored icon chips, and gains the development calendar and the timeline
  as entries of their own.
- All three (bar, "more" sheet, sidebar) read one hook, `useChildNavigation`, and one area registry,
  `lib/childAreas.ts` (route segment, label key, icon, illustration, tint classes) — the same "one
  source of truth" idea as `eventTypeVisuals.ts`.
- A **quick-add FAB** (docked into the middle of the bar on mobile, floating bottom-right from `lg:`)
  opens a bottom sheet whose first part shows the one-tap buttons of feeding, sleep and diaper
  *directly* — the very same `*QuickEntry` components their screens use (now with optional
  `onCreated`/`hideTitle`), so offline buffering, validation and errors are identical. A standard
  event therefore stays at **two taps from any child screen** (FAB → "Pipi"), the PRD's tap budget
  (section 6) and what the old per-area tab offered (tab → "Pipi"). Below them, illustrated tiles
  open the full create forms of growth, milestones and health. A running feeding/sleep timer is not
  duplicated — its section links to the timer's screen, and starting a timer from the sheet lands
  there. The FAB is only rendered for `ENTRY_WRITE_ROLES`, read through the existing
  `useHouseholdRole` + `canWrite`.
- `Sheet` gained `side="bottom"` and an optional visible `title`.

### Motion: the View Transitions API behind a small router helper

- Same-document **View Transitions** provide the expanding tile: the child tile in `ChildList` and
  the hero on `ChildHome` share a `view-transition-name` (`child-<id>`, plus `child-avatar-<id>`
  for the photo), and so do a milestone tile's cover and the detail screen's cover. The browser
  morphs the box; the rest of the page fades and rises underneath. Persistent chrome (header, bar,
  FAB, sidebar) has its own names so it doesn't flicker.
- React Router's `viewTransition` prop only works in its data-router modes. Rather than migrating
  the whole app off `<BrowserRouter>`, `lib/viewTransition.ts` starts the transition itself; because
  `<BrowserRouter>` applies location changes inside `React.startTransition`, a `flushSync` can't
  force the new route into the DOM, so the update callback returns a promise that `Layout`
  resolves from a layout effect once the new location has committed (with a 500 ms safety
  timeout). `TransitionLink` wraps `<Link>` and only takes over a plain left click.
- The destination renders immediately from the source list's cache (`placeholderData`), so the
  "after" snapshot shows the finished hero/cover rather than a skeleton.
- Smaller motion: a keyed rise-in per page (muted for pages entered via a view transition), staggered
  card entries, pop-in sheet tiles, a sliding/fading bottom sheet, the FAB's plus turning into ×.
- **Progressive enhancement only:** without the API, or under `prefers-reduced-motion: reduce`,
  navigation is instant and every keyframe animation is switched off.

### Visual language

- **Illustrations are hand-authored SVG**, not stock or AI raster images: thirteen "sticker" drawings
  (ink outline, pastel fills, a soft blob background, small faces and sparkles) for the seven areas,
  the four milestone categories, the baby mascot and households. They are a few hundred bytes each,
  crisp at every size, carry no licence or attribution obligation, ship inside the precached bundle
  (so they work offline) and paint their own backdrop, which keeps them readable on light and dark
  surfaces without token plumbing. Style rules live in
  `apps/frontend/src/components/illustrations/README.md`.
- **Typeface:** Nunito (variable, SIL OFL 1.1) via `@fontsource-variable/nunito`, i.e. **bundled
  with the app** instead of loaded from Google Fonts — a self-hosted instance must not contact a
  third party on every page load. Only the latin subset is precached; the others load on demand
  through `unicode-range`.
- **Tokens:** a warm `canvas` page tone (cards and the header stay on white `background`/`card`,
  which the PDF report also prints on), a violet `primary`, warm neutrals, rounder radii, softer
  tinted shadows, and four area colors (`growth`, `milestone`, `health`, `development`) beside the
  existing event-type colors. Each child gets one of five gradients picked from its id
  (`lib/childTheme.ts`, every stop ≥ 4.5:1 against white, enforced by a spec).

### Milestones as an album

- The timeline renders tiles (2 columns on phones, 3 from `md:`): cover = first photo or the
  category illustration, category badge, photo count, title, date and age — no note, no actions.
- A new route `…/milestones/:milestoneId` (`MilestoneDetail`) shows the cover, all photos (gallery),
  note, author and the **edit/delete actions with unchanged permissions** (`canEditEntry` for edit,
  `FULL_WRITE_ROLES` for delete). Editing returns to the detail screen.

## Alternatives considered

- **Keep eight tabs, icon-only or horizontally scrollable.** Icon-only fails recognisability (growth vs.
  development vs. milestones); a scrolling tab bar hides destinations just as "more" does, without
  saying so.
- **Hamburger/drawer for child areas.** Two menus (global + child) in one header is worse than one
  bottom "more" sheet within thumb reach.
- **Speed-dial FAB** (small buttons fanning out). Six labelled actions don't fit a fan on a phone; a
  sheet carries labels and illustrations and can host the inline quick entry.
- **A FAB sheet of six area tiles, each opening a second step with that area's buttons.** Prettier,
  and briefly implemented, but it costs a third tap for every standard event (FAB → "Windel" →
  "Pipi") — a regression against the PRD's two-tap criterion for the app's most frequent action.
- **Migrating to `createBrowserRouter` for the built-in `viewTransition`.** A large, risky change
  to every route, loader-less app for one effect; a small helper (`lib/viewTransition.ts`) keeps the current router.
- **FLIP animation by hand / a motion library (Framer Motion).** Needs measuring and cloning the
  tile across two route trees; the View Transitions API does exactly that natively, and a library
  would be the app's largest dependency for a handful of effects.
- **Stock photos or AI-generated raster images.** Licence tracking, kilobytes to hundreds of kilobytes
  each, blurry at high DPI, and they don't adapt to dark mode. They remain an option later — the
  illustration components are isolated, so swapping one for an `<img>` is local.
- **Google Fonts CDN.** Violates the self-hosted principle (third-party request with the user's IP on
  every page load) and breaks offline.

## Consequences

- The entry chunk grows by ~14 kB gzip (illustrations, navigation, sheets) and the CSS by ~4 kB gzip;
  the font adds a ~39 kB woff2 that is cached after the first load.
- The PDF report picks up the new `muted`/`border`/`foreground` values and radii; its page background
  is unchanged (white).
- Milestone edit/delete is one tap further away (tile → detail). In exchange the timeline is a
  readable album, and the detail screen is a deep-linkable place for a memory.
- View transitions depend on browser support (Chromium/Android WebView, Safari 18+, Firefox 144+);
  older engines simply don't animate. Real-device checks are tracked in `docs/known-issues.md`.
- New area screens must register in `lib/childAreas.ts` and get an illustration, or they won't
  appear in the "more" sheet, the sidebar or the quick-add sheet.
