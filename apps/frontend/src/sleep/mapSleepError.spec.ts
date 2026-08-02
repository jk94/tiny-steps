import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/http-client';
import { mapSleepError } from './mapSleepError';

describe('mapSleepError', () => {
  it('maps a 404 to notFound regardless of context', () => {
    expect(mapSleepError(new ApiError(404, {}), 'update')).toBe('sleep.errors.notFound');
  });

  it('maps a 400 to invalidInput regardless of context', () => {
    expect(mapSleepError(new ApiError(400, {}), 'create')).toBe('sleep.errors.invalidInput');
  });

  it('maps a 409 on create to timerConflict (active-timer-already-running)', () => {
    expect(mapSleepError(new ApiError(409, {}), 'create')).toBe('sleep.errors.timerConflict');
  });

  it('maps a 409 on stop to timerAlreadyStopped', () => {
    expect(mapSleepError(new ApiError(409, {}), 'stop')).toBe('sleep.errors.timerAlreadyStopped');
  });

  it('maps a 409 on update/delete (unexpected) to the generic key', () => {
    expect(mapSleepError(new ApiError(409, {}), 'update')).toBe('sleep.errors.generic');
    expect(mapSleepError(new ApiError(409, {}), 'delete')).toBe('sleep.errors.generic');
  });

  it('maps any other status or non-ApiError to generic', () => {
    expect(mapSleepError(new ApiError(500, {}), 'create')).toBe('sleep.errors.generic');
    expect(mapSleepError(new Error('network down'), 'create')).toBe('sleep.errors.generic');
  });
});
