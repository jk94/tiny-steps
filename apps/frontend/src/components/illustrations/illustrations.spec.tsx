import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as illustrations from './index';

const components = Object.entries(illustrations).filter(([name]) =>
  name.endsWith('Illustration'),
) as [string, (props: illustrations.IllustrationProps) => React.JSX.Element][];

describe('illustrations', () => {
  it('exports the whole set', () => {
    expect(components.map(([name]) => name).sort()).toEqual(
      [
        'BabyIllustration',
        'DevelopmentIllustration',
        'DiaperIllustration',
        'FeedingIllustration',
        'FootprintsIllustration',
        'GrowthIllustration',
        'HealthIllustration',
        'HeartsIllustration',
        'HomeIllustration',
        'MilestoneIllustration',
        'SleepIllustration',
        'SpeechIllustration',
        'ToothIllustration',
      ].sort(),
    );
  });

  it.each(components)('%s is decorative by default', (_name, Illustration) => {
    const { container } = render(<Illustration className="h-10 w-10" />);

    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('viewBox', '0 0 120 120');
    expect(svg).toHaveClass('h-10', 'w-10');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it.each(components)('%s becomes a named image when given a title', (_name, Illustration) => {
    render(<Illustration title="A picture" />);

    expect(screen.getByRole('img', { name: 'A picture' })).toBeInTheDocument();
  });
});
