import { IsEnum, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsDateOnly } from '../../common/validators/is-date-only.validator';
import { IsNotFutureDate } from '../../common/validators/is-not-future-date.validator';
import { MilestoneCategory } from '../milestone-category.enum';
import { MilestoneTemplate } from '../milestone-template.enum';
import { MAX_MILESTONE_TITLE_LENGTH, MAX_NOTE_LENGTH } from '../milestone.constants';
import { TemplateOrFreeEntry } from '../validators/template-or-free.validator';

/**
 * Request body for `POST .../milestones`.
 *
 * `title` is required for **both** kinds of entry. For a template entry the
 * client sends the translated catalog label as it read at creation time and
 * the server freezes it — see the comment on `Milestone.title` in
 * `schema.prisma` for why the label is stored rather than translated at read
 * time.
 *
 * `achievedAt` is a bare calendar day (`YYYY-MM-DD`), not an instant: a
 * milestone happens on a day, and it is usually entered from memory rather
 * than clocked. Stored the same way `Child.birthDate` is — parsed to UTC
 * midnight — so the two can be compared as calendar days without any timezone
 * reasoning.
 *
 * The "not before the child's birth date" half of M-6 is *not* checked here:
 * this DTO has no access to the child. `MilestoneService.create` enforces it.
 */
export class CreateMilestoneDto {
  // Absent (or null) means a free entry (M-4). `@IsEnum` rejects any key that
  // is not in the catalog, so the service can narrow with
  // `toMilestoneTemplate()` without a second round of user-facing validation.
  @IsOptional()
  @IsEnum(MilestoneTemplate)
  templateKey?: MilestoneTemplate | null;

  @IsString()
  @MinLength(1)
  @MaxLength(MAX_MILESTONE_TITLE_LENGTH)
  title!: string;

  // Only meaningful for a free entry — for a template one the catalog defines
  // it; see `@TemplateOrFreeEntry()` below.
  @IsOptional()
  @IsEnum(MilestoneCategory)
  category?: MilestoneCategory | null;

  // `@TemplateOrFreeEntry()` is attached to this required field on purpose —
  // see the validator's doc comment.
  @IsDateOnly()
  @IsISO8601({ strict: true })
  @IsNotFutureDate()
  @TemplateOrFreeEntry()
  achievedAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_NOTE_LENGTH)
  note?: string;
}
