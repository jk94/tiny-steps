import { Injectable } from '@nestjs/common';
import { HealthRecordKind } from '../../../health-record/health-record-kind.enum';
import { HealthRecordService } from '../../../health-record/health-record.service';
import type { AccessibleChild } from '../../alexa-child-directory.service';
import { AlexaApiClient, type AlexaReminderRequest } from '../alexa-api.client';
import type {
  AlexaConnectionsResponse,
  AlexaIntent,
  AlexaResponseEnvelope,
} from '../alexa-request.types';
import { REMINDERS_PERMISSION, respond } from '../alexa-response';
import {
  parseDurationSlot,
  parseTimeSlot,
  resolvedSlotId,
  SLOT,
  SLOT_TYPE_IDS,
  slotValue,
} from '../alexa-slots';
import { addDays, formatLocalClock, toZoned, type ZonedDateTime } from '../alexa-time';
import type { LinkedTurn } from '../skill-turn';

const MIN_REMINDER_OFFSET_SECONDS = 60;
const MAX_REMINDER_OFFSET_SECONDS = 24 * 60 * 60;
const MAX_MEDICATION_NAME_LENGTH = 100;

/**
 * A reminder the user asked for but that still waits on the voice permission
 * prompt (ALX-6). Serialized into the `Connections.SendRequest` token and read
 * back from the `Connections.Response`, so the user does not have to repeat it.
 */
export type PendingReminder =
  | { v: 1; kind: 'feeding'; childId: string; offsetSeconds: number }
  | {
      v: 1;
      kind: 'medication';
      childId: string;
      hour: number;
      minute: number;
      daily: boolean;
      medication: string | null;
    };

export function encodePendingReminder(pending: PendingReminder): string {
  return JSON.stringify(pending);
}

