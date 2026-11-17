import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class Verify2faDto {
  @ApiProperty({ description: 'Token temporal de 2FA (del login)' })
  @IsString()
  tempToken: string;

  @ApiProperty({ description: 'Código TOTP de 6 dígitos' })
  @IsString()
  @Length(6, 6)
  code: string;
}