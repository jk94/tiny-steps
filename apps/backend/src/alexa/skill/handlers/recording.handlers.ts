import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateDiaperEventDto } from '../../../diaper/dto/create-diaper-event.dto';
import { DiaperType } from '../../../diaper/diaper-type.enum';
import { DiaperService } from '../../../diaper/diaper.service';
import { EventAlreadyStoppedException } from '../../../event/event-conflict.exception';
import { CreateFeedingEventDto } from '../../../feeding/dto/create-feeding-event.dto';
import { FeedingSide } from '../../../feeding/feeding-side.enum';
import { FeedingType } from '../../../feeding/feeding-type.enum';
import { FeedingService } from '../../../feeding/feeding.service';
import { CreateSleepEventDto } from '../../../sleep/dto/create-sleep-event.dto';
import { SleepService } from '../../../sleep/sleep.service';
import type { AccessibleChild } from '../../alexa-child-directory.service';
import type { AlexaIntent, AlexaResponseEnvelope } from '../alexa-request.types';
import { respond } from '../alexa-response';
import {
  parseDurationSlot,
  parseNumberSlot,
  resolvedSlotId,
  SLOT,
  SLOT_TYPE_IDS,
  slotValue,
} from '../alexa-slots';
import type { LinkedTurn } from '../skill-turn';
import { toValidatedDto } from '../validate-dto';

/** Same bounds as `CreateFeedingEventDto.amountMl`. */
export const BOTTLE_MIN_ML = 1;
export const BOTTLE_MAX_ML = 2000;
/** A spoken "for how long" (feed, nap) has to make sense for a single entry. */
export const MIN_SPOKEN_DURATION_MS = 60 * 1000;
export const MAX_SPOKEN_DURATION_HOURS = 24;
const MAX_SPOKEN_DURATION_MS = MAX_SPOKEN_DURATION_HOURS * 60 * 60 * 1000;

/**
 * Voice commands that *write* (ALX-1/ALX-2): feeding, diaper, sleep.
 *
 * Everything goes through the very same domain services as the REST routes,
 * with payloads built as the routes' own DTO classes and validated by their
 * rules, so a voice entry is indistinguishable from one made in the app —
 * including the realtime broadcast to every other household member (ALX-8).
 * The role check happened in `LinkedTurn.withChild(…, 'record', …)`.
 */
@Injectable()
export class AlexaRecordingHandlers {
  constructor(
    private readonly feeding: FeedingService,
    private readonly sleep: SleepService,
    private readonly diaper: DiaperService,
  ) {}

  logFeeding(turn: LinkedTurn, intent: AlexaIntent): Promise<AlexaResponseEnvelope> {
    let type = resolvedSlotId(intent, SLOT.feedingType, SLOT_TYPE_IDS.FEEDING_TYPE) as
      FeedingType | undefined;
    // "120 Milliliter" can only be a bottle, "links" only the breast.
    if (!type && slotValue(intent, SLOT.amount) !== undefined) type = FeedingType.BOTTLE;
    if (!type && resolvedSlotId(intent, SLOT.side, SLOT_TYPE_IDS.BREAST_SIDE)) {
      type = FeedingType.BREAST;
    }

    return turn.withChild(intent, 'record', async (child) => {
      switch (type) {
        case FeedingType.BOTTLE:
          return this.logBottle(turn, intent, child);
        case FeedingType.BREAST:
          return this.logBreast(turn, intent, child);
        case FeedingType.SOLID: {
          await this.createFeeding(turn, child, { feedingType: FeedingType.SOLID });
          return respond()
            .speak(turn.say('solidLogged', { childName: child.name }))
            .build();
        }
        default:
          return turn.ask(
            intent,
            SLOT.feedingType,
            turn.say('feedingTypeQuestion', { childName: child.name }),
          );
      }
    });
  }

  private async logBottle(
    turn: LinkedTurn,
    intent: AlexaIntent,
    child: AccessibleChild,
  ): Promise<AlexaResponseEnvelope> {
    const raw = slotValue(intent, SLOT.amount);
    if (raw === undefined) {
      return turn.ask(intent, SLOT.amount, turn.say('bottleAmountQuestion'));
    }
    const amount = parseNumberSlot(raw);
    if (amount === null || amount < BOTTLE_MIN_ML || amount > BOTTLE_MAX_ML) {
      return turn.ask(
        intent,
        SLOT.amount,
        turn.say('amountOutOfRange', { min: BOTTLE_MIN_ML, max: BOTTLE_MAX_ML }),
        turn.say('bottleAmountQuestion'),
      );
    }

    await this.createFeeding(turn, child, { feedingType: FeedingType.BOTTLE, amountMl: amount });
    return respond()
      .speak(turn.say('bottleLogged', { amount, childName: child.name }))
      .build();
  }

