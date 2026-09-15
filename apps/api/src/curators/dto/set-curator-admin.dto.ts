import { IsBoolean } from 'class-validator';

export class SetCuratorAdminDto {
  @IsBoolean()
  isAdmin!: boolean;
}
