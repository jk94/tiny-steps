import type { ComponentProps } from 'react';
import { Image, Text, View } from '@react-pdf/renderer';
import type {
  BodyTextBlock,
  ChartBlock,
  EmptySectionNoteBlock,
  KeyFiguresBlock,
  SectionHeadingBlock,
  TableBlock,
} from '../../../report-document.types';
import { reportStyles as styles } from '../styles';

/**
 * One component per `ReportBlock` kind. They are deliberately dumb: every
 * string they receive is already translated and formatted (see
 * `report-document.types.ts`), so nothing here decides what a value means —
 * only how it looks.
 */

export function SectionHeading({ block }: { block: SectionHeadingBlock }) {
  // `wrap={false}` keeps a heading from being the last thing on a page with its
  // content orphaned onto the next one.
  return (
    <Text style={styles.sectionHeading} wrap={false}>
      {block.text}
    </Text>
  );
}

export function BodyText({ block }: { block: BodyTextBlock }) {
  return <Text style={styles.bodyText}>{block.text}</Text>;
}

export function EmptySectionNote({ block }: { block: EmptySectionNoteBlock }) {
  return <Text style={styles.emptySectionNote}>{block.text}</Text>;
}

export function KeyFigures({ block }: { block: KeyFiguresBlock }) {
  return (
    <View style={styles.keyFigureRow} wrap={false}>
      {block.figures.map((figure) => (
        <View key={figure.label} style={styles.keyFigure}>
          <Text style={styles.keyFigureValue}>{figure.value}</Text>
          <Text style={styles.keyFigureLabel}>{figure.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function DataTable({ block }: { block: TableBlock }) {
  return (
    <View>
      {block.caption && <Text style={styles.tableCaption}>{block.caption}</Text>}
      {/* `fixed` repeats the header on every page a long table spills onto. */}
      <View style={styles.tableHeaderRow} fixed>
        {block.columns.map((column, index) => (
          <Text key={`${column}-${index}`} style={styles.tableHeaderCell}>
            {column}
          </Text>
        ))}
      </View>
      {block.rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.tableRow} wrap={false}>
          {row.map((cell, cellIndex) => (
            <Text key={cellIndex} style={styles.tableCell}>
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * An in-memory SVG source for `<Image>`.
 *
 * `@react-pdf/renderer` 4.9 parses SVG data through `@react-pdf/svg` at
 * runtime (verified end to end by the Phase 7.4 spike — see ADR-0015), but its
 * published `ImageProps` type still only lists `'png' | 'jpg'`. The cast is
 * narrowed to exactly this shape rather than spread over the JSX, so it stops
 * compiling the moment the upstream types are widened and this can be deleted.
 */
type ImageSource = Extract<ComponentProps<typeof Image>, { src: unknown }>['src'];

function svgImageSource(svg: string): ImageSource {
  return { data: Buffer.from(svg, 'utf8'), format: 'svg' } as unknown as ImageSource;
}

export function ChartImage({ block }: { block: ChartBlock }) {
  return (
    <View wrap={false}>
      <Text style={styles.chartTitle}>{block.title}</Text>
      {/*
        The chart travels as an SVG *string* and is drawn as vectors, so the
        curve stays sharp at any print resolution, unlike a rasterised image.
        Passed as an in-memory source rather than a path: it is generated per
        request and never touches disk.
      */}
      <Image style={styles.chart} src={svgImageSource(block.svg)} />
    </View>
  );
}
