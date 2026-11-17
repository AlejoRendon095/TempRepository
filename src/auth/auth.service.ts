import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { OTP, generateSecret, verifySync } from 'otplib';
import QRCode from 'qrcode';
import { UsersService, CreateUserDto } from '../users/users.service';
import { User } from '../users/user.entity';
import { RevokedTokensService } from './tokens/revoked-tokens.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Verify2faDto } from './dto/verify-2fa.dto';
import { Enable2faDto } from './dto/enable-2fa.dto';
import { TokenPairDto, UserResponseDto, Requires2faDto, TwoFaQrResponseDto } from './dto/auth-response.dto';
import { UserRole } from '../common/enums/user-role.enum';

export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  jti: string;
  exp: number;
  purpose?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly revokedTokensService: RevokedTokensService,
  ) {}

  async register(dto: RegisterDto): Promise<TokenPairDto> {
    const createUserDto: CreateUserDto = {
      email: dto.email,
      password: dto.password,
      role: UserRole.USER,
    };

    const user = await this.usersService.create(createUserDto);
    return this.generateTokenPair(user);
  }

  async login(dto: LoginDto): Promise<TokenPairDto | Requires2faDto> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isValid = await this.usersService.validatePassword(user, dto.password);
    if (!isValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (user.twoFaEnabled) {
      const tempToken = this.generateTempToken(user);
      return { requires2fa: true, tempToken };
    }

    return this.generateTokenPair(user);
  }

  async refresh(refreshToken: string): Promise<TokenPairDto> {
    let payload: TokenPayload;
    try {
      payload = this.jwtService.verify<TokenPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    if (payload.purpose !== 'refresh') {
      throw new UnauthorizedException('Token no válido para refresh');
    }

    const isRevoked = await this.revokedTokensService.isRevoked(payload.jti);
    if (isRevoked) {
      throw new UnauthorizedException('Refresh token revocado');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    await this.revokedTokensService.revoke(
      payload.jti,
      user.id,
      new Date(payload.exp * 1000),
    );

    return this.generateTokenPair(user);
  }

  async logout(accessToken: string): Promise<void> {
    let payload: TokenPayload;
    try {
      payload = this.jwtService.verify<TokenPayload>(accessToken, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Token inválido');
    }

    await this.revokedTokensService.revoke(
      payload.jti,
      payload.sub,
      new Date(payload.exp * 1000),
    );
  }

  async me(userId: string): Promise<UserResponseDto> {
    const user = await this.usersService.findByIdOrFail(userId);
    return this.toUserResponse(user);
  }

  private generateTokenPair(user: User): TokenPairDto {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);
    return {
      accessToken,
      refreshToken,
      user: this.toUserResponse(user),
    };
  }

  private generateAccessToken(user: User): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      jti: crypto.randomUUID(),
    };
    const ttl = Number(this.configService.get('JWT_ACCESS_TTL', 900));
    return this.jwtService.sign(payload, { expiresIn: ttl });
  }

  private generateRefreshToken(user: User): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      jti: crypto.randomUUID(),
      purpose: 'refresh',
    };
    const ttl = Number(this.configService.get('JWT_REFRESH_TTL', 604800));
    return this.jwtService.sign(payload, { expiresIn: ttl });
  }

  private generateTempToken(user: User): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      jti: crypto.randomUUID(),
      purpose: '2fa',
    };
    return this.jwtService.sign(payload, { expiresIn: 300 });
  }

  private toUserResponse(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      twoFaEnabled: user.twoFaEnabled,
      createdAt: user.createdAt,
    };
  }

  async generateTwoFaSecret(user: User): Promise<{ secret: string; otpauthUrl: string }> {
    const secret = generateSecret();
    const otp = new OTP();
    const otpauthUrl = otp.generateURI({
      issuer: 'ModerationAPI',
      label: user.email,
      secret,
    });
    await this.usersService.updateTwoFaSecret(user.id, secret);
    return { secret, otpauthUrl };
  }

  async getTwoFaQrCode(otpauthUrl: string): Promise<string> {
    return QRCode.toDataURL(otpauthUrl);
  }

  verifyTwoFaCode(secret: string, code: string): boolean {
    const result = verifySync({ secret, token: code });
    return result.valid;
  }

  async verifyTwoFa(dto: Verify2faDto): Promise<TokenPairDto> {
    let payload: TokenPayload;
    try {
      payload = this.jwtService.verify<TokenPayload>(dto.tempToken, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Token 2FA inválido o expirado');
    }

    if (payload.purpose !== '2fa') {
      throw new UnauthorizedException('Token no válido para 2FA');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.twoFaEnabled || !user.twoFaSecret) {
      throw new UnauthorizedException('2FA no configurado para este usuario');
    }

    const isValid = this.verifyTwoFaCode(user.twoFaSecret, dto.code);
    if (!isValid) {
      throw new UnauthorizedException('Código 2FA inválido');
    }

    await this.revokedTokensService.revoke(
      payload.jti,
      user.id,
      new Date(payload.exp * 1000),
    );

    return this.generateTokenPair(user);
  }

  async getTwoFaSetup(userId: string): Promise<TwoFaQrResponseDto> {
    const user = await this.usersService.findByIdOrFail(userId);

    if (user.twoFaEnabled) {
      throw new UnauthorizedException('2FA ya está habilitado');
    }

    let secret = user.twoFaSecret;
    let otpauthUrl: string;

    if (!secret) {
      const result = await this.generateTwoFaSecret(user);
      secret = result.secret;
      otpauthUrl = result.otpauthUrl;
    } else {
      const otp = new OTP();
      otpauthUrl = otp.generateURI({
        issuer: 'ModerationAPI',
        label: user.email,
        secret,
      });
    }

    const qrCodeDataUrl = await this.getTwoFaQrCode(otpauthUrl);

    return {
      secret,
      otpauthUrl,
      qrCodeDataUrl,
    };
  }

  async enableTwoFa(userId: string, dto: Enable2faDto): Promise<void> {
    const user = await this.usersService.findByIdOrFail(userId);

    if (user.twoFaEnabled) {
      throw new UnauthorizedException('2FA ya está habilitado');
    }

    if (!user.twoFaSecret) {
      throw new UnauthorizedException('Primero debe obtener el código QR');
    }

    const isValid = this.verifyTwoFaCode(user.twoFaSecret, dto.code);
    if (!isValid) {
      throw new UnauthorizedException('Código 2FA inválido');
    }

    await this.usersService.enableTwoFa(userId);
  }

  async disableTwoFa(userId: string, password: string): Promise<void> {
    const user = await this.usersService.findByIdOrFail(userId);

    if (!user.twoFaEnabled) {
      throw new UnauthorizedException('2FA no está habilitado');
    }

    const isValid = await this.usersService.validatePassword(user, password);
    if (!isValid) {
      throw new UnauthorizedException('Contraseña incorrecta');
    }

    await this.usersService.disableTwoFa(userId);
  }
}