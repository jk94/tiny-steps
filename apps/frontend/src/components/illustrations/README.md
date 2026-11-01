# Illustrations

Hand-drawn SVG illustrations in a simple comic / sticker style. They give each
area of the app (feeding, sleep, diaper, growth, milestones, health,
development) a recognisable picture and fill empty states, the login screen and
the child-home hero. Rationale (why SVG instead of stock or AI raster images,
why not token-driven) is in [ADR-0016](../../../../../docs/adr/0016-playful-visual-language-navigation-and-motion.md).

## Style rules for a new illustration

- **Canvas:** `viewBox="0 0 120 120"`, wrapped in `IllustrationSvg` (which owns
  sizing and the decorative-by-default accessibility contract).
- **Background:** start with the shared soft blob path
  (`M60,10 C88,8 110,28 …`) filled with a pale pastel of the area's color.
  Keep ink outlines inside the blob — outside it they vanish on a dark card.
- **Outline:** ink `#2b2540`, `strokeWidth` 3 for main shapes and 2.5 for
  details, round caps and joins.
- **Fills:** pastels only; a face (two dot eyes with a white glint, a small
  smile, pink blush ellipses) is what makes an object feel like a character.
- **Accents:** one or two four-point sparkles and a few small dots.
- **Colors are literal hex values**, not design tokens: an illustration must
  look identical in light and dark mode, the blob provides its own backdrop.
