import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { GrowthChartStatic, type GrowthChartStaticProps } from './GrowthChartStatic.js';
import type { GrowthChartBand } from './growthChartScales.js';

const COLORS = {
  series: '#0ea5e9',
  band: '#94a3b8',
  axis: '#cbd5e1',
  label: '#64748b',
  markerHalo: '#ffffff',
};

const PERCENTILES = [3, 15, 50, 85, 97];

function buildBands(): GrowthChartBand[] {
  return PERCENTILES.map((percentile) => ({
    percentile,
    points: Array.from({ length: 13 }, (_unused, month) => ({
      ageInDays: month * 30,
      value: 3000 + month * 300 + (percentile - 50) * 20,
    })),
  }));
}

function renderChart(overrides: Partial<GrowthChartStaticProps> = {}) {
  const props: GrowthChartStaticProps = {
    width: 600,
    height: 288,
    series: [
      { id: 'a', ageInDays: 0, value: 3200 },
      { id: 'b', ageInDays: 90, value: 5600 },
      { id: 'c', ageInDays: 180, value: 7400, position: 'RECUMBENT' },
    ],
    bands: buildBands(),
    maxAgeDays: 365,
    colors: COLORS,
    formatValue: (value) => (value / 1000).toFixed(1),
    formatAgeTick: (ageInDays) => `${Math.round(ageInDays / 30.4375)}M`,
    formatBandLabel: (percentile) => `P${percentile}`,
    ...overrides,
  };
  return render(<GrowthChartStatic {...props} />);
}

describe('GrowthChartStatic', () => {
  it('draws one stacked area between each adjacent pair of percentile curves', () => {
    const { container } = renderChart();

    // Five curves bound four corridors (P3–P15 … P85–P97).
    expect(container.querySelectorAll('[data-testid^="growth-band-3"]')).toHaveLength(1);
    expect(
      container.querySelectorAll('[data-testid^="growth-band-"]:not([data-testid*="label"])'),
    ).toHaveLength(PERCENTILES.length - 1);
    expect(container.querySelectorAll('[data-testid^="growth-percentile-line-"]')).toHaveLength(
      PERCENTILES.length,
    );
  });

  it('renders one marker per series point and carries the measurement method', () => {
    const { container } = renderChart();

    const markers = container.querySelectorAll('[data-testid="growth-series-marker"]');
    expect(markers).toHaveLength(3);
    expect(markers[2].getAttribute('data-position')).toBe('RECUMBENT');
    expect(markers[0].hasAttribute('data-position')).toBe(false);
  });

  it('labels every band and every axis tick through the format props', () => {
    const { container } = renderChart();

    for (const percentile of PERCENTILES) {
      expect(
        container.querySelector(`[data-testid="growth-band-label-${percentile}"]`)?.textContent,
      ).toBe(`P${percentile}`);
    }
    // Month ticks every three months up to the 365-day right edge: 0, 3, 6, 9
    // — month 12 sits at 365.25 days, just past the edge.
    expect(container.querySelectorAll('[data-testid="growth-axis-tick-x"]')).toHaveLength(4);
    expect(container.querySelectorAll('[data-testid="growth-axis-tick-y"]').length).toBeGreaterThan(
      0,
    );
  });

  it('renders the bands without a series line when there are no measurements', () => {
    const { container } = renderChart({ series: [] });

    expect(container.querySelectorAll('[data-testid="growth-series-marker"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-testid^="growth-percentile-line-"]')).toHaveLength(
      PERCENTILES.length,
    );
  });

  it('renders the series without bands when no reference is available (W-11)', () => {
    const { container } = renderChart({ bands: [] });

    expect(container.querySelectorAll('[data-testid^="growth-percentile-line-"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-testid="growth-series-marker"]')).toHaveLength(3);
    expect(container.querySelector('[data-testid="growth-series-line"]')).not.toBeNull();
  });

  it('renders nothing when the available width leaves no plot area', () => {
    const { container } = renderChart({ width: 40 });

    expect(container.querySelector('svg')).toBeNull();
  });

  it('places the overlay inside the margin-translated plot group', () => {
    const { container } = renderChart({
      overlay: <rect data-testid="test-overlay" width={10} height={10} />,
    });

    const overlay = container.querySelector('[data-testid="test-overlay"]');
    expect(overlay?.parentElement?.getAttribute('transform')).toBe('translate(44, 12)');
  });

  it('only exposes an img role when an aria-label is supplied', () => {
    const { container: withoutLabel } = renderChart();
    expect(withoutLabel.querySelector('svg')?.hasAttribute('role')).toBe(false);

    const { container: withLabel } = renderChart({ ariaLabel: 'Gewichtsverlauf' });
    expect(withLabel.querySelector('svg')?.getAttribute('role')).toBe('img');
    expect(withLabel.querySelector('svg')?.getAttribute('aria-label')).toBe('Gewichtsverlauf');
  });
});