/** Defensive parse — the token round-trips through Amazon, so it is re-validated. */
export function decodePendingReminder(token: string | undefined): PendingReminder | null {
  if (!token) return null;
  let value: unknown;
  try {
    value = JSON.parse(token);
  } catch {
    return null;
  }
  if (value === null || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  if (data.v !== 1 || typeof data.childId !== 'string') return null;

  if (
    data.kind === 'feeding' &&
    Number.isInteger(data.offsetSeconds) &&
    (data.offsetSeconds as number) >= MIN_REMINDER_OFFSET_SECONDS &&
    (data.offsetSeconds as number) <= MAX_REMINDER_OFFSET_SECONDS
  ) {
    return {
      v: 1,
      kind: 'feeding',
      childId: data.childId,
      offsetSeconds: data.offsetSeconds as number,
    };
  }
  if (
    data.kind === 'medication' &&
    Number.isInteger(data.hour) &&
    (data.hour as number) >= 0 &&
    (data.hour as number) < 24 &&
    Number.isInteger(data.minute) &&
    (data.minute as number) >= 0 &&
    (data.minute as number) < 60 &&
    typeof data.daily === 'boolean' &&
    (data.medication === null ||
      (typeof data.medication === 'string' && data.medication.length <= MAX_MEDICATION_NAME_LENGTH))
  ) {
    return {
      v: 1,
      kind: 'medication',
      childId: data.childId,
      hour: data.hour as number,
      minute: data.minute as number,
      daily: data.daily,
      medication: data.medication as string | null,
    };
  }
  return null;
}

/**
 * Reminders through the Alexa Reminders API (ALX-5/ALX-6): the reminder lives
 * on the user's Alexa account and rings on their devices; nothing about it is
 * stored in the app. Reading the child's name or planned medication is a read,
 * so every household role may set one.
 */
@Injectable()
export class AlexaReminderHandlers {
  constructor(
    private readonly api: AlexaApiClient,
    private readonly healthRecords: HealthRecordService,
  ) {}

  /** "Erinnere mich in drei Stunden ans Füttern." */
  feedingReminder(turn: LinkedTurn, intent: AlexaIntent): Promise<AlexaResponseEnvelope> {
    return turn.withChild(intent, 'read', async (child) => {
      const question = turn.say('reminderDurationQuestion');
      const raw = slotValue(intent, SLOT.duration);
      if (raw === undefined) {
        return turn.ask(intent, SLOT.duration, question);
      }
      const ms = parseDurationSlot(raw);
      const offsetSeconds = ms === null ? null : Math.round(ms / 1000);
      if (
        offsetSeconds === null ||
        offsetSeconds < MIN_REMINDER_OFFSET_SECONDS ||
        offsetSeconds > MAX_REMINDER_OFFSET_SECONDS
      ) {
        return turn.ask(
          intent,
          SLOT.duration,
          `${turn.say('reminderOutOfRange')} ${question}`,
          question,
        );
      }

      return this.createOrAskPermission(turn, child, {
        v: 1,
        kind: 'feeding',
        childId: child.id,
        offsetSeconds,
      });
    });
  }

  /**
   * "Erinnere mich um 20 Uhr an das Vitamin D" — optionally "jeden Tag". With
   * no medication named, a single planned medication of the child is used.
   */
  medicationReminder(turn: LinkedTurn, intent: AlexaIntent): Promise<AlexaResponseEnvelope> {
    return turn.withChild(intent, 'read', async (child) => {
      const time = parseTimeSlot(slotValue(intent, SLOT.time));
      if (!time) {
        return turn.ask(intent, SLOT.time, turn.say('reminderTimeQuestion'));
      }

      // The spoken words, not the slot's canonical value: "Paracetamol" must
      // not turn into the catalog entry "Fiebersaft" it is a synonym of.
      const spoken = slotValue(intent, SLOT.medication)?.slice(0, MAX_MEDICATION_NAME_LENGTH);
      const medication = spoken ?? (await this.singlePlannedMedication(child));
      const daily =
        resolvedSlotId(intent, SLOT.recurrence, SLOT_TYPE_IDS.REMINDER_RECURRENCE) === 'DAILY';

      return this.createOrAskPermission(turn, child, {
        v: 1,
        kind: 'medication',
        childId: child.id,
        hour: time.hour,
        minute: time.minute,
        daily,
        medication,
      });
    });
  }

  /**
   * The answer to the voice permission prompt. On consent the pending reminder
   * is created right away; otherwise the user gets an explanation and a
   * permission card (ALX-6).
   */
  async onPermissionResponse(
    turn: LinkedTurn,
    request: AlexaConnectionsResponse,
  ): Promise<AlexaResponseEnvelope> {
    if (request.payload?.status !== 'ACCEPTED') {
      return this.permissionDenied(turn);
    }
    const pending = decodePendingReminder(request.token);
    const child = pending && turn.children.find((candidate) => candidate.id === pending.childId);
    if (!pending || !child) {
      return respond().speak(turn.say('reminderFailed')).build();
    }
    return this.createReminder(turn, child, pending);
  }

  private createOrAskPermission(
    turn: LinkedTurn,
    child: AccessibleChild,
    pending: PendingReminder,
  ): Promise<AlexaResponseEnvelope> {
    // No consent token = the user never granted any skill permission yet.
    if (!turn.system.user.permissions?.consentToken) {
      return Promise.resolve(
        respond().askForPermission(REMINDERS_PERMISSION, encodePendingReminder(pending)).build(),
      );
    }
    return this.createReminder(turn, child, pending);
  }

  private async createReminder(
    turn: LinkedTurn,
    child: AccessibleChild,
    pending: PendingReminder,
  ): Promise<AlexaResponseEnvelope> {
    const timeZone = await turn.timeZone();
    const nowLocal = toZoned(turn.now, timeZone);
    let reminder: AlexaReminderRequest;
    let confirmation: string;

    if (pending.kind === 'feeding') {
      reminder = this.reminderBase(
        turn,
        nowLocal,
        turn.say('reminderFeedingText', { childName: child.name }),
        {
          type: 'SCHEDULED_RELATIVE',
          offsetInSeconds: pending.offsetSeconds,
        },
      );
      confirmation = turn.say('reminderFeedingCreated', {
        childName: child.name,
        duration: turn.duration(pending.offsetSeconds * 1000, 'dative'),
      });
    } else {
      const medication = pending.medication ?? turn.say('medicationGeneric');
      const time = formatLocalClock(pending.hour, pending.minute, turn.locale);
      const isLaterToday =
        pending.hour * 60 + pending.minute > nowLocal.hour * 60 + nowLocal.minute;
      const day = isLaterToday ? nowLocal : addDays(nowLocal, 1);
      const scheduled = localDateTime({ ...day, hour: pending.hour, minute: pending.minute });
      const text = turn.say('reminderMedicationText', { medication, childName: child.name });

      reminder = this.reminderBase(
        turn,
        nowLocal,
        text,
        pending.daily
          ? {
              type: 'SCHEDULED_ABSOLUTE',
              timeZoneId: timeZone,
              recurrence: {
                startDateTime: scheduled,
                recurrenceRules: [
                  `FREQ=DAILY;BYHOUR=${pending.hour};BYMINUTE=${pending.minute};BYSECOND=0;INTERVAL=1;`,
                ],
              },
            }
          : { type: 'SCHEDULED_ABSOLUTE', scheduledTime: scheduled, timeZoneId: timeZone },
      );
      const when = pending.daily
        ? turn.say('whenDaily', { time })
        : turn.say(isLaterToday ? 'whenFutureToday' : 'whenFutureTomorrow', { time });
      confirmation = turn.say('reminderMedicationCreated', {
        when,
        medication,
        childName: child.name,
      });
    }

    switch (await this.api.createReminder(turn.system, reminder)) {
      case 'created':
        return respond().speak(confirmation).build();
      case 'permissionMissing':
        return this.permissionDenied(turn);
      case 'failed':
        return respond().speak(turn.say('reminderFailed')).build();
    }
  }

  private reminderBase(
    turn: LinkedTurn,
    nowLocal: ZonedDateTime & { second: number },
    text: string,
    trigger: AlexaReminderRequest['trigger'],
  ): AlexaReminderRequest {
    return {
      requestTime: localDateTime(nowLocal, nowLocal.second),
      trigger,
      alertInfo: { spokenInfo: { content: [{ locale: turn.requestLocale, text }] } },
      pushNotification: { status: 'ENABLED' },
    };
  }

  private permissionDenied(turn: LinkedTurn): AlexaResponseEnvelope {
    return respond()
      .speak(turn.say('reminderPermissionDenied'))
      .withCard({ type: 'AskForPermissionsConsent', permissions: [REMINDERS_PERMISSION] })
      .build();
  }

  private async singlePlannedMedication(child: AccessibleChild): Promise<string | null> {
    const planned = await this.healthRecords.list(child.householdId, child.id, {
      kind: HealthRecordKind.MEDICATION,
      status: 'planned',
    });
    return planned.length === 1 ? planned[0].name.slice(0, MAX_MEDICATION_NAME_LENGTH) : null;
  }
}

/** The Reminders API's local timestamp format: `2026-11-01T20:00:00.000`, no offset. */
function localDateTime(value: ZonedDateTime, second = 0): string {
  const pad = (n: number, width = 2) => String(n).padStart(width, '0');
  return (
    `${pad(value.year, 4)}-${pad(value.month)}-${pad(value.day)}` +
    `T${pad(value.hour)}:${pad(value.minute)}:${pad(second)}.000`
  );
}
