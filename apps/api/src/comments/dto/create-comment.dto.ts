import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCommentDto {
  // Markdown text.
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  body!: string;
}
