import { IsNotEmpty, IsString } from 'class-validator';

export class AddCuratorDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;
}
