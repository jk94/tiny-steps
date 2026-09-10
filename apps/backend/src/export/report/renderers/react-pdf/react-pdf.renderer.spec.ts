import { Font } from '@react-pdf/renderer';
import { renderGrowthChartSvg } from '@baby-tracker/growth-chart-static/server';
import type { ReportDocument } from '../../report-document.types';
import { ReactPdfRenderer } from './react-pdf.renderer';
import { registerReportFonts } from './register-fonts';

const PDF_MAGIC = '%PDF-';

const HEADER_ONLY: ReportDocument = {
  locale: 'de',
  title: 'Bericht für Mila',
  blocks: [
    {
      kind: 'documentHeader',
      childName: 'Mila',
      birthDate: '01.03.2025',
      ageAtReport: '1 Jahr, 6 Monate',
      periodFrom: '01.06.2026',
      periodTo: '31.08.2026',
      createdAt: '03.09.2026',
    },
  ],
};

/** A real chart SVG, so the spec exercises the actual PDF SVG parsing path. */
function chartSvg(): string {
  return renderGrowthChartSvg({
    width: 531,
    height: 250,
    series: [
      { id: 'a', ageInDays: 0, value: 3300 },
      { id: 'b', ageInDays: 90, value: 5600 },
    ],
    bands: [3, 50, 97].map((percentile) => ({
      percentile,
      points: Array.from({ length: 10 }, (_unused, week) => ({
        ageInDays: week * 14,
        value: 3200 + week * 200 + (percentile - 50) * 15,
      })),
    })),
    maxAgeDays: 120,
    colors: {
      series: '#4338ca',
      band: '#4338ca',
      axis: '#e2e8f0',
      label: '#64748b',
      markerHalo: '#ffffff',
    },
    formatValue: (value) => (value / 1000).toFixed(1),
    formatAgeTick: (ageInDays) => `${Math.round(ageInDays / 30.4375)} M`,
    formatBandLabel: (percentile) => `P${percentile}`,
  });
}

const EVERY_BLOCK_KIND: ReportDocument = {
  locale: 'de',
  title: 'Bericht für Mila',
  blocks: [
    ...HEADER_ONLY.blocks,
    { kind: 'sectionHeading', text: 'Wachstum' },
    { kind: 'chart', title: 'Gewicht im Verlauf', svg: chartSvg() },
    {
      kind: 'table',
      caption: 'Messwerte',
      columns: ['Datum', 'Alter', 'Gewicht (kg)', 'Perzentile'],
      rows: [
        ['01.06.2026', '15 Monate', '9,8', 'P52'],
        ['01.07.2026', '16 Monate', '10,1', 'P54'],
      ],
    },
    { kind: 'sectionHeading', text: 'Meilensteine' },
    { kind: 'emptySectionNote', text: 'Keine Daten in diesem Zeitraum.' },
    { kind: 'sectionHeading', text: 'Alltags-Tracking' },
    {
      kind: 'keyFigures',
      figures: [
        { label: 'Fütterungen/Tag', value: '6,2' },
        { label: 'Schlaf/Tag (Std.)', value: '13,4' },
        { label: 'Windeln/Tag', value: '5,8' },
      ],
    },
    { kind: 'bodyText', text: 'Durchschnitt pro Tag über 92 Tage' },
  ],
};

describe('ReactPdfRenderer', () => {
  const renderer = new ReactPdfRenderer();

  it('renders a minimal document to a PDF buffer', async () => {
    const buffer = await renderer.render(HEADER_ONLY);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, PDF_MAGIC.length).toString('latin1')).toBe(PDF_MAGIC);
  });

  it('renders every block kind without error', async () => {
    // A smoke test on purpose: asserting pixels would pin the layout, which is
    // exactly the thing the design tokens are allowed to change.
    const buffer = await renderer.render(EVERY_BLOCK_KIND);

    expect(buffer.subarray(0, PDF_MAGIC.length).toString('latin1')).toBe(PDF_MAGIC);
    expect(buffer.length).toBeGreaterThan(HEADER_ONLY.blocks.length * 100);
  });

  it('renders an English document', async () => {
    const buffer = await renderer.render({ ...EVERY_BLOCK_KIND, locale: 'en' });

    expect(buffer.subarray(0, PDF_MAGIC.length).toString('latin1')).toBe(PDF_MAGIC);
  });

  it('registers the report fonts exactly once across renders', async () => {
    // Font.register mutates a module-level registry in react-pdf, so calling it
    // per report would grow it unboundedly in a long-lived server process.
    registerReportFonts();
    const register = jest.spyOn(Font, 'register');

    registerReportFonts();
    await renderer.render(HEADER_ONLY);
    await renderer.render(HEADER_ONLY);

    expect(register).not.toHaveBeenCalled();
    register.mockRestore();
  });
});
