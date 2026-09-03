import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HealthRecordKind } from './health-record-kind.enum';
import { HealthRecordService } from './health-record.service';

const HOUSEHOLD_ID = 'household-1';
const CHILD_ID = 'child-1';
const USER_ID = 'user-1';
const RECORD_ID = 'health-record-1';

const BIRTH_DATE = new Date('2025-01-20T00:00:00.000Z');
const ADMINISTERED_AT = '2025-08-20T14:30:00.000Z';
const DUE_AT_DAY = '2025-09-15';

function makeChild(overrides: Record<string, unknown> = {}) {
  return {
    id: CHILD_ID,
    householdId: HOUSEHOLD_ID,
    name: 'Alex',
    birthDate: BIRTH_DATE,
    photoPath: null,
    photoMimeType: null,
    sex: null as string | null,
    createdAt: new Date('2025-01-21T00:00:00.000Z'),
    ...overrides,
  };
}

function makeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: RECORD_ID,
    childId: CHILD_ID,
    userId: USER_ID,
    kind: HealthRecordKind.MEDICATION as string,
    name: 'Paracetamol',
    administeredAt: null as Date | null,
    dueAt: new Date(DUE_AT_DAY) as Date | null,
    doseAmount: null as number | null,
    doseUnit: null as string | null,
    vaccineBatch: null as string | null,
    note: null as string | null,
    reminderEnabled: true,
    reminderLastSentAt: null as Date | null,
    createdAt: new Date('2025-08-21T09:00:00.000Z'),
    updatedAt: new Date('2025-08-21T09:00:00.000Z'),
    ...overrides,
  };
}

/** The machine-readable `code` a structured 400 carries. */
function codeOf(error: unknown): string | undefined {
  const body = (error as BadRequestException).getResponse();
  return typeof body === 'object' && body !== null ? (body as { code?: string }).code : undefined;
}

