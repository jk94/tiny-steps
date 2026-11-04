import { mayRecordEntries } from '../../common/authorization/assert-entry-owner';
import type { AccessibleChild } from '../alexa-child-directory.service';
import type { AlexaPrincipal } from '../oauth/alexa-oauth.service';
import type { AlexaApiClient } from './alexa-api.client';
import type {
  AlexaLocale,
  AlexaMessageKey,
  AlexaMessageParams,
  AlexaMessages,
} from './alexa-messages';
import type {
  AlexaIntent,
  AlexaRequestEnvelope,
  AlexaResponseEnvelope,
  AlexaSystem,
} from './alexa-request.types';
import { respond } from './alexa-response';
import {
  daysBetween,
  type DurationCase,
  formatClock,
  formatDayMonth,
  formatDuration,
  serverTimeZone,
  toZoned,
} from './alexa-time';
import { SLOT, slotValue } from './alexa-slots';
import { resolveChild } from './child-resolver';

/**
 * Everything one skill request needs while it is being answered: the locale,
 * "now", the device time zone (fetched lazily, once), and the message catalog.
 * Created per request by `AlexaSkillService`; handlers never touch the raw
 * envelope for these.
 */
export class SkillTurn {
  private timeZonePromise?: Promise<string>;

  constructor(
    readonly envelope: AlexaRequestEnvelope,
    readonly locale: AlexaLocale,
    readonly now: Date,
    private readonly messages: AlexaMessages,
    private readonly api: AlexaApiClient,
  ) {}

  get system(): AlexaSystem {
    return this.envelope.context.System;
  }

  /** The full request locale (`de-DE`), as the Reminders API wants it. */
  get requestLocale(): string {
    return this.envelope.request.locale ?? (this.locale === 'de' ? 'de-DE' : 'en-US');
  }

  say(key: AlexaMessageKey, params?: AlexaMessageParams): string {
    return this.messages.t(this.locale, key, params);
  }

  /** "Emma oder Paul" / "Emma or Paul". */
  listOr(items: readonly string[]): string {
    return new Intl.ListFormat(this.locale, { type: 'disjunction' }).format(items);
  }

  /** "Emma und Paul" / "Emma and Paul". */
  listAnd(items: readonly string[]): string {
    return new Intl.ListFormat(this.locale, { type: 'conjunction' }).format(items);
  }

  /** The Echo's time zone, falling back to the server's (ADR-0017). */
  timeZone(): Promise<string> {
    this.timeZonePromise ??= this.api
      .getDeviceTimeZone(this.system)
      .then((timeZone) => timeZone ?? serverTimeZone());
    return this.timeZonePromise;
  }

  /** A duration as speech; below one minute "weniger als (eine|einer) Minute". */
  duration(ms: number, grammaticalCase: DurationCase = 'nominative'): string {
    return (
      formatDuration(ms, this.locale, grammaticalCase) ??
      this.say(grammaticalCase === 'dative' ? 'lessThanAMinute' : 'lessThanAMinuteNominative')
    );
  }

  /** "vor 2 Stunden" / "2 hours ago" / "gerade eben". */
  relativePast(instant: Date): string {
    const spoken = formatDuration(this.now.getTime() - instant.getTime(), this.locale, 'dative');
    return spoken ? this.say('relativePast', { duration: spoken }) : this.say('justNow');
  }

  /** "um 14:20 Uhr", "gestern um 22:10 Uhr", "am 30. Oktober um 9:05 Uhr". */
  async whenPast(instant: Date): Promise<string> {
    const timeZone = await this.timeZone();
    const time = formatClock(instant, timeZone, this.locale);
    const day = toZoned(instant, timeZone);
    const ago = daysBetween(day, toZoned(this.now, timeZone));
    if (ago <= 0) return this.say('whenToday', { time });
    if (ago === 1) return this.say('whenYesterday', { time });
    return this.say('whenOnDate', { time, date: formatDayMonth(day, this.locale) });
  }
}

/** A turn whose Alexa account is linked to an app user. */
export class LinkedTurn extends SkillTurn {
  constructor(
    turn: SkillTurn,
    readonly principal: AlexaPrincipal,
    readonly children: readonly AccessibleChild[],
    messages: AlexaMessages,
    api: AlexaApiClient,
  ) {
    super(turn.envelope, turn.locale, turn.now, messages, api);
  }

  /**
   * Resolves which child the intent is about and runs `run` for it — or
   * answers on its own (ALX-9/10/11): no child yet, an unknown or ambiguous
   * name (asking back via `Dialog.ElicitSlot`), or a role that may not record.
   *
   * `purpose: 'record'` applies the same role bundle the REST routes use
   * (`ENTRY_WRITE_ROLES` via `mayRecordEntries`); reads are open to every
   * member, exactly like the app.
   */
  async withChild(
    intent: AlexaIntent,
    purpose: 'record' | 'read',
    run: (child: AccessibleChild) => Promise<AlexaResponseEnvelope>,
    options: { ignoreDefault?: boolean } = {},
  ): Promise<AlexaResponseEnvelope> {
    const resolution = resolveChild(
      this.children,
      slotValue(intent, SLOT.child),
      options.ignoreDefault ? null : this.principal.defaultChildId,
    );

    switch (resolution.kind) {
      case 'noChildren':
        return respond().speak(this.say('noChildren')).build();

      case 'notFound': {
        const names = resolution.candidates.map((child) => child.name);
        return respond()
          .speak(
            this.say('childNotFound', {
              spokenName: resolution.spokenName,
              childList: this.listAnd(names),
            }),
          )
          .reprompt(this.say('childReprompt', { childList: this.listOr(names) }))
          .elicitSlot(SLOT.child, intent)
          .build();
      }

      case 'ambiguous': {
        const names = resolution.candidates.map((child) => child.name);
        return respond()
          .speak(this.say('childAmbiguous', { childList: this.listOr(names) }))
          .reprompt(this.say('childReprompt', { childList: this.listOr(names) }))
          .elicitSlot(SLOT.child, intent)
          .build();
      }

      case 'resolved': {
        const { child } = resolution;
        if (
          purpose === 'record' &&
          !mayRecordEntries({ userId: this.principal.userId, role: child.role })
        ) {
          return respond()
            .speak(
              this.say('forbiddenRecord', {
                roleLabel: this.say(`role.${child.role}`),
                childName: child.name,
              }),
            )
            .build();
        }
        return run(child);
      }
    }
  }

  /** Asks for one slot again, with the question doubling as the reprompt. */
  ask(intent: AlexaIntent, slot: string, speech: string, question = speech): AlexaResponseEnvelope {
    return respond().speak(speech).reprompt(question).elicitSlot(slot, intent).build();
  }
}
