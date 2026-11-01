/**
 * The subset of the Alexa Skills Kit request/response JSON this skill reads or
 * writes. Hand-written rather than pulled from `ask-sdk-model`: the skill uses
 * a small slice of the format, and the SDK would bring Lambda-oriented
 * runtime code into a NestJS process for type definitions alone.
 *
 * Reference: "Request and Response JSON Reference" in the Alexa Skills Kit docs.
 */

export interface AlexaSystem {
  application: { applicationId: string };
  user: {
    userId: string;
    /** Present once the Amazon account is linked (ALX-7). */
    accessToken?: string;
    /** Present when the user granted at least one skill permission (e.g. reminders). */
    permissions?: { consentToken?: string };
  };
  /**
   * The recognized speaker, when personalization is on. Carries its own
   * `accessToken` if that voice profile linked its own account (ALX-8).
   */
  person?: { personId: string; accessToken?: string };
  device?: { deviceId: string; supportedInterfaces?: Record<string, unknown> };
  apiEndpoint?: string;
  apiAccessToken?: string;
}

export interface AlexaSlotResolution {
  authority: string;
  status: { code: string };
  values?: Array<{ value: { name: string; id: string } }>;
}

export interface AlexaSlot {
  name: string;
  value?: string;
  confirmationStatus?: string;
  resolutions?: { resolutionsPerAuthority?: AlexaSlotResolution[] };
}

export interface AlexaIntent {
  name: string;
  confirmationStatus?: string;
  slots?: Record<string, AlexaSlot>;
}

interface AlexaRequestBase {
  type: string;
  requestId: string;
  timestamp: string;
  locale?: string;
}

export interface AlexaLaunchRequest extends AlexaRequestBase {
  type: 'LaunchRequest';
}

export interface AlexaIntentRequest extends AlexaRequestBase {
  type: 'IntentRequest';
  dialogState?: string;
  intent: AlexaIntent;
}

export interface AlexaSessionEndedRequest extends AlexaRequestBase {
  type: 'SessionEndedRequest';
  reason?: string;
  error?: { type: string; message: string };
}

/** The answer to a `Connections.SendRequest` (here: the voice permission prompt). */
export interface AlexaConnectionsResponse extends AlexaRequestBase {
  type: 'Connections.Response';
  name: string;
  status?: { code: string; message?: string };
  payload?: { status?: 'ACCEPTED' | 'DENIED' | 'NOT_ANSWERED'; permissionScope?: string };
  token?: string;
}

export type AlexaRequest =
  | AlexaLaunchRequest
  | AlexaIntentRequest
  | AlexaSessionEndedRequest
  | AlexaConnectionsResponse
  | (AlexaRequestBase & { type: 'System.ExceptionEncountered' });

export interface AlexaRequestEnvelope {
  version: string;
  session?: {
    new?: boolean;
    sessionId?: string;
    application?: { applicationId: string };
  };
  context: { System: AlexaSystem };
  request: AlexaRequest;
}

// -----------------------------------------------------------------------------
// Response
// -----------------------------------------------------------------------------

export interface AlexaOutputSpeech {
  type: 'PlainText';
  text: string;
}

export type AlexaCard =
  | { type: 'Simple'; title: string; content: string }
  | { type: 'LinkAccount' }
  | { type: 'AskForPermissionsConsent'; permissions: string[] };

export type AlexaDirective =
  | {
      type: 'Dialog.ElicitSlot';
      slotToElicit: string;
      updatedIntent: AlexaIntent;
    }
  | {
      type: 'Connections.SendRequest';
      name: 'AskFor';
      payload: {
        '@type': 'AskForPermissionsConsentRequest';
        '@version': '2';
        permissionScopes: Array<{ permissionScope: string; consentLevel: 'ACCOUNT' }>;
      };
      token: string;
    };

export interface AlexaResponseEnvelope {
  version: '1.0';
  response: {
    outputSpeech?: AlexaOutputSpeech;
    card?: AlexaCard;
    reprompt?: { outputSpeech: AlexaOutputSpeech };
    directives?: AlexaDirective[];
    shouldEndSession?: boolean;
  };
}

/** Minimal structural check before anything else touches a request body. */
export function isAlexaRequestEnvelope(value: unknown): value is AlexaRequestEnvelope {
  if (value === null || typeof value !== 'object') return false;
  const envelope = value as Partial<AlexaRequestEnvelope>;
  return (
    typeof envelope.request === 'object' &&
    envelope.request !== null &&
    typeof envelope.request.type === 'string' &&
    typeof envelope.request.timestamp === 'string' &&
    typeof envelope.context === 'object' &&
    envelope.context !== null &&
    typeof envelope.context.System === 'object' &&
    envelope.context.System !== null
  );
}
