import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/http-client';
import { mapDiaperError } from './mapDiaperError';

describe('mapDiaperError', () => {
  it('maps a 404 to notFound regardless of context', () => {
    expect(mapDiaperError(new ApiError(404, {}), 'update')).toBe('diaper.errors.notFound');
  });

  it('maps a 400 to invalidInput regardless of context', () => {
    expect(mapDiaperError(new ApiError(400, {}), 'create')).toBe('diaper.errors.invalidInput');
  });

  it('maps a 409 (unexpected, no diaper conflict case exists) to the generic key', () => {
    expect(mapDiaperError(new ApiError(409, {}), 'create')).toBe('diaper.errors.generic');
  });

  it('maps any other status or non-ApiError to generic', () => {
    expect(mapDiaperError(new ApiError(500, {}), 'create')).toBe('diaper.errors.generic');
    expect(mapDiaperError(new Error('network down'), 'delete')).toBe('diaper.errors.generic');
  });
});
