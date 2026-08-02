import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/http-client';
import { mapFeedingError } from './mapFeedingError';

describe('mapFeedingError', () => {
  it('maps a 404 to notFound regardless of context', () => {
    expect(mapFeedingError(new ApiError(404, {}), 'update')).toBe('feeding.errors.notFound');
  });

  it('maps a 400 to invalidInput regardless of context', () => {
    expect(mapFeedingError(new ApiError(400, {}), 'create')).toBe('feeding.errors.invalidInput');
  });

  it('maps a 409 on create to timerConflict (active-timer-already-running)', () => {
    expect(mapFeedingError(new ApiError(409, {}), 'create')).toBe('feeding.errors.timerConflict');
  });

  it('maps a 409 on stop to timerAlreadyStopped', () => {
    expect(mapFeedingError(new ApiError(409, {}), 'stop')).toBe(
      'feeding.errors.timerAlreadyStopped',
    );
  });

  it('maps a 409 on update/delete (unexpected) to the generic key', () => {
    expect(mapFeedingError(new ApiError(409, {}), 'update')).toBe('feeding.errors.generic');
    expect(mapFeedingError(new ApiError(409, {}), 'delete')).toBe('feeding.errors.generic');
  });

  it('maps any other status or non-ApiError to generic', () => {
    expect(mapFeedingError(new ApiError(500, {}), 'create')).toBe('feeding.errors.generic');
    expect(mapFeedingError(new Error('network down'), 'create')).toBe('feeding.errors.generic');
  });
});
