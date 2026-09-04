import { IsIn, IsOptional } from 'class-validator';
import { INVITABLE_ROLES } from '../household-permissions';
import { HouseholdRole } from '../household-role.enum';

export class CreateInviteDto {
  /**
   * Role the invitee receives on acceptance. Optional and defaulting to
   * `CO_PARENT`, so the previously body-less `POST .../invites` keeps working
   * unchanged.
   *
   * `@IsIn(INVITABLE_ROLES)` rather than `@IsEnum(HouseholdRole)`: OWNER is a
   * valid role but not a grantable one — ownership is only ever transferred to
   * an existing member via `PATCH .../members/:userId`, never by a link that
   * could be forwarded to a stranger.
   */
  @IsOptional()
  @IsIn(INVITABLE_ROLES as unknown as HouseholdRole[])
  role?: HouseholdRole;
}
