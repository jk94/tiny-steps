import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  REPORT_SECTIONS,
  downloadReport,
  isEmptyPeriodError,
  type ReportSection as ReportSectionKey,
} from '../api/export-api';
import { ErrorMessage } from '../components/ErrorMessage';
import { Button, Card } from '../components/ui';
import { Input } from '../components/ui';

/** The quick period presets, plus the free-range escape hatch (EXP-1). */
const PERIOD_PRESETS = ['lastMonth', 'last3Months', 'lastYear', 'custom'] as const;

type PeriodPreset = (typeof PERIOD_PRESETS)[number];

/** Every preset except the free range, i.e. the ones with a fixed length. */
type FixedPeriodPreset = Exclude<PeriodPreset, 'custom'>;

/** Sensible default: a quarter is what a routine check-up looks back over. */
const DEFAULT_PRESET: FixedPeriodPreset = 'last3Months';

/** How many months back each preset reaches. `custom` is driven by the inputs. */
const PRESET_MONTHS: Record<FixedPeriodPreset, number> = {
  lastMonth: 1,
  last3Months: 3,
  lastYear: 12,
};

const PRESET_LABEL_KEYS = {
  lastMonth: 'export.report.periodLastMonth',
  last3Months: 'export.report.periodLast3Months',
  lastYear: 'export.report.periodLastYear',
  custom: 'export.report.periodCustom',
} as const;

// `as const` rather than `Record<ReportSectionKey, string>`: `t()` is typed
// against the actual key union (see i18n/i18next.d.ts), so widening these to
// `string` would give up compile-time checking of every label key.
const SECTION_LABEL_KEYS = {
  CORE: 'export.report.sectionCore',
  GROWTH: 'export.report.sectionGrowth',
  MILESTONES: 'export.report.sectionMilestones',
  MEDICAL: 'export.report.sectionMedical',
  TRACKING: 'export.report.sectionTracking',
} as const satisfies Record<ReportSectionKey, string>;

/**
 * Converts a `<input type="date">` value (`YYYY-MM-DD`) to a UTC instant.
 * Deliberately UTC-anchored, matching the raw-data export above it, so the
 * conversion is deterministic regardless of the browser timezone.
 */
