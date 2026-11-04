import { Injectable, Logger } from '@nestjs/common';
import type { AlexaSystem } from './alexa-request.types';
import { isValidTimeZone } from './alexa-time';

const TIME_ZONE_CACHE_TTL_MS = 60 * 60 * 1000;
const TIME_ZONE_CACHE_MAX_ENTRIES = 500;
// Alexa gives a skill ~8 s per response in total; outbound calls stay well under.
const TIME_ZONE_TIMEOUT_MS = 2000;
const REMINDER_TIMEOUT_MS = 4000;

/** A reminder as the Alexa Reminders API expects it (`POST /v1/alerts/reminders`). */
export interface AlexaReminderRequest {
  requestTime: string;
  trigger:
    | { type: 'SCHEDULED_RELATIVE'; offsetInSeconds: number }
    | {
        type: 'SCHEDULED_ABSOLUTE';
        scheduledTime?: string;
        timeZoneId: string;
        recurrence?: { startDateTime: string; recurrenceRules: string[] };
      };
  alertInfo: { spokenInfo: { content: Array<{ locale: string; text: string }> } };
  pushNotification: { status: 'ENABLED' | 'DISABLED' };
}

export type ReminderOutcome = 'created' | 'permissionMissing' | 'failed';

/**
 * Outbound calls to Amazon's Alexa APIs on behalf of one skill request, using
 * the short-lived `apiAccessToken` Amazon put into that request.
 *
 * `apiEndpoint` arrives inside the (signature-verified) request; it is never
 * used as a URL itself. It only *selects* one of Amazon's fixed regional API
 * origins below, so a skill request can never make the backend send that
 * bearer token — or any request — anywhere else (SSRF guard). The device ID,
 * the only other request-derived URL part, must look like an Alexa device ID
 * and is path-encoded.
 */
@Injectable()
export class AlexaApiClient {
  private readonly logger = new Logger(AlexaApiClient.name);
  private readonly timeZones = new Map<string, { timeZone: string; expiresAt: number }>();

  /**
   * The Echo device's time zone (Settings API, no customer permission
   * needed), cached per device for an hour; `null` when unavailable.
   */
  async getDeviceTimeZone(system: AlexaSystem): Promise<string | null> {
    const deviceId = system.device?.deviceId;
    const base = alexaApiOrigin(system.apiEndpoint);
    if (!deviceId || !ALEXA_DEVICE_ID.test(deviceId) || !base || !system.apiAccessToken) {
      return null;
    }

    const cached = this.timeZones.get(deviceId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.timeZone;
    }

    try {
      const response = await fetch(
        `${base}/v2/devices/${encodeURIComponent(deviceId)}/settings/System.timeZone`,
        {
          headers: { Authorization: `Bearer ${system.apiAccessToken}`, Accept: 'application/json' },
          signal: AbortSignal.timeout(TIME_ZONE_TIMEOUT_MS),
        },
      );
      if (!response.ok) {
        this.logger.warn(`Alexa time-zone lookup failed with HTTP ${response.status}`);
        return null;
      }
      const timeZone: unknown = await response.json();
      if (typeof timeZone !== 'string' || !isValidTimeZone(timeZone)) {
        return null;
      }
      if (this.timeZones.size >= TIME_ZONE_CACHE_MAX_ENTRIES) {
        this.timeZones.clear();
      }
      this.timeZones.set(deviceId, { timeZone, expiresAt: Date.now() + TIME_ZONE_CACHE_TTL_MS });
      return timeZone;
    } catch (error) {
      this.logger.warn(`Alexa time-zone lookup failed: ${String(error)}`);
      return null;
    }
  }

  /**
   * Creates a reminder on the user's Alexa account. 401/403 mean the user has
   * not (or no longer) granted the reminders permission (ALX-6).
   */
  async createReminder(
    system: AlexaSystem,
    reminder: AlexaReminderRequest,
  ): Promise<ReminderOutcome> {
    const base = alexaApiOrigin(system.apiEndpoint);
    if (!base || !system.apiAccessToken) {
      return 'failed';
    }

    try {
      const response = await fetch(`${base}/v1/alerts/reminders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${system.apiAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reminder),
        signal: AbortSignal.timeout(REMINDER_TIMEOUT_MS),
      });
      if (response.ok) {
        return 'created';
      }
      if (response.status === 401 || response.status === 403) {
        return 'permissionMissing';
      }
      const detail = await response.text().catch(() => '');
      this.logger.warn(
        `Alexa reminder creation failed with HTTP ${response.status}: ${detail.slice(0, 300)}`,
      );
      return 'failed';
    } catch (error) {
      this.logger.warn(`Alexa reminder creation failed: ${String(error)}`);
      return 'failed';
    }
  }
}

/**
 * Amazon's regional Alexa API origins (North America, Europe, Far East) — the
 * only values `context.System.apiEndpoint` takes.
 */
export const ALEXA_API_ORIGINS = [
  'https://api.amazonalexa.com',
  'https://api.eu.amazonalexa.com',
  'https://api.fe.amazonalexa.com',
] as const;

/** `amzn1.ask.device.…` — Alexa device IDs are opaque but always of this shape. */
const ALEXA_DEVICE_ID = /^amzn1\.ask\.device\.[A-Za-z0-9_-]{1,512}$/;

/**
 * The allow-listed origin a request's `apiEndpoint` names, or `null`. Returns
 * the constant from `ALEXA_API_ORIGINS`, never the request's own string.
 */
export function alexaApiOrigin(
  apiEndpoint: string | undefined,
): (typeof ALEXA_API_ORIGINS)[number] | null {
  if (!apiEndpoint) return null;
  let origin: string;
  try {
    const url = new URL(apiEndpoint);
    if (
      url.username !== '' ||
      url.password !== '' ||
      (url.pathname !== '/' && url.pathname !== '')
    ) {
      return null;
    }
    origin = url.origin;
  } catch {
    return null;
  }
  return ALEXA_API_ORIGINS.find((allowed) => allowed === origin) ?? null;
}
