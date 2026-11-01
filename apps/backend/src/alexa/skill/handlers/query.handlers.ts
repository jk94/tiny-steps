import { Injectable } from '@nestjs/common';
import { EventType } from '../../../event/event-type.enum';
import { EventService, type TimelineEventSummary } from '../../../event/event.service';
import { FeedingType } from '../../../feeding/feeding-type.enum';
import { FeedingService } from '../../../feeding/feeding.service';
import { HealthRecordService } from '../../../health-record/health-record.service';
import { SleepService } from '../../../sleep/sleep.service';
import type { AccessibleChild } from '../../alexa-child-directory.service';
import { AlexaLinkService } from '../../links/alexa-link.service';
import type { AlexaIntent, AlexaResponseEnvelope } from '../alexa-request.types';
import { respond } from '../alexa-response';
import { parseDateSlot, resolvedSlotId, SLOT, SLOT_TYPE_IDS, slotValue } from '../alexa-slots';
import {
  addDays,
  daysBetween,
  formatDayMonth,
  toZoned,
  zonedDayRange,
  type ZonedDateTime,
} from '../alexa-time';
import type { LinkedTurn } from '../skill-turn';

/** How many planned medications/vaccinations are read out at most. */
const MAX_UPCOMING_ITEMS = 3;

type CountedNoun = 'feeding' | 'diaper';

/**
 * Voice commands that only *read* (ALX-3/4/5/9): "when was the last …",
 * the daily summary, planned medications, and setting the default child. Open
 * to every household role, like reading in the app.
 */
@Injectable()
export class AlexaQueryHandlers {
  constructor(
    private readonly events: EventService,
    private readonly feeding: FeedingService,
    private readonly sleep: SleepService,
    private readonly healthRecords: HealthRecordService,
    private readonly links: AlexaLinkService,
  ) {}

  lastActivity(turn: LinkedTurn, intent: AlexaIntent): Promise<AlexaResponseEnvelope> {
    const activity = resolvedSlotId(intent, SLOT.activity, SLOT_TYPE_IDS.ACTIVITY_TYPE);

    return turn.withChild(intent, 'read', async (child) => {
      const sentences: string[] = [];
      if (!activity || activity === 'FEEDING') sentences.push(await this.lastFeeding(turn, child));
      if (!activity || activity === 'DIAPER') sentences.push(await this.lastDiaper(turn, child));
      if (!activity || activity === 'SLEEP') sentences.push(await this.lastSleep(turn, child));
      return respond().speak(sentences.join(' ')).build();
    });
  }

  private async lastFeeding(turn: LinkedTurn, child: AccessibleChild): Promise<string> {
    const running = await this.feeding.findActiveTimer(child.householdId, child.id);
    if (running) {
      const since = running.startedAt ?? running.occurredAt;
      return turn.say('breastRunning', {
        childName: child.name,
        duration: turn.duration(turn.now.getTime() - since.getTime(), 'dative'),
      });
    }

    const latest = await this.events.findLatest(child.householdId, child.id, EventType.FEEDING);
    if (!latest || latest.type !== EventType.FEEDING) {
      return turn.say('noFeeding', { childName: child.name });
    }

    let detail: string;
    switch (latest.feedingType) {
      case FeedingType.BOTTLE:
        detail =
          latest.amountMl !== null
            ? turn.say('feedingDetail.BOTTLE', { amount: latest.amountMl })
            : turn.say('feedingDetail.BOTTLE_NO_AMOUNT');
        break;
      case FeedingType.SOLID:
        detail = turn.say('feedingDetail.SOLID');
        break;
      case FeedingType.BREAST:
        detail = turn
          .say('feedingDetail.BREAST', {
            sideText: latest.side ? turn.say(`side.${latest.side}`) : '',
          })
          .trim();
        break;
    }

    // Measured from the start of the feed, like the app's "time since" tiles.
    return turn.say('lastFeeding', {
      childName: child.name,
      relative: turn.relativePast(latest.occurredAt),
      when: await turn.whenPast(latest.occurredAt),
      detail,
    });
  }

