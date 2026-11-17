import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { RevokedTokensService } from './tokens/revoked-tokens.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Verify2faDto } from './dto/verify-2fa.dto';
import { Enable2faDto } from './dto/enable-2fa.dto';
import { User } from '../users/user.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { TwoFaQrResponseDto } from './dto/auth-response.dto';

jest.mock('bcrypt');
jest.mock('otplib', () => ({
  generateSecret: jest.fn(),
  verifySync: jest.fn(),
  OTP: jest.fn().mockImplementation(() => ({
    generateURI: jest.fn(),
  })),
}));
jest.mock('qrcode', () => ({
  toDataURL: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let revokedTokensService: jest.Mocked<RevokedTokensService>;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    role: UserRole.USER,
    twoFaSecret: null,
    twoFaEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockUsersService = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      findByIdOrFail: jest.fn(),
      validatePassword: jest.fn(),
      updateTwoFaSecret: jest.fn(),
      enableTwoFa: jest.fn(),
      disableTwoFa: jest.fn(),
    };

    const mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
      getOrThrow: jest.fn(),
    };

    const mockRevokedTokensService = {
      isRevoked: jest.fn(),
      revoke: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: RevokedTokensService, useValue: mockRevokedTokensService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
    revokedTokensService = module.get(RevokedTokensService);

    jest.clearAllMocks();

    configService.get.mockImplementation((key: string) => {
      const config: Record<string, string> = {
        JWT_SECRET: 'test-secret',
        JWT_ACCESS_TTL: '900',
        JWT_REFRESH_TTL: '604800',
        BCRYPT_ROUNDS: '10',
      };
      return config[key];
    });
    configService.getOrThrow.mockImplementation((key: string) => {
      const config: Record<string, string> = {
        JWT_SECRET: 'test-secret',
      };
      return config[key];
    });

    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
  });

  describe('register', () => {
    it('should register a new user and return token pair', async () => {
      const dto: RegisterDto = { email: 'new@example.com', password: 'Password123!' };
      const createdUser = { ...mockUser, id: 'new-user-id', email: dto.email };

      usersService.create.mockResolvedValue(createdUser);
      jwtService.sign.mockReturnValue('access-token');

      const result = await service.register(dto);

      expect(usersService.create).toHaveBeenCalledWith({
        email: dto.email,
        password: dto.password,
        role: UserRole.USER,
      });
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe(dto.email);
    });
  });

  describe('login', () => {
    it('should return token pair for valid credentials without 2FA', async () => {
      const dto: LoginDto = { email: 'test@example.com', password: 'Password123!' };
      const userWithout2fa = { ...mockUser, twoFaEnabled: false };

      usersService.findByEmail.mockResolvedValue(userWithout2fa);
      usersService.validatePassword.mockResolvedValue(true);
      jwtService.sign.mockReturnValue('access-token');

      const result = await service.login(dto);

      expect(usersService.findByEmail).toHaveBeenCalledWith(dto.email);
      expect(usersService.validatePassword).toHaveBeenCalledWith(userWithout2fa, dto.password);
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).not.toHaveProperty('requires2fa');
    });

    it('should return requires2fa for user with 2FA enabled', async () => {
      const dto: LoginDto = { email: 'test@example.com', password: 'Password123!' };
      const userWith2fa = { ...mockUser, twoFaEnabled: true };

      usersService.findByEmail.mockResolvedValue(userWith2fa);
      usersService.validatePassword.mockResolvedValue(true);
      jwtService.sign.mockReturnValue('temp-token');

      const result = await service.login(dto);

      expect(result).toEqual({ requires2fa: true, tempToken: 'temp-token' });
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      const dto: LoginDto = { email: 'nonexistent@example.com', password: 'Password123!' };

      usersService.findByEmail.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      const dto: LoginDto = { email: 'test@example.com', password: 'WrongPassword!' };

      usersService.findByEmail.mockResolvedValue(mockUser);
      usersService.validatePassword.mockResolvedValue(false);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('should return new token pair for valid refresh token', async () => {
      const refreshToken = 'valid-refresh-token';
      const payload = {
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        jti: 'token-jti',
        exp: Math.floor(Date.now() / 1000) + 3600,
        purpose: 'refresh',
      };

      jwtService.verify.mockReturnValue(payload);
      revokedTokensService.isRevoked.mockResolvedValue(false);
      usersService.findById.mockResolvedValue(mockUser);
      revokedTokensService.revoke.mockResolvedValue(undefined);
      jwtService.sign.mockReturnValue('new-access-token');

      const result = await service.refresh(refreshToken);

      expect(jwtService.verify).toHaveBeenCalledWith(refreshToken, { secret: 'test-secret' });
      expect(revokedTokensService.isRevoked).toHaveBeenCalledWith(payload.jti);
      expect(usersService.findById).toHaveBeenCalledWith(mockUser.id);
      expect(revokedTokensService.revoke).toHaveBeenCalled();
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refresh('invalid-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for non-refresh token purpose', async () => {
      const payload = { ...mockUser, purpose: 'access', jti: 'jti', exp: Date.now() };
      jwtService.verify.mockReturnValue(payload);

      await expect(service.refresh('access-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for revoked token', async () => {
      const payload = { ...mockUser, purpose: 'refresh', jti: 'revoked-jti', exp: Date.now() };
      jwtService.verify.mockReturnValue(payload);
      revokedTokensService.isRevoked.mockResolvedValue(true);

      await expect(service.refresh('revoked-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      const payload = { ...mockUser, purpose: 'refresh', jti: 'jti', exp: Date.now() };
      jwtService.verify.mockReturnValue(payload);
      revokedTokensService.isRevoked.mockResolvedValue(false);
      usersService.findById.mockResolvedValue(null);

      await expect(service.refresh('valid-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should revoke access token', async () => {
      const accessToken = 'valid-access-token';
      const payload = { sub: mockUser.id, jti: 'access-jti', exp: Math.floor(Date.now() / 1000) + 3600 };

      jwtService.verify.mockReturnValue(payload);
      revokedTokensService.revoke.mockResolvedValue(undefined);

      await service.logout(accessToken);

      expect(jwtService.verify).toHaveBeenCalledWith(accessToken, { secret: 'test-secret' });
      expect(revokedTokensService.revoke).toHaveBeenCalledWith(payload.jti, payload.sub, expect.any(Date));
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.logout('invalid-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('me', () => {
    it('should return user response', async () => {
      usersService.findByIdOrFail.mockResolvedValue(mockUser);

      const result = await service.me(mockUser.id);

      expect(usersService.findByIdOrFail).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        twoFaEnabled: mockUser.twoFaEnabled,
        createdAt: mockUser.createdAt,
      });
    });
  });

  describe('2FA - generateTwoFaSecret', () => {
    it('should generate secret and otpauthUrl', async () => {
      const { generateSecret, OTP } = require('otplib');
      const mockOTPInstance = { generateURI: jest.fn().mockReturnValue('otpauth://totp/ModerationAPI:test@example.com?secret=SECRET123&issuer=ModerationAPI') };
      generateSecret.mockReturnValue('SECRET123');
      OTP.mockImplementation(() => mockOTPInstance);

      usersService.updateTwoFaSecret.mockResolvedValue({ ...mockUser, twoFaSecret: 'SECRET123' });

      const result = await service.generateTwoFaSecret(mockUser);

      expect(generateSecret).toHaveBeenCalled();
      expect(mockOTPInstance.generateURI).toHaveBeenCalledWith({
        issuer: 'ModerationAPI',
        label: mockUser.email,
        secret: 'SECRET123',
      });
      expect(usersService.updateTwoFaSecret).toHaveBeenCalledWith(mockUser.id, 'SECRET123');
      expect(result).toEqual({
        secret: 'SECRET123',
        otpauthUrl: 'otpauth://totp/ModerationAPI:test@example.com?secret=SECRET123&issuer=ModerationAPI',
      });
    });
  });

  describe('2FA - getTwoFaQrCode', () => {
    it('should return QR code data URL', async () => {
      const QRCode = require('qrcode');
      QRCode.toDataURL.mockResolvedValue('data:image/png;base64,QRCODE');

      const result = await service.getTwoFaQrCode('otpauth://...');

      expect(QRCode.toDataURL).toHaveBeenCalledWith('otpauth://...');
      expect(result).toBe('data:image/png;base64,QRCODE');
    });
  });

  describe('2FA - verifyTwoFaCode', () => {
    it('should return true for valid code', () => {
      const { verifySync } = require('otplib');
      verifySync.mockReturnValue({ valid: true, delta: 0 });

      const result = service.verifyTwoFaCode('SECRET123', '123456');

      expect(verifySync).toHaveBeenCalledWith({ secret: 'SECRET123', token: '123456' });
      expect(result).toBe(true);
    });

    it('should return false for invalid code', () => {
      const { verifySync } = require('otplib');
      verifySync.mockReturnValue({ valid: false });

      const result = service.verifyTwoFaCode('SECRET123', 'wrong');

      expect(result).toBe(false);
    });
  });

  describe('2FA - verifyTwoFa', () => {
    it('should return token pair for valid 2FA code', async () => {
      const dto: Verify2faDto = { tempToken: 'valid-temp-token', code: '123456' };
      const payload = {
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        jti: 'temp-jti',
        exp: Math.floor(Date.now() / 1000) + 300,
        purpose: '2fa',
      };
      const userWith2fa = { ...mockUser, twoFaEnabled: true, twoFaSecret: 'SECRET123' };

      jwtService.verify.mockReturnValue(payload);
      usersService.findById.mockResolvedValue(userWith2fa);
      const { verifySync } = require('otplib');
      verifySync.mockReturnValue({ valid: true });
      revokedTokensService.revoke.mockResolvedValue(undefined);
      jwtService.sign.mockReturnValue('new-access-token');

      const result = await service.verifyTwoFa(dto);

      expect(jwtService.verify).toHaveBeenCalledWith(dto.tempToken, { secret: 'test-secret' });
      expect(usersService.findById).toHaveBeenCalledWith(payload.sub);
      expect(verifySync).toHaveBeenCalledWith({ secret: userWith2fa.twoFaSecret, token: dto.code });
      expect(revokedTokensService.revoke).toHaveBeenCalledWith(payload.jti, userWith2fa.id, expect.any(Date));
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw for invalid tempToken', async () => {
      jwtService.verify.mockImplementation(() => { throw new Error('Invalid'); });

      await expect(service.verifyTwoFa({ tempToken: 'invalid', code: '123456' })).rejects.toThrow(UnauthorizedException);
    });

    it('should throw for non-2fa token purpose', async () => {
      jwtService.verify.mockReturnValue({ ...mockUser, purpose: 'access', jti: 'jti', exp: Date.now() });

      await expect(service.verifyTwoFa({ tempToken: 'token', code: '123456' })).rejects.toThrow(UnauthorizedException);
    });

    it('should throw if 2FA not enabled for user', async () => {
      const payload = { sub: mockUser.id, purpose: '2fa', jti: 'jti', exp: Date.now() };
      jwtService.verify.mockReturnValue(payload);
      usersService.findById.mockResolvedValue({ ...mockUser, twoFaEnabled: false });

      await expect(service.verifyTwoFa({ tempToken: 'token', code: '123456' })).rejects.toThrow(UnauthorizedException);
    });

    it('should throw for invalid 2FA code', async () => {
      const payload = { sub: mockUser.id, purpose: '2fa', jti: 'jti', exp: Date.now() };
      const userWith2fa = { ...mockUser, twoFaEnabled: true, twoFaSecret: 'SECRET123' };
      jwtService.verify.mockReturnValue(payload);
      usersService.findById.mockResolvedValue(userWith2fa);
      const { verifySync } = require('otplib');
      verifySync.mockReturnValue({ valid: false });

      await expect(service.verifyTwoFa({ tempToken: 'token', code: 'wrong' })).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('2FA - getTwoFaSetup', () => {
    it('should return QR response for user without 2FA', async () => {
      const userWithout2fa = { ...mockUser, twoFaEnabled: false, twoFaSecret: null };
      const { generateSecret, OTP, verifySync } = require('otplib');
      const QRCode = require('qrcode');
      const mockOTPInstance = { generateURI: jest.fn().mockReturnValue('otpauth://...') };
      generateSecret.mockReturnValue('NEWSECRET');
      OTP.mockImplementation(() => mockOTPInstance);
      QRCode.toDataURL.mockResolvedValue('data:image/png;base64,QR');
      usersService.findByIdOrFail.mockResolvedValue(userWithout2fa);
      usersService.updateTwoFaSecret.mockResolvedValue({ ...userWithout2fa, twoFaSecret: 'NEWSECRET' });

      const result = await service.getTwoFaSetup(mockUser.id);

      expect(usersService.findByIdOrFail).toHaveBeenCalledWith(mockUser.id);
      expect(generateSecret).toHaveBeenCalled();
      expect(mockOTPInstance.generateURI).toHaveBeenCalled();
      expect(QRCode.toDataURL).toHaveBeenCalled();
      expect(usersService.updateTwoFaSecret).toHaveBeenCalledWith(mockUser.id, 'NEWSECRET');
      expect(result).toEqual({
        secret: 'NEWSECRET',
        otpauthUrl: 'otpauth://...',
        qrCodeDataUrl: 'data:image/png;base64,QR',
      });
    });

    it('should return QR response for user with existing secret', async () => {
      const userWithSecret = { ...mockUser, twoFaEnabled: false, twoFaSecret: 'EXISTING_SECRET' };
      const { OTP, verifySync } = require('otplib');
      const QRCode = require('qrcode');
      const mockOTPInstance = { generateURI: jest.fn().mockReturnValue('otpauth://...') };
      OTP.mockImplementation(() => mockOTPInstance);
      QRCode.toDataURL.mockResolvedValue('data:image/png;base64,QR');
      usersService.findByIdOrFail.mockResolvedValue(userWithSecret);

      const result = await service.getTwoFaSetup(mockUser.id);

      expect(mockOTPInstance.generateURI).toHaveBeenCalledWith({
        issuer: 'ModerationAPI',
        label: mockUser.email,
        secret: 'EXISTING_SECRET',
      });
      expect(result.secret).toBe('EXISTING_SECRET');
    });

    it('should throw if 2FA already enabled', async () => {
      usersService.findByIdOrFail.mockResolvedValue({ ...mockUser, twoFaEnabled: true });

      await expect(service.getTwoFaSetup(mockUser.id)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('2FA - enableTwoFa', () => {
    it('should enable 2FA for valid code', async () => {
      const dto: Enable2faDto = { code: '123456' };
      const userWithSecret = { ...mockUser, twoFaEnabled: false, twoFaSecret: 'SECRET123' };
      const { verifySync } = require('otplib');
      verifySync.mockReturnValue({ valid: true });
      usersService.findByIdOrFail.mockResolvedValue(userWithSecret);
      usersService.enableTwoFa.mockResolvedValue({ ...userWithSecret, twoFaEnabled: true });

      await service.enableTwoFa(mockUser.id, dto);

      expect(verifySync).toHaveBeenCalledWith({ secret: 'SECRET123', token: '123456' });
      expect(usersService.enableTwoFa).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw if 2FA already enabled', async () => {
      usersService.findByIdOrFail.mockResolvedValue({ ...mockUser, twoFaEnabled: true });

      await expect(service.enableTwoFa(mockUser.id, { code: '123456' })).rejects.toThrow(UnauthorizedException);
    });

    it('should throw if no secret exists', async () => {
      usersService.findByIdOrFail.mockResolvedValue({ ...mockUser, twoFaEnabled: false, twoFaSecret: null });

      await expect(service.enableTwoFa(mockUser.id, { code: '123456' })).rejects.toThrow(UnauthorizedException);
    });

    it('should throw for invalid code', async () => {
      const userWithSecret = { ...mockUser, twoFaEnabled: false, twoFaSecret: 'SECRET123' };
      const { verifySync } = require('otplib');
      verifySync.mockReturnValue({ valid: false });
      usersService.findByIdOrFail.mockResolvedValue(userWithSecret);

      await expect(service.enableTwoFa(mockUser.id, { code: 'wrong' })).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('2FA - disableTwoFa', () => {
    it('should disable 2FA for valid password', async () => {
      const userWith2fa = { ...mockUser, twoFaEnabled: true, twoFaSecret: 'SECRET123' };
      usersService.findByIdOrFail.mockResolvedValue(userWith2fa);
      usersService.validatePassword.mockResolvedValue(true);
      usersService.disableTwoFa.mockResolvedValue({ ...userWith2fa, twoFaEnabled: false, twoFaSecret: null });

      await service.disableTwoFa(mockUser.id, 'password123');

      expect(usersService.validatePassword).toHaveBeenCalledWith(userWith2fa, 'password123');
      expect(usersService.disableTwoFa).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw if 2FA not enabled', async () => {
      usersService.findByIdOrFail.mockResolvedValue({ ...mockUser, twoFaEnabled: false });

      await expect(service.disableTwoFa(mockUser.id, 'password')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw for invalid password', async () => {
      const userWith2fa = { ...mockUser, twoFaEnabled: true };
      usersService.findByIdOrFail.mockResolvedValue(userWith2fa);
      usersService.validatePassword.mockResolvedValue(false);

      await expect(service.disableTwoFa(mockUser.id, 'wrong')).rejects.toThrow(UnauthorizedException);
    });
  });
});