function dayStartUtcIso(value: string): string {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

/** The picked end date is inclusive; the backend's `to` bound is exclusive. */
function nextDayStartUtcIso(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

/** `YYYY-MM-DD` in UTC, the value shape a date input expects. */
function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Start of the current day in UTC — the presets are whole-day ranges. */
function todayStartUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * The `[from, to)` instants a preset stands for, ending at the end of today.
 *
 * Both bounds are snapped to a UTC day boundary rather than the moment the
 * button is clicked, so the report header reads as a clean span
 * ("16.03.2026 – 15.06.2026") instead of a ragged one that ends "yesterday" at
 * whatever time of day the report happened to be generated. `to` is the
 * exclusive start of tomorrow, so anything logged today is still inside the
 * range.
 */
function presetRange(preset: Exclude<PeriodPreset, 'custom'>): { from: string; to: string } {
  const to = todayStartUtc();
  to.setUTCDate(to.getUTCDate() + 1);
  const from = new Date(to);
  from.setUTCMonth(from.getUTCMonth() - PRESET_MONTHS[preset]);
  return { from: from.toISOString(), to: to.toISOString() };
}

type DownloadState = 'idle' | 'pending' | 'emptyPeriod' | 'failed';

export interface ReportSectionProps {
  householdId: string;
  childId: string;
  /** Injected so the page owns the browser-save side effect in one place. */
  onDownloaded: (blob: Blob, filename: string) => void;
}

/**
 * The "Bericht" part of the export page (roadmap Phase 7.4): pick a period and
 * the sections to include, then download a PDF.
 *
 * Deliberately a section of the existing export page rather than its own route,
 * so every way of getting data out of the app sits in one place.
 */
export function ReportSection({ householdId, childId, onDownloaded }: ReportSectionProps) {
  const { t, i18n } = useTranslation();

  const [preset, setPreset] = useState<PeriodPreset>(DEFAULT_PRESET);
  const [customFrom, setCustomFrom] = useState(() =>
    toDateInputValue(new Date(presetRange(DEFAULT_PRESET).from)),
  );
  const [customTo, setCustomTo] = useState(() => toDateInputValue(new Date()));
  const [sections, setSections] = useState<ReportSectionKey[]>([...REPORT_SECTIONS]);
  const [state, setState] = useState<DownloadState>('idle');

  const toggleSection = (section: ReportSectionKey) => {
    setSections((current) =>
      current.includes(section)
        ? current.filter((entry) => entry !== section)
        : REPORT_SECTIONS.filter((entry) => entry === section || current.includes(entry)),
    );
  };

  const handleDownload = async () => {
    setState('pending');
    const range = preset === 'custom' ? null : presetRange(preset);
    try {
      const { blob, filename } = await downloadReport(householdId, childId, {
        from: range ? range.from : dayStartUtcIso(customFrom),
        to: range ? range.to : nextDayStartUtcIso(customTo),
        sections,
        locale: i18n.language,
      });
      onDownloaded(blob, filename ?? `report-${childId}.pdf`);
      setState('idle');
    } catch (error) {
      // Only two outcomes are distinguished. "Service unreachable" — the third
      // case the roadmap names — belongs to the external renderer, which this
      // phase deliberately does not ship (see ADR-0015); adding a message for
      // a state that cannot occur would only be a lie waiting to be believed.
      setState(isEmptyPeriodError(error) ? 'emptyPeriod' : 'failed');
    }
  };

  const isPending = state === 'pending';

  return (
    <Card className="mt-4">
      <Card.Body className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-foreground">{t('export.report.sectionTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('export.report.description')}</p>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">
            {t('export.report.periodLabel')}
          </span>
          <div className="grid grid-cols-2 gap-2">
            {PERIOD_PRESETS.map((entry) => (
              <Button
                key={entry}
                type="button"
                variant={preset === entry ? 'primary' : 'secondary'}
                aria-pressed={preset === entry}
                onClick={() => setPreset(entry)}
              >
                {t(PRESET_LABEL_KEYS[entry])}
              </Button>
            ))}
          </div>
        </div>

        {preset === 'custom' && (
          <>
            {/* Own labels rather than the raw export's "From (optional)": the
                report's period is mandatory, and two identically-labelled date
                inputs on one page would be ambiguous to a screen reader. */}
            <Input
              label={t('export.report.fromLabel')}
              type="date"
              value={customFrom}
              onChange={(event) => setCustomFrom(event.target.value)}
            />
            <Input
              label={t('export.report.toLabel')}
              type="date"
              value={customTo}
              onChange={(event) => setCustomTo(event.target.value)}
            />
          </>
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-foreground">
            {t('export.report.sectionsLabel')}
          </legend>
          {REPORT_SECTIONS.map((section) => {
            // CORE carries the child's name, birth date and the period. A
            // report without it is an anonymous page of numbers, so it is shown
            // as checked-and-disabled rather than hidden — the user can see
            // what the document will always contain.
            const isCore = section === 'CORE';
            return (
              <label key={section} className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={isCore || sections.includes(section)}
                  disabled={isCore}
                  onChange={() => toggleSection(section)}
                />
                {t(SECTION_LABEL_KEYS[section])}
              </label>
            );
          })}
        </fieldset>

        <Button
          type="button"
          variant="primary"
          className="w-full"
          onClick={() => void handleDownload()}
          isLoading={isPending}
        >
          {isPending ? t('export.report.downloadButtonPending') : t('export.report.downloadButton')}
        </Button>

        {state === 'emptyPeriod' && <ErrorMessage message={t('export.report.errorEmptyPeriod')} />}
        {state === 'failed' && <ErrorMessage message={t('export.report.errorGeneric')} />}
      </Card.Body>
    </Card>
  );
}
