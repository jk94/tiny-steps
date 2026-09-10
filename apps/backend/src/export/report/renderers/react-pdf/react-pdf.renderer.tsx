import { Injectable } from '@nestjs/common';
import { Document, Page, Text, View, renderToBuffer } from '@react-pdf/renderer';
import type { ReportBlock, ReportDocument } from '../../report-document.types';
import { getReportStrings } from '../../report-i18n/report-i18n';
import type { ReportRenderer } from '../report-renderer.interface';
import {
  BodyText,
  ChartImage,
  DataTable,
  EmptySectionNote,
  KeyFigures,
  SectionHeading,
} from './components/blocks';
import { DocumentHeader } from './components/DocumentHeader';
import { registerReportFonts } from './register-fonts';
import { reportStyles as styles } from './styles';

/**
 * The built-in PDF renderer (EXP-10), and the only one this phase ships.
 *
 * `@react-pdf/renderer` has its own layout engine written in JavaScript: no
 * Chromium, no system binary, nothing added to the application image — which is
 * the whole reason it was chosen over a headless browser (see ADR-0015).
 *
 * It draws the `ReportDocument`'s blocks and nothing else. Every string it
 * renders arrives already translated and formatted, so this class contains no
 * date logic, no number formatting and no data access — the property that makes
 * the deferred external HTML renderer a purely additive change.
 */
@Injectable()
export class ReactPdfRenderer implements ReportRenderer {
  async render(document: ReportDocument): Promise<Buffer> {
    registerReportFonts();

    // Only used for the header's field labels — see `DocumentHeader`.
    const strings = getReportStrings(document.locale);

    return renderToBuffer(
      <Document title={document.title} language={document.locale}>
        <Page size="A4" style={styles.page}>
          {document.blocks.map((block, index) => (
            <ReportBlockView key={index} block={block} strings={strings} />
          ))}
          <PageNumber />
        </Page>
      </Document>,
    );
  }
}

function ReportBlockView({
  block,
  strings,
}: {
  block: ReportBlock;
  strings: ReturnType<typeof getReportStrings>;
}) {
  switch (block.kind) {
    case 'documentHeader':
      return <DocumentHeader block={block} strings={strings} />;
    case 'sectionHeading':
      return <SectionHeading block={block} />;
    case 'keyFigures':
      return <KeyFigures block={block} />;
    case 'table':
      return <DataTable block={block} />;
    case 'chart':
      return <ChartImage block={block} />;
    case 'bodyText':
      return <BodyText block={block} />;
    case 'emptySectionNote':
      return <EmptySectionNote block={block} />;
  }
}

/**
 * "n / m" in the bottom margin.
 *
 * Not a `ReportBlock`: page numbers are a property of *this* renderer's
 * pagination, and a renderer that paginated differently (or not at all) would
 * have to ignore such a block anyway.
 */
function PageNumber() {
  return (
    <View
      fixed
      style={{
        position: 'absolute',
        bottom: 16,
        left: 0,
        right: 0,
        textAlign: 'center',
      }}
    >
      <Text
        style={styles.keyFigureLabel}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}
