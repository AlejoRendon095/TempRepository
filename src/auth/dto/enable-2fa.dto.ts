import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class Enable2faDto {
  @ApiProperty({ description: 'Código TOTP para confirmar activación' })
  @IsString()
  @Length(6, 6)
  code: string;
}