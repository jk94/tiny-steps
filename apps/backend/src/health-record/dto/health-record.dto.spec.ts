import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { HealthRecordKind } from '../health-record-kind.enum';
import {
  MAX_DOSE_UNIT_LENGTH,
  MAX_HEALTH_RECORD_NAME_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_VACCINE_BATCH_LENGTH,
} from '../health-record.constants';
import { CreateHealthRecordDto } from './create-health-record.dto';
import { HealthRecordQueryDto } from './health-record-query.dto';
import { UpdateHealthRecordDto } from './update-health-record.dto';

const ADMINISTERED_AT = '2025-08-20T14:30:00.000Z';
const DUE_AT = '2025-09-15';
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

describe('CreateHealthRecordDto', () => {
  it('accepts a fully specified medication', () => {
    expect(
      failingProperties(CreateHealthRecordDto, {
        kind: HealthRecordKind.MEDICATION,
        name: 'Paracetamol',
        administeredAt: ADMINISTERED_AT,
        doseAmount: 5,
        doseUnit: 'ml',
        note: 'Nach dem Abendessen',
      }),
    ).toEqual([]);
  });

  it('accepts a planned vaccination with a batch and a reminder', () => {
    expect(
      failingProperties(CreateHealthRecordDto, {
        kind: HealthRecordKind.VACCINATION,
        name: '6-fach-Impfung',
        dueAt: DUE_AT,
        vaccineBatch: 'AB1234',
        reminderEnabled: true,
      }),
    ).toEqual([]);
  });

  it.each([[undefined], ['MEDICINE'], ['']])('rejects the kind %p', (kind) => {
    expect(failingProperties(CreateHealthRecordDto, { kind, name: 'X', dueAt: DUE_AT })).toEqual([
      'kind',
    ]);
  });

  it('requires a name', () => {
    expect(
      failingProperties(CreateHealthRecordDto, {
        kind: HealthRecordKind.MEDICATION,
        dueAt: DUE_AT,
      }),
    ).toEqual(['name']);
  });

  it('rejects an over-long name, dose unit, batch and note', () => {
    expect(
      failingProperties(CreateHealthRecordDto, {
        kind: HealthRecordKind.VACCINATION,
        name: 'x'.repeat(MAX_HEALTH_RECORD_NAME_LENGTH + 1),
        dueAt: DUE_AT,
        vaccineBatch: 'x'.repeat(MAX_VACCINE_BATCH_LENGTH + 1),
        note: 'x'.repeat(MAX_NOTE_LENGTH + 1),
      }),
    ).toEqual(['name', 'vaccineBatch', 'note']);
    expect(
      failingProperties(CreateHealthRecordDto, {
        kind: HealthRecordKind.MEDICATION,
        name: 'Paracetamol',
        dueAt: DUE_AT,
        doseUnit: 'x'.repeat(MAX_DOSE_UNIT_LENGTH + 1),
      }),
    ).toEqual(['doseUnit']);
  });

  it('rejects a zero or negative dose — never a real administration', () => {
    for (const doseAmount of [0, -1]) {
      expect(
        failingProperties(CreateHealthRecordDto, {
          kind: HealthRecordKind.MEDICATION,
          name: 'Paracetamol',
          administeredAt: ADMINISTERED_AT,
          doseAmount,
          doseUnit: 'ml',
        }),
      ).toEqual(['doseAmount']);
    }
  });

  it('rejects an administration in the future (MED-6)', () => {
    const tomorrow = new Date(Date.now() + ONE_DAY_MS).toISOString();
    expect(
      failingProperties(CreateHealthRecordDto, {
        kind: HealthRecordKind.MEDICATION,
        name: 'Paracetamol',
        administeredAt: tomorrow,
      }),
    ).toEqual(['administeredAt']);
  });

  // The whole point of `dueAt`: an appointment that has come and gone without
  // being marked done is overdue, not invalid (MED-6/MED-12).
  it('accepts a due date far in the past', () => {
    expect(
      failingProperties(CreateHealthRecordDto, {
        kind: HealthRecordKind.VACCINATION,
        name: 'Nachholimpfung',
        dueAt: '2020-01-01',
      }),
    ).toEqual([]);
  });

  it('rejects a due date carrying a time of day — it is a calendar day', () => {
    expect(
      failingProperties(CreateHealthRecordDto, {
        kind: HealthRecordKind.VACCINATION,
        name: 'Impfung',
        dueAt: '2025-09-15T10:00:00.000Z',
      }),
    ).toEqual(['dueAt']);
  });

  // MED-2, MED-3 and the per-kind field rules are cross-column and therefore
  // NOT this DTO's job — a payload violating them has to pass validation here
  // and be caught by the service.
  it('leaves the cross-column rules to the service', () => {
    expect(
      failingProperties(CreateHealthRecordDto, {
        kind: HealthRecordKind.VACCINATION,
        name: 'Impfung',
      }),
    ).toEqual([]);
    expect(
      failingProperties(CreateHealthRecordDto, {
        kind: HealthRecordKind.VACCINATION,
        name: 'Impfung',
        dueAt: DUE_AT,
        doseAmount: 5,
        doseUnit: 'ml',
      }),
    ).toEqual([]);
  });
});

describe('UpdateHealthRecordDto', () => {
  it('accepts an empty patch', () => {
    expect(failingProperties(UpdateHealthRecordDto, {})).toEqual([]);
  });

  it('accepts a bare "mark as done" patch (MED-5)', () => {
    expect(failingProperties(UpdateHealthRecordDto, { administeredAt: ADMINISTERED_AT })).toEqual(
      [],
    );
  });

  it.each(['administeredAt', 'dueAt', 'doseAmount', 'doseUnit', 'vaccineBatch', 'note'])(
    'accepts an explicit null on %s as "clear it"',
    (field) => {
      expect(failingProperties(UpdateHealthRecordDto, { [field]: null })).toEqual([]);
    },
  );

  it('still validates a non-null value on a clearable field', () => {
    expect(failingProperties(UpdateHealthRecordDto, { doseAmount: -1 })).toEqual(['doseAmount']);
    expect(failingProperties(UpdateHealthRecordDto, { dueAt: 'not-a-date' })).toEqual(['dueAt']);
  });

  // `kind` decides which optional columns are even legal, so changing it would
  // invalidate data already stored — it is a delete plus a create, not an edit.
  it('rejects a kind change outright', () => {
    expect(
      failingProperties(UpdateHealthRecordDto, { kind: HealthRecordKind.VACCINATION }),
    ).toEqual(['kind']);
  });
});

describe('HealthRecordQueryDto', () => {
  it('accepts no filter at all — the overview fetches everything once', () => {
    expect(failingProperties(HealthRecordQueryDto, {})).toEqual([]);
  });

  it('accepts both filters together', () => {
    expect(
      failingProperties(HealthRecordQueryDto, {
        kind: HealthRecordKind.MEDICATION,
        status: 'done',
      }),
    ).toEqual([]);
  });

  it('rejects an unknown status', () => {
    expect(failingProperties(HealthRecordQueryDto, { status: 'overdue' })).toEqual(['status']);
  });
});
