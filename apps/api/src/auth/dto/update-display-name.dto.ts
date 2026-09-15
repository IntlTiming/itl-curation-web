import { IsString, MaxLength } from 'class-validator';

export class UpdateDisplayNameDto {
  @IsString()
  @MaxLength(100)
  displayName!: string;
}
