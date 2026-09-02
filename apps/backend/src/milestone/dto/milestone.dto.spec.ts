import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { MilestoneCategory } from '../milestone-category.enum';
import { MilestoneTemplate } from '../milestone-template.enum';
import { MAX_MILESTONE_TITLE_LENGTH, MAX_NOTE_LENGTH } from '../milestone.constants';
import { CreateMilestoneDto } from './create-milestone.dto';
import { UpdateMilestoneDto } from './update-milestone.dto';

const ACHIEVED_AT = '2025-08-20';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Mirrors the global ValidationPipe's `transform: true` behaviour. */
function failingProperties<T extends object>(
  cls: new () => T,
  payload: Record<string, unknown>,
): string[] {
  const dto = plainToInstance(cls, payload);
  return validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).map(
    (error) => error.property,
  );
}

describe('CreateMilestoneDto', () => {
  it('accepts a template entry with a frozen title', () => {
    expect(
      failingProperties(CreateMilestoneDto, {
        templateKey: MilestoneTemplate.FIRST_STEPS,
        title: 'Erste Schritte',
        achievedAt: ACHIEVED_AT,
      }),
    ).toEqual([]);
  });

  it('accepts a free entry with its own title and category (M-4)', () => {
    expect(
      failingProperties(CreateMilestoneDto, {
        title: 'Erste Zugfahrt',
        category: MilestoneCategory.SOCIAL,
        achievedAt: ACHIEVED_AT,
      }),
    ).toEqual([]);
  });

  it('requires a title for both kinds of entry', () => {
    expect(
      failingProperties(CreateMilestoneDto, {
        templateKey: MilestoneTemplate.FIRST_STEPS,
        achievedAt: ACHIEVED_AT,
      }),
    ).toEqual(['title']);
    expect(failingProperties(CreateMilestoneDto, { achievedAt: ACHIEVED_AT })).toEqual(['title']);
  });

  it('rejects an empty title', () => {
    expect(
      failingProperties(CreateMilestoneDto, { title: '   '.trim(), achievedAt: ACHIEVED_AT }),
    ).toEqual(['title']);
  });

  it('rejects a title beyond the limit', () => {
    expect(
      failingProperties(CreateMilestoneDto, {
        title: 'x'.repeat(MAX_MILESTONE_TITLE_LENGTH + 1),
        achievedAt: ACHIEVED_AT,
      }),
    ).toEqual(['title']);
  });

  it('rejects a template key that is not in the catalog', () => {
    expect(
      failingProperties(CreateMilestoneDto, {
        templateKey: 'SLEEPS_THROUGH_THE_NIGHT',
        title: 'Schläft durch',
        achievedAt: ACHIEVED_AT,
      }),
    ).toEqual(['templateKey']);
  });

  it('rejects a category sent alongside a template key — the catalog owns it', () => {
    expect(
      failingProperties(CreateMilestoneDto, {
        templateKey: MilestoneTemplate.FIRST_STEPS,
        title: 'Erste Schritte',
        category: MilestoneCategory.LANGUAGE,
        achievedAt: ACHIEVED_AT,
      }),
    ).toEqual(['achievedAt']);
  });

  it('rejects an instant where a bare calendar day is required', () => {
    expect(
      failingProperties(CreateMilestoneDto, {
        title: 'Erste Zugfahrt',
        achievedAt: '2025-08-20T10:00:00.000Z',
      }),
    ).toEqual(['achievedAt']);
  });

  it('rejects a date in the future (M-6)', () => {
    const tomorrow = new Date(Date.now() + 2 * ONE_DAY_MS).toISOString().slice(0, 10);
    expect(
      failingProperties(CreateMilestoneDto, { title: 'Erste Zugfahrt', achievedAt: tomorrow }),
    ).toEqual(['achievedAt']);
  });

  it('rejects a note beyond the limit', () => {
    expect(
      failingProperties(CreateMilestoneDto, {
        title: 'Erste Zugfahrt',
        achievedAt: ACHIEVED_AT,
        note: 'x'.repeat(MAX_NOTE_LENGTH + 1),
      }),
    ).toEqual(['note']);
  });
});

describe('UpdateMilestoneDto', () => {
  it('accepts an empty body — every field is optional', () => {
    expect(failingProperties(UpdateMilestoneDto, {})).toEqual([]);
  });

  it('accepts clearing the note and the category with an explicit null', () => {
    expect(failingProperties(UpdateMilestoneDto, { note: null, category: null })).toEqual([]);
  });

  it('does not expose templateKey — it is not editable', () => {
    expect(
      failingProperties(UpdateMilestoneDto, { templateKey: MilestoneTemplate.FIRST_STEPS }),
    ).toEqual(['templateKey']);
  });

  it('still validates the calendar-day shape of achievedAt', () => {
    expect(failingProperties(UpdateMilestoneDto, { achievedAt: '20.08.2025' })).toEqual([
      'achievedAt',
    ]);
  });
});
