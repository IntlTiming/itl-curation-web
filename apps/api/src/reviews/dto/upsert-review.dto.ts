import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

// Rating is stored on Review as hundredths (e.g. 150 = 1.50) - this DTO takes the plain decimal
// value the dropdown shows and ReviewsService scales it on the way in.
const RATING_OPTIONS = [0, 1, 1.5, 2, 2.5, 3];

export class ReviewBasicCheckDto {
  @IsString()
  basicCheckReasonId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class UpsertReviewDto {
  @IsOptional()
  @IsIn(RATING_OPTIONS)
  rating?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  passing?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  scoring?: number;

  // Markdown text.
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReviewBasicCheckDto)
  basicChecks?: ReviewBasicCheckDto[];
}
