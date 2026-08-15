import { Injectable } from '@nestjs/common';

/**
 * Trivial wrapper around `new Date()`, injected wherever "the current time"
 * is needed so tests can pin "now" deterministically instead of racing the
 * real wall clock. Introduced for the notification scheduler (feeding-reminder
 * threshold + daily-summary hour comparisons), whose correctness is entirely
 * about time boundaries — see `NotificationSchedulerService`.
 */
@Injectable()
export class ClockService {
  now(): Date {
    return new Date();
  }
}
