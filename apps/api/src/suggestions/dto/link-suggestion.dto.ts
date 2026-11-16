import { IsNotEmpty, IsString } from 'class-validator';

export class LinkSuggestionDto {
  @IsString()
  @IsNotEmpty()
  fileId!: string;
}
