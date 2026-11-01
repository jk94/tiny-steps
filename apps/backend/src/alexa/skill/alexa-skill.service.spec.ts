import { NotFoundException } from '@nestjs/common';
import { DiaperType } from '../../diaper/diaper-type.enum';
import { EventType } from '../../event/event-type.enum';
import { FeedingSide } from '../../feeding/feeding-side.enum';
import { FeedingType } from '../../feeding/feeding-type.enum';
import { HealthRecordKind } from '../../health-record/health-record-kind.enum';
import { HouseholdRole } from '../../household/household-role.enum';
import type { AccessibleChild } from '../alexa-child-directory.service';
import type { AlexaPrincipal } from '../oauth/alexa-oauth.service';
import { AlexaMessages } from './alexa-messages';
import type { AlexaRequestEnvelope, AlexaResponseEnvelope, AlexaSlot } from './alexa-request.types';
import { REMINDERS_PERMISSION } from './alexa-response';
import { AlexaSkillService } from './alexa-skill.service';
import { AlexaQueryHandlers } from './handlers/query.handlers';
import { AlexaRecordingHandlers } from './handlers/recording.handlers';
import { AlexaReminderHandlers, decodePendingReminder } from './handlers/reminder.handlers';

// 13:00 in Berlin (CET, after the October DST change).
const NOW = new Date('2026-11-01T12:00:00.000Z');
const MINUTE = 60 * 1000;

const EMMA: AccessibleChild = {
  id: 'c-emma',
  name: 'Emma',
  householdId: 'h1',
  householdName: 'Familie',
  role: HouseholdRole.OWNER,
};
const PAUL: AccessibleChild = { ...EMMA, id: 'c-paul', name: 'Paul' };

const PRINCIPAL: AlexaPrincipal = { linkId: 'link-1', userId: 'user-1', defaultChildId: null };

type SlotInput = string | { value?: string; id?: string };

function setup(options: { children?: AccessibleChild[]; principal?: AlexaPrincipal | null } = {}) {
  const children = options.children ?? [EMMA];
  const principal = options.principal === undefined ? PRINCIPAL : options.principal;

  const oauth = {
    resolveAccessToken: jest.fn(async (token?: string) =>
      token === 'good-token' ? principal : null,
    ),
  };
  const childDirectory = { listAccessibleChildren: jest.fn().mockResolvedValue(children) };
  const api = {
    getDeviceTimeZone: jest.fn().mockResolvedValue('Europe/Berlin'),
    createReminder: jest.fn().mockResolvedValue('created'),
  };
  const clock = { now: () => NOW };
  const feeding = {
    create: jest.fn().mockResolvedValue({}),
    findActiveTimer: jest.fn().mockResolvedValue(null),
    stop: jest.fn(),
  };
  const sleep = {
    create: jest.fn().mockResolvedValue({}),
    findActiveTimer: jest.fn().mockResolvedValue(null),
    stop: jest.fn(),
  };
  const diaper = { create: jest.fn().mockResolvedValue({}) };
  const events = {
    findLatest: jest.fn().mockResolvedValue(null),
    listDaily: jest.fn().mockResolvedValue([]),
  };
  const healthRecords = { list: jest.fn().mockResolvedValue([]) };
  const links = { setDefaultChildForLink: jest.fn().mockResolvedValue(undefined) };

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const recording = new AlexaRecordingHandlers(feeding as any, sleep as any, diaper as any);
  const queries = new AlexaQueryHandlers(
    events as any,
    feeding as any,
    sleep as any,
    healthRecords as any,
    links as any,
  );
  const reminders = new AlexaReminderHandlers(api as any, healthRecords as any);
  const service = new AlexaSkillService(
    oauth as any,
    childDirectory as any,
    new AlexaMessages(),
    api as any,
    clock as any,
    recording,
    queries,
    reminders,
  );
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return { service, oauth, api, feeding, sleep, diaper, events, healthRecords, links };
}

