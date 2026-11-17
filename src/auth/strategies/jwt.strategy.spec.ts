import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../../users/users.service';
import { RevokedTokensService } from '../tokens/revoked-tokens.service';
import { ConfigService } from '@nestjs/config';
import { User } from '../../users/user.entity';
import { UserRole } from '../../common/enums/user-role.enum';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usersService: jest.Mocked<UsersService>;
  let revokedTokensService: jest.Mocked<RevokedTokensService>;
  let configService: jest.Mocked<ConfigService>;

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
      findById: jest.fn(),
    };

    const mockRevokedTokensService = {
      isRevoked: jest.fn(),
    };

    const mockConfigService = {
      getOrThrow: jest.fn().mockReturnValue('test-secret'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: UsersService, useValue: mockUsersService },
        { provide: RevokedTokensService, useValue: mockRevokedTokensService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    usersService = module.get(UsersService);
    revokedTokensService = module.get(RevokedTokensService);
    configService = module.get(ConfigService);

    jest.clearAllMocks();
  });

  describe('validate', () => {
    it('should return user for valid payload', async () => {
      const payload = {
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        jti: 'token-jti',
        purpose: 'access',
      };

      revokedTokensService.isRevoked.mockResolvedValue(false);
      usersService.findById.mockResolvedValue(mockUser);

      const result = await strategy.validate(payload);

      expect(revokedTokensService.isRevoked).toHaveBeenCalledWith(payload.jti);
      expect(usersService.findById).toHaveBeenCalledWith(payload.sub);
      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException for 2fa token purpose', async () => {
      const payload = {
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        jti: 'token-jti',
        purpose: '2fa',
      };

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
      expect(revokedTokensService.isRevoked).not.toHaveBeenCalled();
      expect(usersService.findById).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for revoked token', async () => {
      const payload = {
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        jti: 'revoked-jti',
        purpose: 'access',
      };

      revokedTokensService.isRevoked.mockResolvedValue(true);

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
      expect(revokedTokensService.isRevoked).toHaveBeenCalledWith(payload.jti);
      expect(usersService.findById).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when user not found', async () => {
      const payload = {
        sub: 'nonexistent-id',
        email: 'test@example.com',
        role: 'USER',
        jti: 'token-jti',
        purpose: 'access',
      };

      revokedTokensService.isRevoked.mockResolvedValue(false);
      usersService.findById.mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
      expect(usersService.findById).toHaveBeenCalledWith(payload.sub);
    });
  });
});