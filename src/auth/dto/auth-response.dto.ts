import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../common/enums/user-role.enum';

export class UserResponseDto {
  @ApiProperty({ example: 'uuid-v4-string' })
  id: string;

  @ApiProperty({ example: 'usuario@ejemplo.com' })
  email: string;

  @ApiProperty({ enum: UserRole, example: UserRole.USER })
  role: UserRole;

  @ApiProperty({ example: false })
  twoFaEnabled: boolean;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  createdAt: Date;
}

export class TokenPairDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refreshToken: string;

  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;
}

export class Requires2faDto {
  @ApiProperty({ example: true })
  requires2fa: true;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', description: 'Token temporal para desafío 2FA' })
  tempToken: string;
}

export class TwoFaQrResponseDto {
  @ApiProperty({ example: 'JBSWY3DPEHPK3PXP', description: 'Secreto TOTP (solo se muestra una vez)' })
  secret: string;

  @ApiProperty({ example: 'otpauth://totp/ModerationAPI:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=ModerationAPI', description: 'URI otpauth:// para apps de autenticación' })
  otpauthUrl: string;

  @ApiProperty({ example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...', description: 'QR code como data URL (base64 PNG)' })
  qrCodeDataUrl: string;
}