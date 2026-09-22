import { Playstyle } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';

function toBoolean({ value }: { value: unknown }): boolean {
  return value === true || value === 'true';
}

function toStringArray({ value }: { value: unknown }): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value !== 'string' || value.trim() === '') return [];
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
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

  // TechTag.code values (e.g. "BR", "XO") from a comma-separated query param, e.g.
  // ?techTags=BR,XO - deliberately unvalidated against the known 20 codes, same as `search`'s
  // unvalidated free text; an unknown code just matches nothing.
  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @IsString({ each: true })
  techTags: string[] = [];

  // Submission.focus raw values (e.g. "Speed", "Stamina") from a comma-separated query param,
  // e.g. ?focus=Speed,Stamina - unvalidated, like techTags above, since the option list itself
  // changes between seasons (see the schema comment on Submission.focus) rather than being a
  // fixed enum.
  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @IsString({ each: true })
  focus: string[] = [];
}
