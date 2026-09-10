import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GrowthChartStatic, type GrowthChartStaticProps } from './GrowthChartStatic.js';

/**
 * `@react-pdf/stylesheet`'s transform parser splits on `)` and then reads the
 * part before `(`; for an empty string it produces a malformed entry and
 * crashes on `value.map`. visx's `<Group>` emits exactly that — `transform=""`
 * — whenever it has no offset, so the attribute is stripped before the markup
 * ever reaches the PDF renderer. Removing a no-op transform is behaviour-
 * neutral for every other SVG consumer too.
 */
const EMPTY_TRANSFORM_ATTRIBUTE = /\s+transform=""/g;

/**
 * Renders the growth chart to a standalone SVG string, for consumers that
 * cannot mount React — chiefly the backend's PDF report, which hands the string
 * to `@react-pdf/renderer` as a vector image.
 *
 * `renderToStaticMarkup` needs no DOM: it walks the element tree and emits
 * markup, which is why the chart component is kept free of browser APIs.
 */
export function renderGrowthChartSvg(props: GrowthChartStaticProps): string {
  return renderToStaticMarkup(createElement(GrowthChartStatic, props)).replace(
    EMPTY_TRANSFORM_ATTRIBUTE,
    '',
  );
}
