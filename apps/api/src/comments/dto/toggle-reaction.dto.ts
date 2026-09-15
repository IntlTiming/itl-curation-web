import { IsString } from 'class-validator';
import { IsSingleEmoji } from './is-single-emoji.validator.js';

export class ToggleReactionDto {
  @IsString()
  @IsSingleEmoji()
  emoji!: string;
}
