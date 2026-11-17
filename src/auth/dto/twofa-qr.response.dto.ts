import { ApiProperty } from '@nestjs/swagger';

export class TwoFaQrResponseDto {
  @ApiProperty({ description: 'Secreto TOTP (solo se muestra una vez)' })
  secret: string;

  @ApiProperty({ description: 'URI otpauth:// para apps de autenticación' })
  otpauthUrl: string;

  @ApiProperty({ description: 'QR code como data URL (base64 PNG)' })
  qrCodeDataUrl: string;
}