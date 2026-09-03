import { IsBoolean, IsInt, Max, Min } from 'class-validator';
import { MEDICAL_REMINDER_MAX_LEAD_DAYS } from '../notification-settings.service';

/**
 * Body of `PUT households/:householdId/children/:childId/notification-settings`.
 * A full representation (PUT semantics): all editable fields are required.
 * `feedingReminderLastSentAt` is deliberately not exposed — it's internal
 * scheduler bookkeeping, never client-editable. The medical reminder's
 * de-duplication state is not here either: it lives per record on
 * `HealthRecord.reminderLastSentAt`.
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

  // Reminders for planned medications/vaccinations (MED-8).
  @IsBoolean()
  medicalReminderEnabled!: boolean;

  // At least 1 day of lead time — a 0-day lead is just the due-day reminder,
  // which every enabled member gets anyway, so it is not a separate setting.
  @IsInt()
  @Min(1)
  @Max(MEDICAL_REMINDER_MAX_LEAD_DAYS)
  medicalReminderLeadDays!: number;
}
