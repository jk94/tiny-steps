import { IsDefined, IsString, MaxLength, ValidateIf } from 'class-validator';

/** `PATCH /api/alexa/links/:linkId` — `null` clears the default child. */
export class UpdateAlexaLinkDto {
  @IsDefined()
  @ValidateIf((_dto, value) => value !== null)
  @IsString()
  @MaxLength(64)
  defaultChildId!: string | null;
}
