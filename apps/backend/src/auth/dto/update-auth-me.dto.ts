import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { trimString } from './trim-string.transform';

/** Body of `PATCH /auth/me` — currently the display name is the only editable field. */
export class UpdateAuthMeDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;
}
