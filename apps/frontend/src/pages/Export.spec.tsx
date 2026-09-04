import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { Export } from './Export';
import * as exportApi from '../api/export-api';
import { ApiError } from '../api/http-client';

// Only the two network calls are stubbed. A bare `vi.mock` would automock the
// module's constants too — `REPORT_SECTIONS` would come back as an empty array
// and the report section would render no checkboxes at all.
vi.mock('../api/export-api', async (importOriginal) => ({
  ...(await importOriginal<typeof exportApi>()),
  downloadExport: vi.fn(),
  downloadReport: vi.fn(),
}));

const mockedExportApi = vi.mocked(exportApi);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';

let clickSpy: ReturnType<typeof vi.spyOn>;
let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;

function renderExport() {
  return render(
    <MemoryRouter initialEntries={[`/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/export`]}>
      <Routes>
        <Route path="/households/:householdId/children/:childId/export" element={<Export />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Export page', () => {
  beforeEach(() => {
    mockedExportApi.downloadExport.mockResolvedValue({
      blob: new Blob(['data']),
      filename: 'export-c1.json',
    });
    mockedExportApi.downloadReport.mockResolvedValue({
      blob: new Blob(['%PDF-']),
      filename: 'report-c1.pdf',
    });
    createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    });
    // Anchor `.click()` would otherwise attempt a real navigation in jsdom.
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
    clickSpy.mockRestore();
  });

  it('downloads JSON with no date range by default and triggers a browser save', async () => {
    const user = userEvent.setup();
    renderExport();

    await user.click(screen.getByRole('button', { name: 'Download' }));

    expect(mockedExportApi.downloadExport).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      CHILD_ID,
      'json',
      undefined,
      undefined,
    );
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('downloads CSV when the CSV format is selected', async () => {
    const user = userEvent.setup();
    renderExport();

    await user.click(screen.getByRole('button', { name: 'CSV' }));
    await user.click(screen.getByRole('button', { name: 'Download' }));

    expect(mockedExportApi.downloadExport).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      CHILD_ID,
      'csv',
      undefined,
      undefined,
    );
  });

  it('passes the selected date range as UTC instants, with an inclusive end day', async () => {
    const user = userEvent.setup();
    renderExport();

    await user.type(screen.getByLabelText('From (optional)'), '2026-01-01');
    await user.type(screen.getByLabelText('To (optional)'), '2026-01-05');
    await user.click(screen.getByRole('button', { name: 'Download' }));

    expect(mockedExportApi.downloadExport).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      CHILD_ID,
      'json',
      '2026-01-01T00:00:00.000Z',
      // "to" 2026-01-05 becomes the start of the next day so the picked end
      // date is included against the backend's exclusive [from, to) filter.
      '2026-01-06T00:00:00.000Z',
    );
  });

  it('uses the server-provided filename for the saved file', async () => {
    const user = userEvent.setup();
    let capturedDownload = '';
    clickSpy.mockImplementation(function (this: HTMLAnchorElement) {
      capturedDownload = this.download;
    });
    renderExport();

    await user.click(screen.getByRole('button', { name: 'Download' }));

    expect(capturedDownload).toBe('export-c1.json');
  });

  it('shows an error message when the download fails', async () => {
    const user = userEvent.setup();
    mockedExportApi.downloadExport.mockRejectedValueOnce(new Error('boom'));
    renderExport();

    await user.click(screen.getByRole('button', { name: 'Download' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "The export couldn't be generated. Please try again.",
    );
  });

  describe('report section', () => {
    const DOWNLOAD_REPORT = 'Download report';

    /** The report request the component made, ignoring the household/child ids. */
    function lastReportRequest() {
      return mockedExportApi.downloadReport.mock.calls.at(-1)![2];
    }

    it('preselects the last three months and every section', async () => {
      renderExport();

      expect(screen.getByRole('button', { name: 'Last 3 months' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      for (const label of [
        'Master data (always included)',
        'Growth',
        'Milestones',
        'Medications & vaccinations',
        'Tracking summary',
      ]) {
        expect(screen.getByLabelText(label)).toBeChecked();
      }
    });

    it('keeps the master-data section checked and non-deselectable', async () => {
      const user = userEvent.setup();
      renderExport();

      const core = screen.getByLabelText('Master data (always included)');
      expect(core).toBeDisabled();

      await user.click(screen.getByRole('button', { name: DOWNLOAD_REPORT }));

      expect(lastReportRequest().sections).toContain('CORE');
    });

    it('requests the selected period, sections and the active language', async () => {
      const user = userEvent.setup();
      vi.setSystemTime(new Date('2026-09-03T12:00:00.000Z'));
      renderExport();

      await user.click(screen.getByRole('button', { name: 'Last month' }));
      await user.click(screen.getByLabelText('Milestones'));
      await user.click(screen.getByRole('button', { name: DOWNLOAD_REPORT }));

      expect(mockedExportApi.downloadReport).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, {
        from: '2026-08-04T00:00:00.000Z',
        to: '2026-09-04T00:00:00.000Z',
        sections: ['CORE', 'GROWTH', 'MEDICAL', 'TRACKING'],
        locale: 'en',
      });
      vi.useRealTimers();
    });

    it('sends a custom range as UTC instants with an inclusive end day', async () => {
      const user = userEvent.setup();
      renderExport();

      await user.click(screen.getByRole('button', { name: 'Custom' }));
      const fromInput = screen.getByLabelText('From');
      const toInput = screen.getByLabelText('To');
      await user.clear(fromInput);
      await user.type(fromInput, '2026-01-01');
      await user.clear(toInput);
      await user.type(toInput, '2026-01-05');
      await user.click(screen.getByRole('button', { name: DOWNLOAD_REPORT }));

      expect(lastReportRequest()).toMatchObject({
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-01-06T00:00:00.000Z',
      });
    });

    it('saves the returned PDF under the server-provided filename', async () => {
      const user = userEvent.setup();
      let capturedDownload = '';
      clickSpy.mockImplementation(function (this: HTMLAnchorElement) {
        capturedDownload = this.download;
      });
      renderExport();

      await user.click(screen.getByRole('button', { name: DOWNLOAD_REPORT }));

      expect(capturedDownload).toBe('report-c1.pdf');
    });

    it('distinguishes "no data in this period" from a generic failure', async () => {
      const user = userEvent.setup();
      mockedExportApi.downloadReport.mockRejectedValueOnce(
        new ApiError(422, { code: 'REPORT_EMPTY_PERIOD' }),
      );
      renderExport();

      await user.click(screen.getByRole('button', { name: DOWNLOAD_REPORT }));
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'There is no data for the selected period and sections.',
      );

      mockedExportApi.downloadReport.mockRejectedValueOnce(new Error('boom'));
      await user.click(screen.getByRole('button', { name: DOWNLOAD_REPORT }));
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'The report could not be created. Please try again.',
      );
    });

    it('disables the button while the report is being generated', async () => {
      const user = userEvent.setup();
      let resolveDownload: (value: { blob: Blob; filename: string }) => void = () => {};
      mockedExportApi.downloadReport.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveDownload = resolve;
        }),
      );
      renderExport();

      await user.click(screen.getByRole('button', { name: DOWNLOAD_REPORT }));

      const pendingButton = screen.getByRole('button', { name: 'Creating report…' });
      expect(pendingButton).toBeDisabled();

      resolveDownload({ blob: new Blob(['%PDF-']), filename: 'report-c1.pdf' });
      expect(await screen.findByRole('button', { name: DOWNLOAD_REPORT })).toBeEnabled();
    });
  });
});
