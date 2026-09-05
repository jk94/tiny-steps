import { join } from 'node:path';
import { Font } from '@react-pdf/renderer';
import { reportTokens } from './report-tokens.generated';

/**
 * Registers the vendored Inter faces with `@react-pdf/renderer`.
 *
 * react-pdf has no system-font access — every glyph it draws comes from a file
 * it can read — so the design system's CSS font stack is unusable here and the
 * report embeds Inter instead. See `fonts/README.md` for provenance and the
 * SIL OFL 1.1 obligations.
 *
 * The path is resolved from `__dirname` rather than `process.cwd()`, because
 * the working directory differs between `nest start`, `node dist/main.js` and
 * Jest. `nest-cli.json`'s `compilerOptions.assets` copies the `.ttf` files next
 * to the compiled module, so `__dirname/fonts` is correct in both the source
 * tree and `dist/`.
 */
const FONTS_DIR = join(__dirname, 'fonts');

/** Every weight the report styles use, and only those — see fonts/README.md. */
const FONT_FILES: Record<number, string> = {
  [reportTokens.fontWeight.normal]: 'Inter-Regular.ttf',
  [reportTokens.fontWeight.medium]: 'Inter-Medium.ttf',
  [reportTokens.fontWeight.semibold]: 'Inter-SemiBold.ttf',
  [reportTokens.fontWeight.bold]: 'Inter-Bold.ttf',
};

let registered = false;

/**
 * Idempotent: `Font.register` mutates a module-level registry in react-pdf, so
 * calling it once per rendered report would grow that registry unboundedly in
 * a long-lived server process.
 */
export function registerReportFonts(): void {
  if (registered) {
    return;
  }

  Font.register({
    family: reportTokens.fontFamily.report,
    fonts: Object.entries(FONT_FILES).map(([fontWeight, fileName]) => ({
      src: join(FONTS_DIR, fileName),
      fontWeight: Number(fontWeight),
    })),
  });

  // Inter's own hyphenation would break German compounds in odd places
  // ("Kopf-umfang"), and a report has no narrow columns that need it.
  Font.registerHyphenationCallback((word) => [word]);

  registered = true;
}
