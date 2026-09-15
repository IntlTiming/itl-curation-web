import { EventVisibility } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class SetEventVisibilityDto {
  @IsEnum(EventVisibility)
  visibility!: EventVisibility;
}
