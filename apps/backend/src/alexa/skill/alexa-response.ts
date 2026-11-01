import type {
  AlexaCard,
  AlexaDirective,
  AlexaIntent,
  AlexaResponseEnvelope,
} from './alexa-request.types';

/** The only Alexa permission the skill asks for (ALX-6). */
export const REMINDERS_PERMISSION = 'alexa::alerts:reminders:skill:readwrite';

/**
 * Small fluent builder for skill responses, so handlers read as "say X, ask Y"
 * instead of nested JSON. Every response states `shouldEndSession` explicitly;
 * leaving it out behaves differently on devices with and without a screen.
 */
export class AlexaResponseBuilder {
  private speech?: string;
  private repromptText?: string;
  private card?: AlexaCard;
  private readonly directives: AlexaDirective[] = [];
  private endSession = true;

  speak(text: string): this {
    this.speech = text;
    return this;
  }

  /** Keeps the session open and asks again with `text` if the user stays silent. */
  reprompt(text: string): this {
    this.repromptText = text;
    this.endSession = false;
    return this;
  }

  withCard(card: AlexaCard): this {
    this.card = card;
    return this;
  }

  /** Asks for one slot of the current intent again; Alexa re-sends the intent with it filled. */
  elicitSlot(slotToElicit: string, intent: AlexaIntent): this {
    const slots = { ...(intent.slots ?? {}) };
    // A rejected value (e.g. an unknown child name) must not stick around,
    // or Alexa would send it straight back.
    if (slots[slotToElicit]) {
      slots[slotToElicit] = { name: slotToElicit, confirmationStatus: 'NONE' };
    }
    this.directives.push({
      type: 'Dialog.ElicitSlot',
      slotToElicit,
      updatedIntent: {
        name: intent.name,
        confirmationStatus: intent.confirmationStatus ?? 'NONE',
        slots,
      },
    });
    this.endSession = false;
    return this;
  }

  /**
   * Hands over to Alexa's own voice permission prompt (ALX-6). `token` comes
   * back unchanged in the `Connections.Response`, which is how the pending
   * reminder survives the hand-over. Alexa requires the session to end here.
   */
  askForPermission(permissionScope: string, token: string): this {
    this.directives.push({
      type: 'Connections.SendRequest',
      name: 'AskFor',
      payload: {
        '@type': 'AskForPermissionsConsentRequest',
        '@version': '2',
        permissionScopes: [{ permissionScope, consentLevel: 'ACCOUNT' }],
      },
      token,
    });
    this.endSession = true;
    return this;
  }

  build(): AlexaResponseEnvelope {
    return {
      version: '1.0',
      response: {
        ...(this.speech !== undefined
          ? { outputSpeech: { type: 'PlainText', text: this.speech } }
          : {}),
        ...(this.card ? { card: this.card } : {}),
        ...(this.repromptText !== undefined
          ? { reprompt: { outputSpeech: { type: 'PlainText', text: this.repromptText } } }
          : {}),
        ...(this.directives.length > 0 ? { directives: this.directives } : {}),
        shouldEndSession: this.endSession,
      },
    };
  }
}

export function respond(): AlexaResponseBuilder {
  return new AlexaResponseBuilder();
}

/** The empty answer to `SessionEndedRequest` and `System.ExceptionEncountered` (no speech allowed). */
export function emptyResponse(): AlexaResponseEnvelope {
  return { version: '1.0', response: {} };
}
