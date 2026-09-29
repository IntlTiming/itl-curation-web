import { IsNotEmpty, IsString } from 'class-validator';

export class RelinkReviewDto {
  @IsString()
  @IsNotEmpty()
  targetFileId!: string;
}