  private async lastDiaper(turn: LinkedTurn, child: AccessibleChild): Promise<string> {
    const latest = await this.events.findLatest(child.householdId, child.id, EventType.DIAPER);
    if (!latest || latest.type !== EventType.DIAPER) {
      return turn.say('noDiaper', { childName: child.name });
    }
    return turn.say('lastDiaper', {
      childName: child.name,
      relative: turn.relativePast(latest.occurredAt),
      when: await turn.whenPast(latest.occurredAt),
      diaperState: turn.say(`diaperState.${latest.diaperType}`),
    });
  }

  private async lastSleep(turn: LinkedTurn, child: AccessibleChild): Promise<string> {
    const running = await this.sleep.findActiveTimer(child.householdId, child.id);
    if (running) {
      const since = running.startedAt ?? running.occurredAt;
      return turn.say('sleepRunning', {
        childName: child.name,
        duration: turn.duration(turn.now.getTime() - since.getTime(), 'dative'),
        when: await turn.whenPast(since),
      });
    }

    const latest = await this.events.findLatest(child.householdId, child.id, EventType.SLEEP);
    if (!latest || latest.type !== EventType.SLEEP) {
      return turn.say('noSleep', { childName: child.name });
    }
    // "Woke up X ago" is about the end of the sleep; fall back to its start
    // for a (theoretically impossible) finished entry without an end.
    const wokeAt = latest.endedAt ?? latest.occurredAt;
    return turn.say('lastSleep', {
      childName: child.name,
      relative: turn.relativePast(wokeAt),
      when: await turn.whenPast(wokeAt),
      duration: turn.duration((latest.durationSeconds ?? 0) * 1000, 'dative'),
    });
  }

  /**
   * ALX-4. Counts follow the app's own daily stats rule: an event belongs to
   * the day it *started* on, and only finished sleep is summed — a running one
   * is mentioned separately instead of being guessed.
   */
  dailySummary(turn: LinkedTurn, intent: AlexaIntent): Promise<AlexaResponseEnvelope> {
    return turn.withChild(intent, 'read', async (child) => {
      const timeZone = await turn.timeZone();
      const today = toZoned(turn.now, timeZone);
      const day = resolveSummaryDay(parseDateSlot(slotValue(intent, SLOT.date)), today);
      const { from, to } = zonedDayRange(day, timeZone);
      const isToday = daysBetween(day, today) === 0;

      const events = await this.events.listDaily(child.householdId, child.id, from, to);
      const feedings = events.filter((event) => event.type === EventType.FEEDING).length;
      const diapers = events.filter((event) => event.type === EventType.DIAPER).length;
      const sleepMs = events.reduce(
        (sum, event) =>
          event.type === EventType.SLEEP && event.durationSeconds !== null
            ? sum + event.durationSeconds * 1000
            : sum,
        0,
      );

      const counts = {
        childName: child.name,
        feedings: this.count(turn, 'feeding', feedings),
        diapers: this.count(turn, 'diaper', diapers),
      };
      const sentences = [
        isToday
          ? turn.say('summaryToday', counts)
          : turn.say('summaryOtherDay', {
              ...counts,
              dayLabel:
                daysBetween(day, today) === 1
                  ? turn.say('dayYesterday')
                  : turn.say('dayOnDate', { date: formatDayMonth(day, turn.locale) }),
            }),
        sleepMs > 0
          ? turn.say('summarySleep', { childName: child.name, duration: turn.duration(sleepMs) })
          : turn.say('summaryNoSleep'),
      ];

      if (isToday) {
        const running = await this.sleep.findActiveTimer(child.householdId, child.id);
        if (running) {
          const since = running.startedAt ?? running.occurredAt;
          sentences.push(
            turn.say('summarySleepRunning', {
              childName: child.name,
              duration: turn.duration(turn.now.getTime() - since.getTime(), 'dative'),
            }),
          );
        }
        const lastFeeding = latestOfType(events, EventType.FEEDING);
        if (lastFeeding) {
          sentences.push(
            turn.say('summaryLastFeeding', { relative: turn.relativePast(lastFeeding.occurredAt) }),
          );
        }
      }

      return respond().speak(sentences.join(' ')).build();
    });
  }

