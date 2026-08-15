import { IsBoolean, IsInt, Max, Min } from 'class-validator';

/**
 * Body of `PUT households/:householdId/children/:childId/notification-settings`.
 * A full representation (PUT semantics): all four editable fields are required.
 * `feedingReminderLastSentAt` is deliberately not exposed — it's internal
 * scheduler bookkeeping, never client-editable.
 */
export class UpdateNotificationSettingsDto {
  @IsBoolean()
  feedingReminderEnabled!: boolean;

  // At least 1 hour — a zero/negative threshold would mean "remind
  // constantly", which is never meaningful (also rejected client-side).
  @IsInt()
  @Min(1)
  feedingReminderThresholdHours!: number;

  @IsBoolean()
  dailySummaryEnabled!: boolean;

  // Hour-of-day in the server's local timezone (MVP simplification).
  @IsInt()
  @Min(0)
  @Max(23)
  dailySummaryHourLocal!: number;
}