function system(options: { token?: string; personToken?: string; consent?: boolean } = {}) {
  return {
    application: { applicationId: 'amzn1.ask.skill.test' },
    user: {
      userId: 'amzn1.ask.account.test',
      accessToken: options.token === undefined ? 'good-token' : options.token,
      ...(options.consent ? { permissions: { consentToken: 'consent' } } : {}),
    },
    ...(options.personToken
      ? { person: { personId: 'amzn1.ask.person.test', accessToken: options.personToken } }
      : {}),
    device: { deviceId: 'device-1' },
    apiEndpoint: 'https://api.eu.amazonalexa.com',
    apiAccessToken: 'api-token',
  };
}

function intent(
  name: string,
  slots: Record<string, SlotInput> = {},
  options: { token?: string; personToken?: string; consent?: boolean; locale?: string } = {},
): AlexaRequestEnvelope {
  const slotEntries: Record<string, AlexaSlot> = {};
  for (const [slotName, input] of Object.entries(slots)) {
    const { value, id } = typeof input === 'string' ? { value: input, id: undefined } : input;
    slotEntries[slotName] = {
      name: slotName,
      value,
      ...(id
        ? {
            resolutions: {
              resolutionsPerAuthority: [
                {
                  authority: 'amzn1.er-authority.test',
                  status: { code: 'ER_SUCCESS_MATCH' },
                  values: [{ value: { name: value ?? id, id } }],
                },
              ],
            },
          }
        : {}),
    };
  }
  return {
    version: '1.0',
    context: { System: system(options) },
    request: {
      type: 'IntentRequest',
      requestId: 'req',
      timestamp: NOW.toISOString(),
      locale: options.locale ?? 'de-DE',
      intent: { name, confirmationStatus: 'NONE', slots: slotEntries },
    },
  };
}

function speech(response: AlexaResponseEnvelope): string | undefined {
  return response.response.outputSpeech?.text;
}