  /**
   * Breastfeeding with a spoken duration becomes a finished entry ending now;
   * without one it starts the timer, exactly like the app's quick entry.
   */
  private async logBreast(
    turn: LinkedTurn,
    intent: AlexaIntent,
    child: AccessibleChild,
  ): Promise<AlexaResponseEnvelope> {
    const side = resolvedSlotId(intent, SLOT.side, SLOT_TYPE_IDS.BREAST_SIDE) as
      FeedingSide | undefined;
    if (!side) {
      return turn.ask(intent, SLOT.side, turn.say('breastSideQuestion'));
    }
    const sideText = turn.say(`side.${side}`);

    const rawDuration = slotValue(intent, SLOT.duration);
    if (rawDuration !== undefined) {
      const durationMs = parseDurationSlot(rawDuration);
      if (!isSpokenDurationInRange(durationMs)) {
        return respond()
          .speak(turn.say('durationOutOfRange', { maxHours: MAX_SPOKEN_DURATION_HOURS }))
          .build();
      }
      const endedAt = turn.now;
      const startedAt = new Date(endedAt.getTime() - durationMs);
      await this.createFeeding(turn, child, {
        feedingType: FeedingType.BREAST,
        side,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
      });
      return respond()
        .speak(
          turn.say('breastLogged', {
            duration: turn.duration(durationMs),
            sideText,
            childName: child.name,
          }),
        )
        .build();
    }

    const running = await this.feeding.findActiveTimer(child.householdId, child.id);
    if (running) {
      return this.breastAlreadyRunning(turn, child, running.startedAt ?? running.occurredAt);
    }
    try {
      await this.createFeeding(turn, child, { feedingType: FeedingType.BREAST, side });
    } catch (error) {
      // Someone else started one in the meantime (FeedingService's own check).
      if (error instanceof ConflictException) {
        const now = await this.feeding.findActiveTimer(child.householdId, child.id);
        if (now) return this.breastAlreadyRunning(turn, child, now.startedAt ?? now.occurredAt);
      }
      throw error;
    }
    return respond()
      .speak(turn.say('breastTimerStarted', { sideText, childName: child.name }))
      .build();
  }

  private breastAlreadyRunning(
    turn: LinkedTurn,
    child: AccessibleChild,
    since: Date,
  ): AlexaResponseEnvelope {
    return respond()
      .speak(
        turn.say('breastTimerAlreadyRunning', {
          childName: child.name,
          duration: turn.duration(turn.now.getTime() - since.getTime(), 'dative'),
        }),
      )
      .build();
  }

  /**
   * Stopping someone else's timer is allowed for every recording role — the
   * deliberate shift-handover exception the app makes too (Phase 7.5).
   */
  stopFeeding(turn: LinkedTurn, intent: AlexaIntent): Promise<AlexaResponseEnvelope> {
    return turn.withChild(intent, 'record', async (child) => {
      const running = await this.feeding.findActiveTimer(child.householdId, child.id);
      const noTimer = () =>
        respond()
          .speak(turn.say('noBreastTimer', { childName: child.name }))
          .build();
      if (!running) return noTimer();

      try {
        const stopped = await this.feeding.stop(child.householdId, child.id, running.id);
        return respond()
          .speak(
            turn.say('breastTimerStopped', {
              childName: child.name,
              duration: turn.duration((stopped.durationSeconds ?? 0) * 1000, 'dative'),
            }),
          )
          .build();
      } catch (error) {
        if (error instanceof EventAlreadyStoppedException || error instanceof NotFoundException) {
          return noTimer();
        }
        throw error;
      }
    });
  }

