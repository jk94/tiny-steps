import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { GrowthReferenceResponse } from '../../api/growth-api';
import GrowthChart from './GrowthChart';
import type { GrowthPoint } from './growthChartData';

vi.mock('@visx/event', () => ({
  // jsdom reports no SVG geometry, so the real `localPoint` cannot resolve
  // coordinates. The stub maps the event's clientX straight through, and the
  // chart is rendered at a width where that x maps back onto a known age.
  localPoint: (_node: unknown, event: { clientX?: number }) => ({
    x: event.clientX ?? 0,
    y: 0,
  }),
}));

/** Matches `MARGIN` in GrowthChartInner: left 44 + right 34 => 400px plot. */
const CHART_WIDTH = 478;
const MAX_AGE_DAYS = 400;

const series: GrowthPoint[] = [
  {
    measurementId: 'm-0',
    ageInDays: 0,
    value: 3400,
    measuredAt: '2025-01-01T09:00:00.000Z',
    percentile: { status: 'COMPUTED', zScore: 0.1, percentile: 54 },
    position: null,
  },
  {
    measurementId: 'm-200',
    ageInDays: 200,
    value: 7800,
    measuredAt: '2025-07-20T09:00:00.000Z',
    percentile: { status: 'COMPUTED', zScore: -0.3, percentile: 38 },
    position: null,
  },
  {
    measurementId: 'm-400',
    ageInDays: 400,
    value: 9600,
    measuredAt: '2026-02-05T09:00:00.000Z',
    percentile: { status: 'UNAVAILABLE', reason: 'CHILD_SEX_NOT_SET' },
    position: null,
  },
];

function makeReference(): GrowthReferenceResponse {
  const percentiles = [3, 15, 50, 85, 97];
  return {
    indicator: 'WEIGHT_FOR_AGE',
    sex: 'MALE',
    available: true,
    xUnit: 'DAYS',
    unit: 'GRAMS',
    ageRangeDays: [0, 1826],
    stepDays: 100,
    lengthToHeightBoundaryDays: 731,
    curves: percentiles.map((percentile, index) => ({
      percentile,
      zScore: index - 2,
      points: [0, 100, 200, 300, 400].map((ageInDays) => ({
        ageInDays,
        value: 3000 + ageInDays * 15 + index * 500,
      })),
    })),
  };
}

function renderChart(reference: GrowthReferenceResponse | null = makeReference()) {
  return render(
    <GrowthChart
      measure="WEIGHT"
      series={series}
      reference={reference}
      maxAgeDays={MAX_AGE_DAYS}
      fixedWidth={CHART_WIDTH}
    />,
  );
}

