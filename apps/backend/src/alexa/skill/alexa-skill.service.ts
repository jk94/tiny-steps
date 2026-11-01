import { Injectable, Logger } from '@nestjs/common';
import { ClockService } from '../../common/clock.service';
import { AlexaChildDirectory } from '../alexa-child-directory.service';
import { AlexaOAuthService } from '../oauth/alexa-oauth.service';
import { AlexaApiClient } from './alexa-api.client';
import { AlexaMessages, toAlexaLocale } from './alexa-messages';
import type {
  AlexaIntentRequest,
  AlexaRequestEnvelope,
  AlexaResponseEnvelope,
} from './alexa-request.types';
import { emptyResponse, respond } from './alexa-response';
import { ALEXA_BUILT_IN_INTENTS, ALEXA_INTENTS } from './alexa-slots';
import { AlexaQueryHandlers } from './handlers/query.handlers';
import { AlexaRecordingHandlers } from './handlers/recording.handlers';
import { AlexaReminderHandlers } from './handlers/reminder.handlers';
import { LinkedTurn, SkillTurn } from './skill-turn';

type IntentHandler = (
  turn: LinkedTurn,
  intent: AlexaIntentRequest['intent'],
) => Promise<AlexaResponseEnvelope>;

/**
 * Answers a verified skill request (ADR-0017): picks the handler, makes sure
 * the Amazon account is linked, and turns every failure into a spoken
 * fallback instead of an HTTP error (ALX-11) — Alexa would otherwise just say
 * "there was a problem with the requested skill's response".
 */
@Injectable()
export class AlexaSkillService {
  private readonly logger = new Logger(AlexaSkillService.name);
  private readonly handlers: Readonly<Record<string, IntentHandler>>;

  constructor(
    private readonly oauth: AlexaOAuthService,
    private readonly childDirectory: AlexaChildDirectory,
    private readonly messages: AlexaMessages,
    private readonly api: AlexaApiClient,
    private readonly clock: ClockService,
    recording: AlexaRecordingHandlers,
    queries: AlexaQueryHandlers,
    private readonly reminders: AlexaReminderHandlers,
  ) {
    this.handlers = {
      [ALEXA_INTENTS.logFeeding]: (turn, intent) => recording.logFeeding(turn, intent),
      [ALEXA_INTENTS.stopFeeding]: (turn, intent) => recording.stopFeeding(turn, intent),
      [ALEXA_INTENTS.logDiaper]: (turn, intent) => recording.logDiaper(turn, intent),
      [ALEXA_INTENTS.startSleep]: (turn, intent) => recording.startSleep(turn, intent),
      [ALEXA_INTENTS.stopSleep]: (turn, intent) => recording.stopSleep(turn, intent),
      [ALEXA_INTENTS.logSleep]: (turn, intent) => recording.logSleep(turn, intent),
      [ALEXA_INTENTS.lastActivity]: (turn, intent) => queries.lastActivity(turn, intent),
      [ALEXA_INTENTS.dailySummary]: (turn, intent) => queries.dailySummary(turn, intent),
      [ALEXA_INTENTS.upcomingHealth]: (turn, intent) => queries.upcomingHealthRecords(turn, intent),
      [ALEXA_INTENTS.setDefaultChild]: (turn, intent) => queries.setDefaultChild(turn, intent),
      [ALEXA_INTENTS.feedingReminder]: (turn, intent) => reminders.feedingReminder(turn, intent),
      [ALEXA_INTENTS.medicationReminder]: (turn, intent) =>
        reminders.medicationReminder(turn, intent),
    };
  }

  /** Names of every custom intent with a handler — the interaction-model sync test reads this. */
  get handledIntents(): string[] {
    return Object.keys(this.handlers);
  }

  async handle(envelope: AlexaRequestEnvelope): Promise<AlexaResponseEnvelope> {
    const turn = new SkillTurn(
      envelope,
      toAlexaLocale(envelope.request.locale),
      this.clock.now(),
      this.messages,
      this.api,
    );

    try {
      const { request } = envelope;
      switch (request.type) {
        case 'LaunchRequest':
          return await this.withLinkedAccount(turn, async (linked) =>
            respond().speak(linked.say('welcome')).reprompt(linked.say('welcomeReprompt')).build(),
          );

        case 'IntentRequest':
          return await this.onIntent(turn, request);

        case 'Connections.Response':
          if (request.name !== 'AskFor') return emptyResponse();
          return await this.withLinkedAccount(turn, (linked) =>
            this.reminders.onPermissionResponse(linked, request),
          );

        case 'SessionEndedRequest':
          if (request.error) {
            this.logger.warn(
              `Alexa session ended with ${request.error.type}: ${request.error.message}`,
            );
          }
          return emptyResponse();

        case 'System.ExceptionEncountered':
          this.logger.warn('Alexa reported an exception for a previous response');
          return emptyResponse();

        default:
          return this.fallback(turn);
      }
    } catch (error) {
      this.logger.error(
        `Alexa request ${envelope.request.type} failed: ${error instanceof Error ? error.stack : String(error)}`,
      );
      // Never claim success after a failure (ALX-11).
      return respond().speak(turn.say('error')).build();
    }
  }

  private async onIntent(
    turn: SkillTurn,
    request: AlexaIntentRequest,
  ): Promise<AlexaResponseEnvelope> {
    const { intent } = request;
    switch (intent.name) {
      case ALEXA_BUILT_IN_INTENTS.help:
        return respond().speak(turn.say('help')).reprompt(turn.say('helpReprompt')).build();
      case ALEXA_BUILT_IN_INTENTS.stop:
      case ALEXA_BUILT_IN_INTENTS.cancel:
      case ALEXA_BUILT_IN_INTENTS.navigateHome:
        return respond().speak(turn.say('goodbye')).build();
      case ALEXA_BUILT_IN_INTENTS.fallback:
        return this.fallback(turn);
    }

    const handler = this.handlers[intent.name];
    if (!handler) {
      return this.fallback(turn);
    }
    return this.withLinkedAccount(turn, (linked) => handler(linked, intent));
  }

  /**
   * ALX-7/8/11: resolves the bearer token — the recognized voice profile's own
   * link first, then the account's — or answers with a `LinkAccount` card.
   * Unknown, expired and revoked tokens all land here; Alexa refreshes valid
   * ones on its own before calling.
   */
  private async withLinkedAccount(
    turn: SkillTurn,
    run: (turn: LinkedTurn) => Promise<AlexaResponseEnvelope>,
  ): Promise<AlexaResponseEnvelope> {
    const { system } = turn;
    const principal =
      (await this.oauth.resolveAccessToken(system.person?.accessToken)) ??
      (await this.oauth.resolveAccessToken(system.user.accessToken));

    if (!principal) {
      return respond().speak(turn.say('linkAccount')).withCard({ type: 'LinkAccount' }).build();
    }

    const children = await this.childDirectory.listAccessibleChildren(principal.userId);
    return run(new LinkedTurn(turn, principal, children, this.messages, this.api));
  }

  private fallback(turn: SkillTurn): AlexaResponseEnvelope {
    return respond().speak(turn.say('fallback')).reprompt(turn.say('fallbackReprompt')).build();
  }
}
