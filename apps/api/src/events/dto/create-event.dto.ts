import { IsDateString, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { SLUG_PATTERN, SLUG_PATTERN_MESSAGE } from '../slug-pattern.js';

export class CreateEventDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsString()
  @Matches(SLUG_PATTERN, { message: SLUG_PATTERN_MESSAGE })
  @MaxLength(100)
  slug!: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}
