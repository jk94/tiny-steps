import { describe, expect, it } from 'vitest';
import { renderGrowthChartSvg } from './server.js';
import type { GrowthChartStaticProps } from './GrowthChartStatic.js';

const BASE_PROPS: GrowthChartStaticProps = {
  width: 760,
  height: 320,
  series: [
    { id: 'a', ageInDays: 0, value: 3200 },
    { id: 'b', ageInDays: 120, value: 6100 },
  ],
  bands: [3, 50, 97].map((percentile) => ({
    percentile,
    points: Array.from({ length: 7 }, (_unused, month) => ({
      ageInDays: month * 30,
      value: 3000 + month * 400 + (percentile - 50) * 25,
    })),
  })),
  maxAgeDays: 365,
  colors: {
    series: '#0ea5e9',
    band: '#94a3b8',
    axis: '#cbd5e1',
    label: '#64748b',
    markerHalo: '#ffffff',
  },
  formatValue: (value) => (value / 1000).toFixed(1),
  formatAgeTick: (ageInDays) => `${Math.round(ageInDays / 30.4375)}M`,
  formatBandLabel: (percentile) => `P${percentile}`,
};

describe('renderGrowthChartSvg', () => {
  it('returns a standalone SVG document string', () => {
    const svg = renderGrowthChartSvg(BASE_PROPS);

    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    expect(svg).toContain('viewBox="0 0 760 320"');
  });

  it('draws one marker per measurement', () => {
    const svg = renderGrowthChartSvg(BASE_PROPS);

    expect(svg.match(/data-testid="growth-series-marker"/g)).toHaveLength(2);
  });

  it('emits only literal colors, never CSS custom properties', () => {
    const svg = renderGrowthChartSvg(BASE_PROPS);

    // `var(--…)` resolves to nothing outside a browser, so a leaked custom
    // property would silently render the chart in black — or not at all.
    expect(svg).not.toContain('var(--');
    expect(svg).toContain('#0ea5e9');
  });

  it('strips the empty transform attributes that break the PDF renderer', () => {
    const svg = renderGrowthChartSvg(BASE_PROPS);

    expect(svg).not.toContain('transform=""');
    // The real, non-empty transforms must survive.
    expect(svg).toContain('transform="translate(44, 12)"');
  });

  it('returns an empty string when the width leaves no plot area', () => {
    expect(renderGrowthChartSvg({ ...BASE_PROPS, width: 40 })).toBe('');
  });
});