describe('AlexaSkillService', () => {
  describe('session & account linking', () => {
    it('asks to link the account when no token is present', async () => {
      const { service } = setup();
      const envelope = intent('LogDiaperIntent', {}, { token: '' });

      const response = await service.handle(envelope);

      expect(speech(response)).toContain('TinySteps-Konto verknüpfen');
      expect(response.response.card).toEqual({ type: 'LinkAccount' });
      expect(response.response.shouldEndSession).toBe(true);
    });

    it('treats an unknown or revoked token like a missing one', async () => {
      const { service } = setup();
      const response = await service.handle(intent('LogDiaperIntent', {}, { token: 'revoked' }));
      expect(response.response.card).toEqual({ type: 'LinkAccount' });
    });

    it("prefers the recognized speaker's own link", async () => {
      const { service, oauth, diaper } = setup();
      await service.handle(
        intent(
          'LogDiaperIntent',
          { diaperType: { value: 'nass', id: 'PEE' } },
          { token: 'other', personToken: 'good-token' },
        ),
      );
      expect(oauth.resolveAccessToken).toHaveBeenNthCalledWith(1, 'good-token');
      expect(diaper.create).toHaveBeenCalled();
    });

    it('welcomes a linked user and keeps the session open', async () => {
      const { service } = setup();
      const envelope: AlexaRequestEnvelope = {
        ...intent('x'),
        request: {
          type: 'LaunchRequest',
          requestId: 'r',
          timestamp: NOW.toISOString(),
          locale: 'de-DE',
        },
      };

      const response = await service.handle(envelope);

      expect(speech(response)).toMatch(/^Hallo!/);
      expect(response.response.reprompt).toBeDefined();
      expect(response.response.shouldEndSession).toBe(false);
    });

    it('answers help without requiring a link', async () => {
      const { service, oauth } = setup();
      const response = await service.handle(intent('AMAZON.HelpIntent', {}, { token: '' }));
      expect(speech(response)).toContain('Ich kann Fütterungen');
      expect(oauth.resolveAccessToken).not.toHaveBeenCalled();
    });

    it('says goodbye on stop', async () => {
      const { service } = setup();
      const response = await service.handle(intent('AMAZON.StopIntent'));
      expect(speech(response)).toBe('Bis bald!');
      expect(response.response.shouldEndSession).toBe(true);
    });

    it('falls back for an unknown intent', async () => {
      const { service } = setup();
      const response = await service.handle(intent('SomethingElseIntent'));
      expect(speech(response)).toContain('nicht verstanden');
      expect(response.response.shouldEndSession).toBe(false);
    });

    it('answers in English for an English request', async () => {
      const { service } = setup();
      const response = await service.handle(
        intent('LogDiaperIntent', { diaperType: { value: 'wet', id: 'PEE' } }, { locale: 'en-US' }),
      );
      expect(speech(response)).toBe('Okay, logged a wet diaper for Emma.');
    });

    it('never claims success when the domain service fails', async () => {
      const { service, diaper } = setup();
      diaper.create.mockRejectedValue(new Error('database is locked'));

      const response = await service.handle(
        intent('LogDiaperIntent', { diaperType: { value: 'nass', id: 'PEE' } }),
      );

      expect(speech(response)).toContain('etwas schiefgelaufen');
    });

    it('returns an empty response to SessionEndedRequest', async () => {
      const { service } = setup();
      const response = await service.handle({
        ...intent('x'),
        request: { type: 'SessionEndedRequest', requestId: 'r', timestamp: NOW.toISOString() },
      });
      expect(response).toEqual({ version: '1.0', response: {} });
    });
  });

  describe('child resolution and roles', () => {
    it('says so when the account has no child yet', async () => {
      const { service } = setup({ children: [] });
      const response = await service.handle(intent('StartSleepIntent'));
      expect(speech(response)).toContain('noch kein Kind angelegt');
    });

    it('asks which child when several exist and none is named', async () => {
      const { service, sleep } = setup({ children: [EMMA, PAUL] });

      const response = await service.handle(intent('StartSleepIntent'));

      expect(speech(response)).toBe('Für welches Kind: Emma oder Paul?');
      expect(response.response.directives?.[0]).toMatchObject({
        type: 'Dialog.ElicitSlot',
        slotToElicit: 'child',
        updatedIntent: { name: 'StartSleepIntent' },
      });
      expect(response.response.shouldEndSession).toBe(false);
      expect(sleep.create).not.toHaveBeenCalled();
    });

    it('uses the default child of the link', async () => {
      const { service, sleep } = setup({
        children: [EMMA, PAUL],
        principal: { ...PRINCIPAL, defaultChildId: PAUL.id },
      });

      await service.handle(intent('StartSleepIntent'));

      expect(sleep.create).toHaveBeenCalledWith('h1', PAUL.id, 'user-1', expect.anything());
    });

    it('names the known children for an unknown name and clears the slot', async () => {
      const { service } = setup({ children: [EMMA, PAUL] });

      const response = await service.handle(intent('StartSleepIntent', { child: 'Lotta' }));

      expect(speech(response)).toBe(
        'Ich habe kein Kind namens Lotta gefunden. Ich kenne Emma und Paul. Für welches Kind?',
      );
      const directive = response.response.directives?.[0];
      expect(
        directive?.type === 'Dialog.ElicitSlot' && directive.updatedIntent.slots?.child?.value,
      ).toBeFalsy();
    });

    it('lets an observer read but not record', async () => {
      const observerEmma = { ...EMMA, role: HouseholdRole.OBSERVER };
      const { service, diaper, events } = setup({ children: [observerEmma] });

      const write = await service.handle(
        intent('LogDiaperIntent', { diaperType: { value: 'nass', id: 'PEE' } }),
      );
      const read = await service.handle(
        intent('LastActivityIntent', { activity: { value: 'gewickelt', id: 'DIAPER' } }),
      );

      expect(speech(write)).toBe(
        'Als Beobachter kannst du für Emma nichts eintragen. Du kannst aber fragen, wann Emma zuletzt gefüttert, gewickelt oder schlafen gelegt wurde.',
      );
      expect(diaper.create).not.toHaveBeenCalled();
      expect(events.findLatest).toHaveBeenCalled();
      expect(speech(read)).toBe('Für Emma ist noch keine Windel eingetragen.');
    });

    it('lets a caregiver record', async () => {
      const { service, diaper } = setup({ children: [{ ...EMMA, role: HouseholdRole.CAREGIVER }] });
      await service.handle(
        intent('LogDiaperIntent', { diaperType: { value: 'voll', id: 'STOOL' } }),
      );
      expect(diaper.create).toHaveBeenCalled();
    });
  });

  describe('recording', () => {
    it('logs a diaper through DiaperService', async () => {
      const { service, diaper } = setup();

      const response = await service.handle(
        intent('LogDiaperIntent', { diaperType: { value: 'Kacka', id: 'STOOL' }, child: 'Emma' }),
      );

      expect(diaper.create).toHaveBeenCalledWith('h1', 'c-emma', 'user-1', {
        diaperType: DiaperType.STOOL,
      });
      expect(speech(response)).toBe('Okay, volle Windel für Emma eingetragen.');
    });

    it('asks for the diaper type when it is missing', async () => {
      const { service, diaper } = setup();
      const response = await service.handle(intent('LogDiaperIntent'));
      expect(speech(response)).toBe('War die Windel nass, voll oder beides?');
      expect(response.response.directives?.[0]).toMatchObject({ slotToElicit: 'diaperType' });
      expect(diaper.create).not.toHaveBeenCalled();
    });

    it('logs a bottle with its amount', async () => {
      const { service, feeding } = setup();

      const response = await service.handle(
        intent('LogFeedingIntent', {
          feedingType: { value: 'Flasche', id: 'BOTTLE' },
          amount: '120',
        }),
      );

      expect(feeding.create).toHaveBeenCalledWith(
        'h1',
        'c-emma',
        'user-1',
        expect.objectContaining({ feedingType: FeedingType.BOTTLE, amountMl: 120 }),
      );
      expect(speech(response)).toBe('Okay, Flasche mit 120 Millilitern für Emma eingetragen.');
    });

    it('treats a bare amount as a bottle', async () => {
      const { service, feeding } = setup();
      await service.handle(intent('LogFeedingIntent', { amount: '90' }));
      expect(feeding.create).toHaveBeenCalledWith(
        'h1',
        'c-emma',
        'user-1',
        expect.objectContaining({ feedingType: FeedingType.BOTTLE, amountMl: 90 }),
      );
    });

    it('asks again for an amount outside the app limits', async () => {
      const { service, feeding } = setup();
      const response = await service.handle(
        intent('LogFeedingIntent', {
          feedingType: { value: 'Flasche', id: 'BOTTLE' },
          amount: '5000',
        }),
      );
      expect(speech(response)).toContain('zwischen 1 und 2000 Millilitern');
      expect(response.response.directives?.[0]).toMatchObject({ slotToElicit: 'amount' });
      expect(feeding.create).not.toHaveBeenCalled();
    });

    it('asks for the feeding type when it cannot be inferred', async () => {
      const { service } = setup();
      const response = await service.handle(intent('LogFeedingIntent'));
      expect(speech(response)).toBe('Was hat Emma bekommen: Flasche, Stillen oder Beikost?');
    });

    it('starts a breastfeeding timer without a duration', async () => {
      const { service, feeding } = setup();

      const response = await service.handle(
        intent('LogFeedingIntent', {
          feedingType: { value: 'Stillen', id: 'BREAST' },
          side: { value: 'links', id: 'LEFT' },
        }),
      );

      expect(feeding.create).toHaveBeenCalledWith(
        'h1',
        'c-emma',
        'user-1',
        expect.objectContaining({ feedingType: FeedingType.BREAST, side: FeedingSide.LEFT }),
      );
      expect(feeding.create.mock.calls[0][3].endedAt).toBeUndefined();
      expect(speech(response)).toContain('Stillen links für Emma läuft');
    });

    it('does not start a second breastfeeding timer', async () => {
      const { service, feeding } = setup();
      feeding.findActiveTimer.mockResolvedValue({
        id: 'e1',
        startedAt: new Date(NOW.getTime() - 12 * MINUTE),
        occurredAt: new Date(NOW.getTime() - 12 * MINUTE),
      });

      const response = await service.handle(
        intent('LogFeedingIntent', { side: { value: 'rechts', id: 'RIGHT' } }),
      );

      expect(feeding.create).not.toHaveBeenCalled();
      expect(speech(response)).toBe('Für Emma läuft schon ein Stilltimer, seit 12 Minuten.');
    });

    it('logs a finished breastfeeding with a spoken duration', async () => {
      const { service, feeding } = setup();

      const response = await service.handle(
        intent('LogFeedingIntent', {
          feedingType: { value: 'gestillt', id: 'BREAST' },
          side: { value: 'rechts', id: 'RIGHT' },
          duration: 'PT15M',
        }),
      );

      const dto = feeding.create.mock.calls[0][3];
      expect(new Date(dto.endedAt).getTime() - new Date(dto.startedAt).getTime()).toBe(15 * MINUTE);
      expect(speech(response)).toBe('Okay, 15 Minuten Stillen rechts für Emma eingetragen.');
    });

    it('asks for the side of a breastfeeding', async () => {
      const { service } = setup();
      const response = await service.handle(
        intent('LogFeedingIntent', { feedingType: { value: 'Stillen', id: 'BREAST' } }),
      );
      expect(speech(response)).toBe('Links oder rechts?');
    });

    it('stops a running breastfeeding timer, even one started by someone else', async () => {
      const { service, feeding } = setup({
        children: [{ ...EMMA, role: HouseholdRole.CAREGIVER }],
      });
      feeding.findActiveTimer.mockResolvedValue({ id: 'e1', userId: 'someone-else' });
      feeding.stop.mockResolvedValue({ durationSeconds: 20 * 60 });

      const response = await service.handle(intent('StopFeedingIntent'));

      expect(feeding.stop).toHaveBeenCalledWith('h1', 'c-emma', 'e1');
      expect(speech(response)).toBe('Okay, Stillen für Emma nach 20 Minuten beendet.');
    });

    it('says when there is no timer to stop', async () => {
      const { service, feeding } = setup();
      feeding.findActiveTimer.mockResolvedValue({ id: 'e1' });
      feeding.stop.mockRejectedValue(new NotFoundException());

      const response = await service.handle(intent('StopFeedingIntent'));

      expect(speech(response)).toBe('Für Emma läuft gerade kein Stilltimer.');
    });

    it('starts and stops sleep', async () => {
      const { service, sleep } = setup();
      const started = await service.handle(intent('StartSleepIntent'));
      expect(speech(started)).toContain('Schlaf für Emma gestartet');

      sleep.findActiveTimer.mockResolvedValue({
        id: 's1',
        startedAt: new Date(NOW.getTime() - 120 * MINUTE),
      });
      sleep.stop.mockResolvedValue({ durationSeconds: 2 * 60 * 60 });
      const stopped = await service.handle(intent('StopSleepIntent'));
      expect(speech(stopped)).toBe('Okay, Emma hat 2 Stunden geschlafen.');
    });

    it('reports a running sleep instead of starting another', async () => {
      const { service, sleep } = setup();
      sleep.findActiveTimer.mockResolvedValue({
        id: 's1',
        startedAt: new Date(NOW.getTime() - 40 * MINUTE),
      });
      const response = await service.handle(intent('StartSleepIntent'));
      expect(speech(response)).toBe('Emma schläft laut TinySteps schon seit 40 Minuten.');
      expect(sleep.create).not.toHaveBeenCalled();
    });

    it('logs a finished sleep with a duration', async () => {
      const { service, sleep } = setup();
      const response = await service.handle(intent('LogSleepIntent', { duration: 'PT1H30M' }));
      const dto = sleep.create.mock.calls[0][3];
      expect(new Date(dto.endedAt).getTime() - new Date(dto.startedAt).getTime()).toBe(90 * MINUTE);
      expect(speech(response)).toBe(
        'Okay, eine Stunde und 30 Minuten Schlaf für Emma eingetragen.',
      );
    });

    it('rejects an implausible sleep duration', async () => {
      const { service, sleep } = setup();
      const response = await service.handle(intent('LogSleepIntent', { duration: 'P2D' }));
      expect(speech(response)).toContain('zwischen einer Minute und 24 Stunden');
      expect(sleep.create).not.toHaveBeenCalled();
    });
  });

  describe('queries', () => {
    it('tells when the last feeding was, in the device time zone', async () => {
      const { service, events } = setup();
      events.findLatest.mockResolvedValue({
        type: EventType.FEEDING,
        feedingType: FeedingType.BOTTLE,
        amountMl: 120,
        occurredAt: new Date(NOW.getTime() - 130 * MINUTE),
      });

      const response = await service.handle(
        intent('LastActivityIntent', { activity: { value: 'gefüttert', id: 'FEEDING' } }),
      );

      expect(speech(response)).toBe(
        'Die letzte Fütterung von Emma war vor 2 Stunden und 10 Minuten, um 10:50 Uhr: Flasche mit 120 Millilitern.',
      );
    });

    it('reports a running sleep with when it began', async () => {
      const { service, sleep } = setup();
      sleep.findActiveTimer.mockResolvedValue({
        startedAt: new Date('2026-10-31T22:30:00.000Z'),
        occurredAt: new Date('2026-10-31T22:30:00.000Z'),
      });

      const response = await service.handle(
        intent('LastActivityIntent', { activity: { value: 'geschlafen', id: 'SLEEP' } }),
      );

      expect(speech(response)).toBe(
        'Emma schläft seit 13 Stunden und 30 Minuten, eingeschlafen gestern um 23:30 Uhr.',
      );
    });

    it('covers all three activities when none is named', async () => {
      const { service } = setup();
      const response = await service.handle(intent('LastActivityIntent'));
      expect(speech(response)).toBe(
        'Für Emma ist noch keine Fütterung eingetragen. Für Emma ist noch keine Windel eingetragen. Für Emma ist noch kein Schlaf eingetragen.',
      );
    });

    it('summarizes today with the day boundary of the device time zone', async () => {
      const { service, events } = setup();
      events.listDaily.mockResolvedValue([
        { type: EventType.FEEDING, occurredAt: new Date('2026-11-01T06:00:00Z') },
        { type: EventType.DIAPER, occurredAt: new Date('2026-11-01T07:00:00Z') },
        {
          type: EventType.SLEEP,
          durationSeconds: 90 * 60,
          occurredAt: new Date('2026-11-01T08:00:00Z'),
        },
        { type: EventType.FEEDING, occurredAt: new Date('2026-11-01T11:00:00Z') },
      ]);

      const response = await service.handle(intent('DailySummaryIntent'));

      // Midnight in Berlin is 23:00 UTC the day before.
      expect(events.listDaily).toHaveBeenCalledWith(
        'h1',
        'c-emma',
        new Date('2026-10-31T23:00:00.000Z'),
        new Date('2026-11-01T23:00:00.000Z'),
      );
      expect(speech(response)).toBe(
        'Heute hatte Emma bisher 2 Fütterungen und eine Windel. Geschlafen hat Emma insgesamt eine Stunde und 30 Minuten. Die letzte Fütterung war vor einer Stunde.',
      );
    });

    it('summarizes yesterday', async () => {
      const { service } = setup();
      const response = await service.handle(intent('DailySummaryIntent', { date: '2026-10-31' }));
      expect(speech(response)).toBe(
        'Gestern hatte Emma keine Fütterung und keine Windel. Ein abgeschlossener Schlaf ist nicht eingetragen.',
      );
    });

    it('reads out planned medications and vaccinations', async () => {
      const { service, healthRecords } = setup();
      healthRecords.list.mockResolvedValue([
        {
          kind: HealthRecordKind.VACCINATION,
          name: 'Sechsfach',
          dueAt: '2026-10-30T00:00:00.000Z',
        },
        { kind: HealthRecordKind.MEDICATION, name: 'Vitamin D', dueAt: '2026-11-01T00:00:00.000Z' },
        { kind: HealthRecordKind.VACCINATION, name: 'MMR', dueAt: '2026-11-20T00:00:00.000Z' },
      ]);

      const response = await service.handle(intent('UpcomingHealthRecordsIntent'));

      expect(healthRecords.list).toHaveBeenCalledWith('h1', 'c-emma', { status: 'planned' });
      expect(speech(response)).toBe(
        'Für Emma geplant: Impfung Sechsfach überfällig seit dem 30. Oktober, Medikament Vitamin D heute und Impfung MMR am 20. November.',
      );
    });

    it('sets the default child by voice', async () => {
      const { service, links } = setup({
        children: [EMMA, PAUL],
        principal: { ...PRINCIPAL, defaultChildId: EMMA.id },
      });

      const response = await service.handle(intent('SetDefaultChildIntent', { child: 'Paul' }));

      expect(links.setDefaultChildForLink).toHaveBeenCalledWith('link-1', PAUL.id);
      expect(speech(response)).toBe('Okay, Paul ist jetzt dein Standardkind für Alexa.');
    });

    it('asks which child should become the default', async () => {
      const { service, links } = setup({ principal: { ...PRINCIPAL, defaultChildId: EMMA.id } });
      const response = await service.handle(intent('SetDefaultChildIntent'));
      expect(speech(response)).toBe('Welches Kind soll dein Standardkind werden?');
      expect(links.setDefaultChildForLink).not.toHaveBeenCalled();
    });
  });

  describe('reminders', () => {
    it('asks for the reminders permission and carries the reminder in the token', async () => {
      const { service, api } = setup();

      const response = await service.handle(
        intent('SetFeedingReminderIntent', { duration: 'PT3H' }, { consent: false }),
      );

      const directive = response.response.directives?.[0];
      expect(directive).toMatchObject({
        type: 'Connections.SendRequest',
        name: 'AskFor',
        payload: { permissionScopes: [{ permissionScope: REMINDERS_PERMISSION }] },
      });
      expect(response.response.shouldEndSession).toBe(true);
      expect(
        decodePendingReminder(directive?.type === 'Connections.SendRequest' ? directive.token : ''),
      ).toEqual({ v: 1, kind: 'feeding', childId: 'c-emma', offsetSeconds: 3 * 60 * 60 });
      expect(api.createReminder).not.toHaveBeenCalled();
    });

    it('creates a relative feeding reminder when permitted', async () => {
      const { service, api } = setup();

      const response = await service.handle(
        intent('SetFeedingReminderIntent', { duration: 'PT3H' }, { consent: true }),
      );

      expect(api.createReminder).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          trigger: { type: 'SCHEDULED_RELATIVE', offsetInSeconds: 10800 },
          alertInfo: {
            spokenInfo: { content: [{ locale: 'de-DE', text: 'Zeit, Emma zu füttern.' }] },
          },
        }),
      );
      expect(speech(response)).toBe('Okay, ich erinnere dich in 3 Stunden daran, Emma zu füttern.');
    });

    it('creates the pending reminder once the permission was granted', async () => {
      const { service, api } = setup();
      const envelope: AlexaRequestEnvelope = {
        ...intent('x', {}, { consent: true }),
        request: {
          type: 'Connections.Response',
          requestId: 'r',
          timestamp: NOW.toISOString(),
          locale: 'de-DE',
          name: 'AskFor',
          status: { code: '200' },
          payload: { status: 'ACCEPTED', permissionScope: REMINDERS_PERMISSION },
          token: JSON.stringify({ v: 1, kind: 'feeding', childId: 'c-emma', offsetSeconds: 600 }),
        },
      };

      const response = await service.handle(envelope);

      expect(api.createReminder).toHaveBeenCalled();
      expect(speech(response)).toBe(
        'Okay, ich erinnere dich in 10 Minuten daran, Emma zu füttern.',
      );
    });

    it('explains and sends a permission card when the user declines', async () => {
      const { service, api } = setup();
      const envelope: AlexaRequestEnvelope = {
        ...intent('x'),
        request: {
          type: 'Connections.Response',
          requestId: 'r',
          timestamp: NOW.toISOString(),
          locale: 'de-DE',
          name: 'AskFor',
          payload: { status: 'DENIED' },
          token: '{}',
        },
      };

      const response = await service.handle(envelope);

      expect(api.createReminder).not.toHaveBeenCalled();
      expect(speech(response)).toContain('Ohne deine Erlaubnis');
      expect(response.response.card).toEqual({
        type: 'AskForPermissionsConsent',
        permissions: [REMINDERS_PERMISSION],
      });
    });

    it('creates a daily medication reminder', async () => {
      const { service, api } = setup();

      const response = await service.handle(
        intent(
          'SetMedicationReminderIntent',
          {
            time: '20:00',
            medication: { value: 'Vigantoletten', id: 'VITAMIN_D' },
            recurrence: { value: 'jeden Abend', id: 'DAILY' },
          },
          { consent: true },
        ),
      );

      expect(api.createReminder.mock.calls[0][1]).toMatchObject({
        trigger: {
          type: 'SCHEDULED_ABSOLUTE',
          timeZoneId: 'Europe/Berlin',
          recurrence: {
            startDateTime: '2026-11-01T20:00:00.000',
            recurrenceRules: ['FREQ=DAILY;BYHOUR=20;BYMINUTE=0;BYSECOND=0;INTERVAL=1;'],
          },
        },
        alertInfo: { spokenInfo: { content: [{ text: 'Zeit für Vigantoletten für Emma.' }] } },
      });
      expect(speech(response)).toBe(
        'Okay, ich erinnere dich jeden Tag um 20:00 Uhr an Vigantoletten für Emma.',
      );
    });

    it('schedules a one-off medication reminder for tomorrow once today has passed', async () => {
      const { service, api, healthRecords } = setup();
      healthRecords.list.mockResolvedValue([{ name: 'Fiebersaft' }]);

      const response = await service.handle(
        intent('SetMedicationReminderIntent', { time: '08:00' }, { consent: true }),
      );

      expect(healthRecords.list).toHaveBeenCalledWith('h1', 'c-emma', {
        kind: HealthRecordKind.MEDICATION,
        status: 'planned',
      });
      expect(api.createReminder.mock.calls[0][1].trigger).toEqual({
        type: 'SCHEDULED_ABSOLUTE',
        scheduledTime: '2026-11-02T08:00:00.000',
        timeZoneId: 'Europe/Berlin',
      });
      expect(speech(response)).toBe(
        'Okay, ich erinnere dich morgen um 8:00 Uhr an Fiebersaft für Emma.',
      );
    });

    it('asks for a time when none was understood', async () => {
      const { service } = setup();
      const response = await service.handle(
        intent('SetMedicationReminderIntent', { time: 'EV' }, { consent: true }),
      );
      expect(speech(response)).toBe('Um wie viel Uhr soll ich dich erinnern?');
    });

    it('falls back to the permission card when the Reminders API refuses', async () => {
      const { service, api } = setup();
      api.createReminder.mockResolvedValue('permissionMissing');
      const response = await service.handle(
        intent('SetFeedingReminderIntent', { duration: 'PT2H' }, { consent: true }),
      );
      expect(response.response.card).toMatchObject({ type: 'AskForPermissionsConsent' });
    });

    it('admits a failed reminder', async () => {
      const { service, api } = setup();
      api.createReminder.mockResolvedValue('failed');
      const response = await service.handle(
        intent('SetFeedingReminderIntent', { duration: 'PT2H' }, { consent: true }),
      );
      expect(speech(response)).toContain('nicht anlegen');
    });
  });
});

describe('decodePendingReminder', () => {
  it.each([
    [undefined],
    ['not json'],
    ['null'],
    [JSON.stringify({ v: 2, kind: 'feeding', childId: 'c', offsetSeconds: 600 })],
    [JSON.stringify({ v: 1, kind: 'feeding', childId: 'c', offsetSeconds: 10 })],
    [
      JSON.stringify({
        v: 1,
        kind: 'medication',
        childId: 'c',
        hour: 25,
        minute: 0,
        daily: false,
        medication: null,
      }),
    ],
    [JSON.stringify({ v: 1, kind: 'other', childId: 'c' })],
  ])('rejects %s', (token) => {
    expect(decodePendingReminder(token)).toBeNull();
  });
});
