import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { Export } from './Export';
import * as exportApi from '../api/export-api';

vi.mock('../api/export-api');

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
});