  private count(turn: LinkedTurn, noun: CountedNoun, n: number): string {
    if (n === 0) return turn.say(`count.${noun}.zero`);
    if (n === 1) return turn.say(`count.${noun}.one`);
    return turn.say(`count.${noun}.other`, { count: n });
  }

  /** ALX-5: what is planned next, read out from the existing health records. */
  upcomingHealthRecords(turn: LinkedTurn, intent: AlexaIntent): Promise<AlexaResponseEnvelope> {
    return turn.withChild(intent, 'read', async (child) => {
      const planned = (
        await this.healthRecords.list(child.householdId, child.id, { status: 'planned' })
      ).filter((record) => record.dueAt !== null);

      if (planned.length === 0) {
        return respond()
          .speak(turn.say('upcomingNone', { childName: child.name }))
          .build();
      }

      const today = toZoned(turn.now, await turn.timeZone());
      const items = planned.slice(0, MAX_UPCOMING_ITEMS).map((record) => {
        // `dueAt` is a calendar day stored as UTC midnight — compare as a date.
        const due = toZoned(new Date(record.dueAt!), 'UTC');
        const inDays = daysBetween(today, due);
        const date = formatDayMonth(due, turn.locale);
        const dueText =
          inDays < 0
            ? turn.say('overdueSince', { date })
            : inDays === 0
              ? turn.say('dueToday')
              : inDays === 1
                ? turn.say('dueTomorrow')
                : turn.say('dueOn', { date });
        return turn.say('upcomingItem', {
          kindLabel: turn.say(`healthKind.${record.kind}`),
          name: record.name,
          due: dueText,
        });
      });

      return respond()
        .speak(turn.say('upcomingIntro', { childName: child.name, items: turn.listAnd(items) }))
        .build();
    });
  }

  /** ALX-9: "Setze Emma als Standardkind". A name is required — the default must not pick itself. */
  setDefaultChild(turn: LinkedTurn, intent: AlexaIntent): Promise<AlexaResponseEnvelope> {
    if (slotValue(intent, SLOT.child) === undefined) {
      return Promise.resolve(turn.ask(intent, SLOT.child, turn.say('defaultChildQuestion')));
    }
    return turn.withChild(
      intent,
      'read',
      async (child) => {
        await this.links.setDefaultChildForLink(turn.principal.linkId, child.id);
        return respond()
          .speak(turn.say('defaultChildSet', { childName: child.name }))
          .build();
      },
      { ignoreDefault: true },
    );
  }
}

/**
 * The day a summary is about. "Montag" resolves to the *coming* Monday in
 * Alexa's date slot, but nobody asks how a day went before it happened — a
 * future date within a week is read as the past one.
 */
export function resolveSummaryDay(
  spoken: Pick<ZonedDateTime, 'year' | 'month' | 'day'> | null,
  today: Pick<ZonedDateTime, 'year' | 'month' | 'day'>,
): Pick<ZonedDateTime, 'year' | 'month' | 'day'> {
  if (!spoken) return today;
  const inDays = daysBetween(today, spoken);
  if (inDays <= 0) return spoken;
  if (inDays <= 7) return addDays(spoken, -7);
  return today;
}

function latestOfType(
  events: readonly TimelineEventSummary[],
  type: EventType,
): TimelineEventSummary | undefined {
  // `listDaily` returns ascending `occurredAt`.
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].type === type) return events[i];
  }
  return undefined;
}
