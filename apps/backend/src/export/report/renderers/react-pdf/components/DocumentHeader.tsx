import { Text, View } from '@react-pdf/renderer';
import type { DocumentHeaderBlock } from '../../../report-document.types';
import type { ReportStrings } from '../../../report-i18n/report-i18n';
import { reportStyles as styles } from '../styles';

export interface DocumentHeaderProps {
  block: DocumentHeaderBlock;
  /**
   * The renderer's one exception to "renderers do no i18n": the header's field
   * *labels* are pure chrome with no data in them, and threading five more
   * pre-translated strings through the block type would only move the same
   * lookup one layer up.
   */
  strings: ReportStrings;
}

/** EXP-3: who the report is about, and what period it covers. */
export function DocumentHeader({ block, strings }: DocumentHeaderProps) {
  const rows: [string, string][] = [
    [strings.t('header.birthDate'), block.birthDate],
    [strings.t('header.age'), block.ageAtReport],
    [
      strings.t('header.period'),
      strings.t('header.periodRange', { from: block.periodFrom, to: block.periodTo }),
    ],
    [strings.t('header.createdAt'), block.createdAt],
  ];

  return (
    <View>
      <Text style={styles.documentTitle}>{block.childName}</Text>
      <View style={styles.headerCard}>
        {rows.map(([label, value]) => (
          <View key={label} style={styles.headerRow}>
            <Text style={styles.headerLabel}>{label}</Text>
            <Text style={styles.headerValue}>{value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
