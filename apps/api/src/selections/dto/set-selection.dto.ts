import { IsBoolean } from 'class-validator';

export class SetSelectionDto {
  @IsBoolean()
  selected!: boolean;
}