describe('GrowthChart', () => {
  it('renders one marker per measurement', () => {
    renderChart();

    expect(screen.getAllByTestId('growth-series-marker')).toHaveLength(series.length);
  });

  describe('W-12: WHO reference bands', () => {
    it('draws all five percentile curves and the four corridors between them', () => {
      renderChart();

      for (const percentile of [3, 15, 50, 85, 97]) {
        expect(screen.getByTestId(`growth-percentile-line-${percentile}`)).toBeInTheDocument();
      }
      for (const [lower, upper] of [
        [3, 15],
        [15, 50],
        [50, 85],
        [85, 97],
      ]) {
        expect(screen.getByTestId(`growth-band-${lower}-${upper}`)).toBeInTheDocument();
      }
    });

    it('labels each curve with its percentile', () => {
      renderChart();

      expect(screen.getByText('P50')).toBeInTheDocument();
      expect(screen.getByText('P97')).toBeInTheDocument();
    });
  });

  describe('W-11: no reference available', () => {
    it('renders the series alone when there is no reference', () => {
      renderChart(null);

      expect(screen.getByTestId('growth-series-line')).toBeInTheDocument();
      expect(screen.queryByTestId('growth-percentile-line-50')).not.toBeInTheDocument();
      expect(screen.queryByTestId('growth-band-15-50')).not.toBeInTheDocument();
    });

    it('renders the series alone when the reference is unavailable', () => {
      renderChart({
        indicator: 'WEIGHT_FOR_AGE',
        sex: null,
        available: false,
        reason: 'CHILD_SEX_NOT_SET',
      });

      expect(screen.getByTestId('growth-series-line')).toBeInTheDocument();
      expect(screen.queryByTestId('growth-percentile-line-50')).not.toBeInTheDocument();
    });
  });

  it('renders no animation attributes at all (reduced motion by construction)', () => {
    const { container } = renderChart();

    expect(container.querySelector('animate')).toBeNull();
    expect(container.querySelector('animateTransform')).toBeNull();
    expect(container.querySelector('[style*="transition"]')).toBeNull();
  });

  describe('W-13: pointer inspection', () => {
    it('shows the nearest point date, value and percentile on pointer move', async () => {
      const user = userEvent.setup();
      renderChart();

      // x = 44 (left margin) + 200 px => age 200 on a 400 px / 400 day plot.
      await user.pointer({
        target: screen.getByTestId('growth-chart-overlay'),
        coords: { clientX: 244, clientY: 40 },
      });

      const tooltip = await screen.findByTestId('growth-chart-tooltip');
      expect(within(tooltip).getByText('7.8 kg')).toBeInTheDocument();
      expect(within(tooltip).getByText('38th percentile')).toBeInTheDocument();
    });

    it('shows the reason instead of a percentile when it could not be computed (W-10)', async () => {
      const user = userEvent.setup();
      renderChart();

      await user.pointer({
        target: screen.getByTestId('growth-chart-overlay'),
        coords: { clientX: 444, clientY: 40 },
      });

      const tooltip = await screen.findByTestId('growth-chart-tooltip');
      expect(within(tooltip).getByText("Percentiles need the child's sex.")).toBeInTheDocument();
    });
  });

  describe('W-14: keyboard operation', () => {
    it('moves point to point with the arrow keys and announces the active value', async () => {
      const user = userEvent.setup();
      renderChart();

      const slider = screen.getByTestId('growth-chart-overlay');
      slider.focus();
      expect(slider).toHaveFocus();
      expect(slider).toHaveAttribute('aria-valuemax', '2');

      await user.keyboard('{ArrowRight}');
      expect(slider).toHaveAttribute('aria-valuenow', '0');
      expect(screen.getByTestId('growth-chart-readout')).toHaveTextContent('3.4 kg');

      await user.keyboard('{ArrowRight}');
      expect(slider).toHaveAttribute('aria-valuenow', '1');
      expect(screen.getByTestId('growth-chart-readout')).toHaveTextContent('7.8 kg');
      expect(screen.getByTestId('growth-chart-readout')).toHaveTextContent('38th percentile');
    });

    it('stays on the first point when arrowing left at the start', async () => {
      const user = userEvent.setup();
      renderChart();

      const slider = screen.getByTestId('growth-chart-overlay');
      slider.focus();

      await user.keyboard('{ArrowRight}{ArrowLeft}{ArrowLeft}');

      expect(slider).toHaveAttribute('aria-valuenow', '0');
    });

    it('jumps to the last point with End and clears the cursor with Escape', async () => {
      const user = userEvent.setup();
      renderChart();

      const slider = screen.getByTestId('growth-chart-overlay');
      slider.focus();

      await user.keyboard('{End}');
      expect(slider).toHaveAttribute('aria-valuenow', '2');

      await user.keyboard('{Escape}');
      expect(screen.getByTestId('growth-chart-readout')).toHaveTextContent('');
      expect(screen.queryByTestId('growth-chart-tooltip')).not.toBeInTheDocument();
    });

    it('exposes a visible focus ring bound to the ring token', () => {
      renderChart();

      expect(screen.getByTestId('growth-chart-overlay').getAttribute('class')).toContain(
        'focus-visible:outline-[var(--color-ring)]',
      );
    });

    it('is reachable in the tab order and labelled as a slider', () => {
      renderChart();

      const slider = screen.getByRole('slider', { name: /Weight trend/i });
      expect(slider).toHaveAttribute('tabindex', '0');
      expect(slider).toHaveAttribute('aria-valuemin', '0');
    });
  });
});
