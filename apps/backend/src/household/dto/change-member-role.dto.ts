import { IsEnum } from 'class-validator';
import { HouseholdRole } from '../household-role.enum';

export class ChangeMemberRoleDto {
  /**
   * The new role. Unlike an invite, OWNER *is* allowed here: promoting an
   * existing, known member is how ownership is shared or transferred, and it
   * is a deliberate act by an owner on a specific person rather than something
   * a shareable link hands out.
   */
  @IsEnum(HouseholdRole)
  role!: HouseholdRole;
}
