import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Body of `PATCH /auth/me` — currently the display name is the only editable field. */
export class UpdateAuthMeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;
}
