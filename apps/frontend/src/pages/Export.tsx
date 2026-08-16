import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { downloadExport } from '../api/export-api';
import type { ExportFormat } from '../api/export-api';
import { ErrorMessage } from '../components/ErrorMessage';
import { Button, Card, Input } from '../components/ui';

/**
 * Converts a `<input type="date">` value (`YYYY-MM-DD`, or empty) to a UTC
 * instant. `from` maps to the start of that day; `to` maps to the start of the
 * *next* day, so the picked end date is inclusive against the backend's
 * exclusive `[from, to)` filter. Deliberately UTC-anchored (not local) so the
 * conversion is deterministic regardless of the browser timezone.
 */
function dayStartUtcIso(value: string): string | undefined {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : undefined;
}

function nextDayStartUtcIso(value: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

/** Triggers a browser "Save as" for a fetched blob via a transient anchor. */
function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Child-level raw-data export page: pick a format (JSON/CSV) and an optional
 * date range, then download. Follows `DailyTimeline`'s page structure
 * (`useParams`, back link, shared state components); the download itself is a
 * one-shot action rather than a React Query cache entry, so it's driven by
 * local state + an async handler instead of `useQuery`. The format picker is
 * a two-`Button` toggle (per the mockup), not native radios — `aria-pressed`
 * conveys the selected one.
 */
export function Export() {
  const { t } = useTranslation();
  const { householdId, childId } = useParams<{ householdId: string; childId: string }>();

  const [format, setFormat] = useState<ExportFormat>('json');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleDownload = async () => {
    setFailed(false);
    setIsDownloading(true);
    try {
      const { blob, filename } = await downloadExport(
        householdId!,
        childId!,
        format,
        dayStartUtcIso(from),
        nextDayStartUtcIso(to),
      );
      saveBlob(blob, filename ?? `export-${childId}.${format}`);
    } catch {
      setFailed(true);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-sm">
      <Link
        to={`/households/${householdId}/children/${childId}/timeline`}
        className="mb-4 inline-block text-sm font-medium text-primary hover:underline"
      >
        {t('export.backLink')}
      </Link>
      <Card>
        <Card.Body className="flex flex-col gap-4">
          <h1 className="text-xl font-bold text-foreground">{t('export.title')}</h1>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">{t('export.formatLabel')}</span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={format === 'json' ? 'primary' : 'secondary'}
                aria-pressed={format === 'json'}
                className="flex-1"
                onClick={() => setFormat('json')}
              >
                {t('export.formatJson')}
              </Button>
              <Button
                type="button"
                variant={format === 'csv' ? 'primary' : 'secondary'}
                aria-pressed={format === 'csv'}
                className="flex-1"
                onClick={() => setFormat('csv')}
              >
                {t('export.formatCsv')}
              </Button>
            </div>
          </div>

          <Input
            label={t('export.fromLabel')}
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
          <Input
            label={t('export.toLabel')}
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />

          <Button
            type="button"
            variant="primary"
            className="w-full"
            onClick={() => void handleDownload()}
            isLoading={isDownloading}
          >
            {isDownloading ? t('export.downloadButtonPending') : t('export.downloadButton')}
          </Button>

          {failed && <ErrorMessage message={t('export.error')} />}
        </Card.Body>
      </Card>
    </section>
  );
}
