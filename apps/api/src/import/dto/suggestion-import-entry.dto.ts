import { IsISO8601, IsString } from 'class-validator';

// Field names match suggestions.json verbatim - this DTO only structurally validates the raw
// import file. Unlike submissions.json the file is a flat array with no nested chart object.
export class SuggestionImportEntryDto {
  @IsISO8601() timestamp_utc!: string;
  @IsString() submitter!: string;
  @IsString() chart!: string;
  @IsString() reason!: string;
  @IsString() link!: string;
  @IsString() consent!: string;
}
