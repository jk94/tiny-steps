import { apiFetchBlob } from './http-client';
import type { BlobResponse } from './http-client';

export type ExportFormat = 'json' | 'csv';

function exportPath(householdId: string, childId: string, format: ExportFormat): string {
  return `/households/${householdId}/children/${childId}/export/${format}`;
}

/**
 * Builds the optional `?from=&to=` range query. Both bounds are only sent when
 * present — the backend's `ExportQueryDto` treats them as optional (omitting
 * both exports the child's full history), unlike the required range on
 * `/events/daily`.
 */
function optionalRangeQuery(from?: string, to?: string): string {
  const params = new URLSearchParams();
  if (from) {
    params.set('from', from);
  }
  if (to) {
    params.set('to', to);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

/**
 * Downloads a child's raw-data export in the requested format, returning the
 * blob plus the server-provided filename. The caller is responsible for
 * triggering the browser save (see `Export.tsx`).
 */
export function downloadExport(
  householdId: string,
  childId: string,
  format: ExportFormat,
  from?: string,
  to?: string,
): Promise<BlobResponse> {
  return apiFetchBlob(`${exportPath(householdId, childId, format)}${optionalRangeQuery(from, to)}`);
}
