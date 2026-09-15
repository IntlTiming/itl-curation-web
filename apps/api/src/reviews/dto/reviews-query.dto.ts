import { Playstyle } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';

function toBoolean({ value }: { value: unknown }): boolean {
  return value === true || value === 'true';
}

export class ReviewsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(Playstyle)
  playstyle: Playstyle = Playstyle.SINGLE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minMeter?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxMeter?: number;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  unreviewedOnly: boolean = false;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  publiclyReviewableOnly: boolean = false;
}