describe('HealthRecordService', () => {
  let prisma: {
    child: { findUnique: jest.Mock };
    healthRecord: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let service: HealthRecordService;

  beforeEach(() => {
    prisma = {
      child: { findUnique: jest.fn().mockResolvedValue(makeChild()) },
      healthRecord: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn().mockResolvedValue(undefined),
      },
    };
    service = new HealthRecordService(prisma as unknown as PrismaService);
  });

  describe('child scoping', () => {
    it('404s when the child does not belong to the household', async () => {
      prisma.child.findUnique.mockResolvedValue(null);

      await expect(service.list(HOUSEHOLD_ID, CHILD_ID)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.child.findUnique).toHaveBeenCalledWith({
        where: { id: CHILD_ID, householdId: HOUSEHOLD_ID },
      });
    });

    it('404s for a record id belonging to another child', async () => {
      prisma.healthRecord.findUnique.mockResolvedValue(null);

      await expect(service.findOne(HOUSEHOLD_ID, CHILD_ID, RECORD_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      // The `childId` in the where clause is what makes a foreign record a 404
      // rather than a leak.
      expect(prisma.healthRecord.findUnique).toHaveBeenCalledWith({
        where: { id: RECORD_ID, childId: CHILD_ID },
      });
    });
  });

  describe('create', () => {
    it('stores a medication with its dose and the recording user', async () => {
      prisma.healthRecord.create.mockResolvedValue(
        makeRecord({ administeredAt: new Date(ADMINISTERED_AT), doseAmount: 5, doseUnit: 'ml' }),
      );

      const result = await service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, {
        kind: HealthRecordKind.MEDICATION,
        name: 'Paracetamol',
        administeredAt: ADMINISTERED_AT,
        doseAmount: 5,
        doseUnit: 'ml',
      });

      expect(prisma.healthRecord.create).toHaveBeenCalledWith({
        data: {
          childId: CHILD_ID,
          userId: USER_ID,
          kind: HealthRecordKind.MEDICATION,
          name: 'Paracetamol',
          administeredAt: new Date(ADMINISTERED_AT),
          dueAt: null,
          doseAmount: 5,
          doseUnit: 'ml',
          vaccineBatch: null,
          note: null,
          reminderEnabled: false,
        },
      });
      expect(result.doseAmount).toBe(5);
      // Internal scheduler bookkeeping never reaches a client (MED-9).
      expect(result).not.toHaveProperty('reminderLastSentAt');
    });

    it('rejects an entry with neither a due nor an administration date (MED-2)', async () => {
      const failure = service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, {
        kind: HealthRecordKind.VACCINATION,
        name: '6-fach-Impfung',
      });

      await expect(failure).rejects.toBeInstanceOf(BadRequestException);
      await expect(failure.catch(codeOf)).resolves.toBe('HEALTH_RECORD_MISSING_DATE');
      expect(prisma.healthRecord.create).not.toHaveBeenCalled();
    });

    it('rejects a dose amount without a unit (MED-3)', async () => {
      const failure = service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, {
        kind: HealthRecordKind.MEDICATION,
        name: 'Vitamin D',
        administeredAt: ADMINISTERED_AT,
        doseAmount: 1,
      });

      await expect(failure.catch(codeOf)).resolves.toBe('HEALTH_RECORD_DOSE_UNIT_REQUIRED');
    });

    it('accepts a unit without an amount — incomplete, but not ambiguous', async () => {
      prisma.healthRecord.create.mockResolvedValue(
        makeRecord({ administeredAt: new Date(ADMINISTERED_AT), doseUnit: 'Tropfen' }),
      );

      await expect(
        service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, {
          kind: HealthRecordKind.MEDICATION,
          name: 'Vitamin D',
          administeredAt: ADMINISTERED_AT,
          doseUnit: 'Tropfen',
        }),
      ).resolves.toBeDefined();
    });

    it('rejects dose fields on a vaccination', async () => {
      const failure = service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, {
        kind: HealthRecordKind.VACCINATION,
        name: 'Rotavirus',
        administeredAt: ADMINISTERED_AT,
        doseAmount: 2,
        doseUnit: 'ml',
      });

      await expect(failure.catch(codeOf)).resolves.toBe('HEALTH_RECORD_FIELD_NOT_ALLOWED_FOR_KIND');
    });

    it('rejects a vaccine batch on a medication', async () => {
      const failure = service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, {
        kind: HealthRecordKind.MEDICATION,
        name: 'Ibuprofen',
        administeredAt: ADMINISTERED_AT,
        vaccineBatch: 'AB1234',
      });

      await expect(failure.catch(codeOf)).resolves.toBe('HEALTH_RECORD_FIELD_NOT_ALLOWED_FOR_KIND');
    });

    it('rejects an administration on the day before the birth date (MED-6)', async () => {
      const failure = service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, {
        kind: HealthRecordKind.MEDICATION,
        name: 'Paracetamol',
        administeredAt: '2025-01-19T00:00:00.000Z',
      });

      await expect(failure.catch(codeOf)).resolves.toBe(
        'HEALTH_RECORD_ADMINISTERED_AT_BEFORE_BIRTH',
      );
    });

    it('accepts an administration on the birth day itself', async () => {
      prisma.healthRecord.create.mockResolvedValue(makeRecord());

      await expect(
        service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, {
          kind: HealthRecordKind.VACCINATION,
          name: 'Vitamin-K-Prophylaxe',
          administeredAt: BIRTH_DATE.toISOString(),
        }),
      ).resolves.toBeDefined();
    });

    // `birthDate` is a calendar day stored as UTC midnight while
    // `administeredAt` is a real instant, so anything logged early on the birth
    // day east of UTC lands on an *earlier* UTC instant than that midnight.
    // Vitamin-K prophylaxis is given within an hour of birth, so this is the
    // normal case, not an edge case — and the client only ever pre-checks the
    // local calendar day, so a rejection here would be unexplainable to a user.
    it.each([
      ['Berlin, UTC+1, 00:30 on the birth day', '2025-01-19T23:30:00.000Z'],
      ['Auckland, UTC+13, 08:00 on the birth day', '2025-01-19T19:00:00.000Z'],
      ['Honolulu, UTC-10, 23:00 on the birth day', '2025-01-21T09:00:00.000Z'],
    ])('accepts an administration on the birth day in %s', async (_label, administeredAt) => {
      prisma.healthRecord.create.mockResolvedValue(makeRecord());

      await expect(
        service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, {
          kind: HealthRecordKind.VACCINATION,
          name: 'Vitamin-K-Prophylaxe',
          administeredAt,
        }),
      ).resolves.toBeDefined();
    });

    it('allows a due date in the past — that is an overdue entry, not an error (MED-6)', async () => {
      prisma.healthRecord.create.mockResolvedValue(makeRecord({ dueAt: new Date('2020-01-01') }));

      await expect(
        service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, {
          kind: HealthRecordKind.VACCINATION,
          name: 'Nachholimpfung',
          dueAt: '2020-01-01',
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('list', () => {
    it('orders planned entries by ascending due date and history descending (MED-12)', async () => {
      await service.list(HOUSEHOLD_ID, CHILD_ID);

      expect(prisma.healthRecord.findMany).toHaveBeenCalledWith({
        where: { childId: CHILD_ID },
        // `nulls: 'last'` is not cosmetic: without it the pure history entries
        // sort first on SQLite and last on PostgreSQL.
        orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { administeredAt: 'desc' }],
      });
    });

    it('narrows by kind', async () => {
      await service.list(HOUSEHOLD_ID, CHILD_ID, { kind: HealthRecordKind.VACCINATION });

      expect(prisma.healthRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { childId: CHILD_ID, kind: HealthRecordKind.VACCINATION },
        }),
      );
    });

    it('derives the planned filter from a missing administration date', async () => {
      await service.list(HOUSEHOLD_ID, CHILD_ID, { status: 'planned' });

      expect(prisma.healthRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { childId: CHILD_ID, administeredAt: null } }),
      );
    });

    it('derives the done filter from a present administration date', async () => {
      await service.list(HOUSEHOLD_ID, CHILD_ID, { status: 'done' });

      expect(prisma.healthRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { childId: CHILD_ID, administeredAt: { not: null } } }),
      );
    });
  });

  describe('update', () => {
    beforeEach(() => {
      prisma.healthRecord.findUnique.mockResolvedValue(makeRecord());
      prisma.healthRecord.update.mockImplementation(({ data }: { data: object }) =>
        Promise.resolve(makeRecord(data as Record<string, unknown>)),
      );
    });

    it('marks a planned entry as done by patching only administeredAt (MED-5)', async () => {
      const result = await service.update(HOUSEHOLD_ID, CHILD_ID, RECORD_ID, {
        administeredAt: ADMINISTERED_AT,
      });

      expect(prisma.healthRecord.update).toHaveBeenCalledWith({
        where: { id: RECORD_ID },
        data: { administeredAt: new Date(ADMINISTERED_AT) },
      });
      expect(result.administeredAt).toBe(ADMINISTERED_AT);
      // The due date survives, so the entry stays a completed appointment
      // rather than losing the plan it fulfilled.
      expect(result.dueAt).toBe(new Date(DUE_AT_DAY).toISOString());
    });

    it('rejects a patch that clears the only remaining date (MED-2)', async () => {
      prisma.healthRecord.findUnique.mockResolvedValue(
        makeRecord({ administeredAt: null, dueAt: new Date(DUE_AT_DAY) }),
      );

      const failure = service.update(HOUSEHOLD_ID, CHILD_ID, RECORD_ID, { dueAt: null });

      await expect(failure.catch(codeOf)).resolves.toBe('HEALTH_RECORD_MISSING_DATE');
      expect(prisma.healthRecord.update).not.toHaveBeenCalled();
    });

    it('judges MED-3 on the merged state, not on the patch alone', async () => {
      // The stored record has neither amount nor unit; adding just an amount
      // must fail even though the request itself mentions no unit at all.
      const failure = service.update(HOUSEHOLD_ID, CHILD_ID, RECORD_ID, { doseAmount: 5 });

      await expect(failure.catch(codeOf)).resolves.toBe('HEALTH_RECORD_DOSE_UNIT_REQUIRED');
    });

    it('accepts a dose amount when the unit is already stored', async () => {
      prisma.healthRecord.findUnique.mockResolvedValue(makeRecord({ doseUnit: 'ml' }));

      await expect(
        service.update(HOUSEHOLD_ID, CHILD_ID, RECORD_ID, { doseAmount: 5 }),
      ).resolves.toBeDefined();
    });

    it('uses the immutable stored kind for the per-kind field rules', async () => {
      prisma.healthRecord.findUnique.mockResolvedValue(
        makeRecord({ kind: HealthRecordKind.VACCINATION }),
      );

      const failure = service.update(HOUSEHOLD_ID, CHILD_ID, RECORD_ID, {
        doseAmount: 2,
        doseUnit: 'ml',
      });

      await expect(failure.catch(codeOf)).resolves.toBe('HEALTH_RECORD_FIELD_NOT_ALLOWED_FOR_KIND');
    });

    it('rejects moving an administration before the birth date (MED-6)', async () => {
      const failure = service.update(HOUSEHOLD_ID, CHILD_ID, RECORD_ID, {
        administeredAt: '2024-12-31T00:00:00.000Z',
      });

      await expect(failure.catch(codeOf)).resolves.toBe(
        'HEALTH_RECORD_ADMINISTERED_AT_BEFORE_BIRTH',
      );
    });

    it('re-arms the reminder by clearing reminderLastSentAt when the due date moves', async () => {
      prisma.healthRecord.findUnique.mockResolvedValue(
        makeRecord({ reminderLastSentAt: new Date('2025-09-12T08:00:00.000Z') }),
      );

      await service.update(HOUSEHOLD_ID, CHILD_ID, RECORD_ID, { dueAt: '2025-10-01' });

      expect(prisma.healthRecord.update).toHaveBeenCalledWith({
        where: { id: RECORD_ID },
        data: { dueAt: new Date('2025-10-01'), reminderLastSentAt: null },
      });
    });

    it('leaves reminderLastSentAt alone when the patch repeats the same due date', async () => {
      prisma.healthRecord.findUnique.mockResolvedValue(
        makeRecord({ reminderLastSentAt: new Date('2025-09-12T08:00:00.000Z') }),
      );

      await service.update(HOUSEHOLD_ID, CHILD_ID, RECORD_ID, { dueAt: DUE_AT_DAY, note: 'x' });

      expect(prisma.healthRecord.update).toHaveBeenCalledWith({
        where: { id: RECORD_ID },
        data: { dueAt: new Date(DUE_AT_DAY), note: 'x' },
      });
    });

    it('leaves untouched fields out of the update data entirely', async () => {
      await service.update(HOUSEHOLD_ID, CHILD_ID, RECORD_ID, { name: 'Ibuprofen' });

      expect(prisma.healthRecord.update).toHaveBeenCalledWith({
        where: { id: RECORD_ID },
        data: { name: 'Ibuprofen' },
      });
    });
  });

  describe('remove', () => {
    it('deletes a record that resolves through the child scope', async () => {
      prisma.healthRecord.findUnique.mockResolvedValue(makeRecord());

      await service.remove(HOUSEHOLD_ID, CHILD_ID, RECORD_ID);

      expect(prisma.healthRecord.delete).toHaveBeenCalledWith({ where: { id: RECORD_ID } });
    });

    it('does not delete anything for a foreign record id', async () => {
      prisma.healthRecord.findUnique.mockResolvedValue(null);

      await expect(service.remove(HOUSEHOLD_ID, CHILD_ID, RECORD_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.healthRecord.delete).not.toHaveBeenCalled();
    });
  });
});
