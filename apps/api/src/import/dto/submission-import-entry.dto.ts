import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

// Field names are snake_case to match submissions.json verbatim - this DTO exists only to
// structurally validate the raw import file, never exposed to any other part of the app.
export class SubmissionImportChartDto {
  @IsString() hash!: string;
  @IsString() title!: string;
  @IsString() title_romaji!: string;
  @IsString() subtitle!: string;
  @IsString() subtitle_romaji!: string;
  @IsString() artist!: string;
  @IsString() artist_romaji!: string;
  @IsString() playstyle!: string;
  @IsString() difficulty!: string;
  @IsInt() meter!: number;
  @IsInt() min_bpm!: number;
  @IsInt() max_bpm!: number;
  @IsInt() total_steps!: number;
  @IsInt() total_rolls!: number;
  @IsInt() total_holds!: number;
  @IsInt() total_mines!: number;
  @IsInt() total_jumps!: number;
  @IsInt() length_seconds!: number;
  @IsInt() total_measures!: number;
  @IsInt() total_break_measures!: number;
  @IsInt() total_stream_measures!: number;
  @IsInt() total_true_stream_measures!: number;
  @IsBoolean() disqualified!: boolean;

  @IsNumber() weighted_nps!: number; // float in source (e.g. 8.667) - scaled to a thousandths Int at mapping time
  @IsOptional() @IsInt() bracket_count!: number | null;
  @IsOptional() @IsInt() half_crossover_count!: number | null;
  @IsOptional() @IsInt() full_crossover_count!: number | null;
  @IsOptional() @IsInt() crossover_count!: number | null;
  @IsOptional() @IsInt() down_footswitch_count!: number | null;
  @IsOptional() @IsInt() up_footswitch_count!: number | null;
  @IsOptional() @IsInt() footswitch_count!: number | null;
  @IsOptional() @IsInt() doublestep_count!: number | null;
  @IsOptional() @IsInt() jack_count!: number | null;
  @IsOptional() @IsInt() sideswitch_count!: number | null;
}

export class SubmissionImportEntryDto {
  @IsString() file_id!: string;
  @IsString() status!: string;
  @IsOptional() @IsString() song_dir!: string | null;
  @IsString() stepartist!: string;
  @IsString() submitter!: string;
  @IsString() pack!: string;
  @IsString() playstyle!: string;
  @IsString() difficulty!: string;
  @IsString() no_cmod!: string;
  @IsString() focus!: string;
  @IsArray() @IsString({ each: true }) tech_represented!: string[];
  @IsString() tech_represented_single!: string;
  @IsString() new_focus!: string;
  @IsString() additional_notes!: string;
  @IsString() consents_to_public_review!: string;
  @IsString() year!: string;
  @IsString() theme!: string;
  @IsString() file_url!: string;
  @IsString() file_md5!: string;
  @IsString() banner_slug!: string;
  @IsBoolean() is_internal!: boolean;
  @IsISO8601() timestamp_utc!: string;
  @IsBoolean() is_ignored!: boolean;

  // @IsOptional() treats both null and undefined as "skip nested validation" (confirmed
  // against class-validator's own implementation), so this correctly allows chart: null.
  @IsOptional()
  @ValidateNested()
  @Type(() => SubmissionImportChartDto)
  chart!: SubmissionImportChartDto | null;
}
