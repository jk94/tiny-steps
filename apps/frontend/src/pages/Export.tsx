import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { downloadExport } from '../api/export-api';
import type { ExportFormat } from '../api/export-api';
import { ErrorMessage } from '../components/ErrorMessage';

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
 * local state + an async handler instead of `useQuery`.
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
    <section>
      <Link to={`/households/${householdId}/children/${childId}/timeline`}>
        {t('export.backLink')}
      </Link>
      <h1>{t('export.title')}</h1>

      <fieldset>
        <legend>{t('export.formatLabel')}</legend>
        <label>
          <input
            type="radio"
            name="export-format"
            value="json"
            checked={format === 'json'}
            onChange={() => setFormat('json')}
          />
          {t('export.formatJson')}
        </label>
        <label>
          <input
            type="radio"
            name="export-format"
            value="csv"
            checked={format === 'csv'}
            onChange={() => setFormat('csv')}
          />
          {t('export.formatCsv')}
        </label>
      </fieldset>

      <label>
        {t('export.fromLabel')}
        <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
      </label>
      <label>
        {t('export.toLabel')}
        <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
      </label>

      <button type="button" onClick={handleDownload} disabled={isDownloading}>
        {isDownloading ? t('export.downloadButtonPending') : t('export.downloadButton')}
      </button>

      {failed && <ErrorMessage message={t('export.error')} />}
    </section>
  );
}
