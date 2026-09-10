import { IsString, Matches, MaxLength } from 'class-validator';
import { SLUG_PATTERN, SLUG_PATTERN_MESSAGE } from '../slug-pattern.js';

export class CheckSlugQueryDto {
  @IsString()
  @Matches(SLUG_PATTERN, { message: SLUG_PATTERN_MESSAGE })
  @MaxLength(100)
  slug!: string;
}