  logDiaper(turn: LinkedTurn, intent: AlexaIntent): Promise<AlexaResponseEnvelope> {
    return turn.withChild(intent, 'record', async (child) => {
      const diaperType = resolvedSlotId(intent, SLOT.diaperType, SLOT_TYPE_IDS.DIAPER_TYPE) as
        DiaperType | undefined;
      if (!diaperType) {
        return turn.ask(intent, SLOT.diaperType, turn.say('diaperTypeQuestion'));
      }

      const dto = toValidatedDto(CreateDiaperEventDto, { diaperType });
      await this.diaper.create(child.householdId, child.id, turn.principal.userId, dto);
      return respond()
        .speak(
          turn.say('diaperLogged', {
            diaperAdjective: turn.say(`diaperAdjective.${diaperType}`),
            childName: child.name,
          }),
        )
        .build();
    });
  }

  startSleep(turn: LinkedTurn, intent: AlexaIntent): Promise<AlexaResponseEnvelope> {
    return turn.withChild(intent, 'record', async (child) => {
      const running = await this.sleep.findActiveTimer(child.householdId, child.id);
      if (running) return this.sleepAlreadyRunning(turn, child, running.startedAt);

      try {
        const dto = toValidatedDto(CreateSleepEventDto, {});
        await this.sleep.create(child.householdId, child.id, turn.principal.userId, dto);
      } catch (error) {
        if (error instanceof ConflictException) {
          const now = await this.sleep.findActiveTimer(child.householdId, child.id);
          if (now) return this.sleepAlreadyRunning(turn, child, now.startedAt);
        }
        throw error;
      }
      return respond()
        .speak(turn.say('sleepStarted', { childName: child.name }))
        .build();
    });
  }

  private sleepAlreadyRunning(
    turn: LinkedTurn,
    child: AccessibleChild,
    since: Date | null,
  ): AlexaResponseEnvelope {
    const startedAt = since ?? turn.now;
    return respond()
      .speak(
        turn.say('sleepAlreadyRunning', {
          childName: child.name,
          duration: turn.duration(turn.now.getTime() - startedAt.getTime(), 'dative'),
        }),
      )
      .build();
  }

  stopSleep(turn: LinkedTurn, intent: AlexaIntent): Promise<AlexaResponseEnvelope> {
    return turn.withChild(intent, 'record', async (child) => {
      const running = await this.sleep.findActiveTimer(child.householdId, child.id);
      const noTimer = () =>
        respond()
          .speak(turn.say('noSleepTimer', { childName: child.name }))
          .build();
      if (!running) return noTimer();

      try {
        const stopped = await this.sleep.stop(child.householdId, child.id, running.id);
        return respond()
          .speak(
            turn.say('sleepStopped', {
              childName: child.name,
              duration: turn.duration((stopped.durationSeconds ?? 0) * 1000),
            }),
          )
          .build();
      } catch (error) {
        if (error instanceof EventAlreadyStoppedException || error instanceof NotFoundException) {
          return noTimer();
        }
        throw error;
      }
    });
  }

  /** "Emma hat zwei Stunden geschlafen": a finished sleep ending now. */
  logSleep(turn: LinkedTurn, intent: AlexaIntent): Promise<AlexaResponseEnvelope> {
    return turn.withChild(intent, 'record', async (child) => {
      const question = turn.say('sleepDurationQuestion', { childName: child.name });
      const raw = slotValue(intent, SLOT.duration);
      if (raw === undefined) {
        return turn.ask(intent, SLOT.duration, question);
      }
      const durationMs = parseDurationSlot(raw);
      if (!isSpokenDurationInRange(durationMs)) {
        return turn.ask(
          intent,
          SLOT.duration,
          `${turn.say('durationOutOfRange', { maxHours: MAX_SPOKEN_DURATION_HOURS })} ${question}`,
          question,
        );
      }

      const endedAt = turn.now;
      const startedAt = new Date(endedAt.getTime() - durationMs);
      const dto = toValidatedDto(CreateSleepEventDto, {
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
      });
      await this.sleep.create(child.householdId, child.id, turn.principal.userId, dto);
      return respond()
        .speak(
          turn.say('sleepLogged', {
            duration: turn.duration(durationMs),
            childName: child.name,
          }),
        )
        .build();
    });
  }

  private async createFeeding(
    turn: LinkedTurn,
    child: AccessibleChild,
    payload: object,
  ): Promise<void> {
    const dto = toValidatedDto(CreateFeedingEventDto, payload);
    await this.feeding.create(child.householdId, child.id, turn.principal.userId, dto);
  }
}

function isSpokenDurationInRange(ms: number | null): ms is number {
  return ms !== null && ms >= MIN_SPOKEN_DURATION_MS && ms <= MAX_SPOKEN_DURATION_MS;
}
