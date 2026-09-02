import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/http-client';
import { mapMilestoneError } from './mapMilestoneError';

function apiError(status: number, body: unknown): ApiError {
  return new ApiError(status, body);
}

describe('mapMilestoneError', () => {
  it('maps the template-uniqueness conflict to its own actionable key (M-5)', () => {
    expect(mapMilestoneError(apiError(409, { code: 'MILESTONE_TEMPLATE_ALREADY_RECORDED' }))).toBe(
      'milestone.errors.templateAlreadyRecorded',
    );
  });

  it('maps the photo limit to its own actionable key (M-7)', () => {
    expect(mapMilestoneError(apiError(409, { code: 'MILESTONE_PHOTO_LIMIT_REACHED' }))).toBe(
      'milestone.errors.photoLimitReached',
    );
  });

  it.each([
    ['PHOTO_TOO_LARGE', 'milestone.errors.photoTooLarge'],
    ['PHOTO_INVALID_TYPE', 'milestone.errors.photoInvalidType'],
    ['PHOTO_UPLOAD_ERROR', 'milestone.errors.photoUploadError'],
    ['MILESTONE_TEMPLATE_FIELD_NOT_EDITABLE', 'milestone.errors.templateFieldNotEditable'],
  ])('maps the 400 code %s to %s', (code, expected) => {
    expect(mapMilestoneError(apiError(400, { code }))).toBe(expected);
  });

  it('names the single failing field of a validation error', () => {
    expect(
      mapMilestoneError(
        apiError(400, { code: 'VALIDATION_ERROR', fields: { title: ['title must be a string'] } }),
      ),
    ).toBe('milestone.errors.invalidTitle');
    expect(
      mapMilestoneError(
        apiError(400, {
          code: 'VALIDATION_ERROR',
          fields: { achievedAt: ['achievedAt must not be in the future'] },
        }),
      ),
    ).toBe('milestone.errors.invalidAchievedAt');
  });

  it('falls back to the generic invalid-input key when several fields failed', () => {
    expect(
      mapMilestoneError(
        apiError(400, { code: 'VALIDATION_ERROR', fields: { title: ['a'], achievedAt: ['b'] } }),
      ),
    ).toBe('milestone.errors.invalidInput');
  });

  it('maps 403 and 404 by status alone', () => {
    expect(mapMilestoneError(apiError(403, {}))).toBe('milestone.errors.forbidden');
    expect(mapMilestoneError(apiError(404, {}))).toBe('milestone.errors.notFound');
  });

  it('falls back to the generic key for an unknown code or a non-API failure', () => {
    expect(mapMilestoneError(apiError(400, { code: 'SOMETHING_NEW' }))).toBe(
      'milestone.errors.invalidInput',
    );
    expect(mapMilestoneError(apiError(500, {}))).toBe('milestone.errors.generic');
    expect(mapMilestoneError(new TypeError('offline'))).toBe('milestone.errors.generic');
  });
});
