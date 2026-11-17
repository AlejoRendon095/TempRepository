import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RevokedTokensService } from './revoked-tokens.service';
import { RevokedToken } from './revoked-token.entity';
import { LessThan } from 'typeorm';

describe('RevokedTokensService', () => {
  let service: RevokedTokensService;
  let repositoryMock: any;

  beforeEach(async () => {
    repositoryMock = {
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockResolvedValue({}),
      findOne: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue({ affected: 5 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RevokedTokensService,
        { provide: getRepositoryToken(RevokedToken), useValue: repositoryMock },
      ],
    }).compile();

    service = module.get<RevokedTokensService>(RevokedTokensService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('revoke', () => {
    it('should create and save revoked token', async () => {
      const jti = 'token-jti-123';
      const userId = 'user-456';
      const expiresAt = new Date(Date.now() + 3600000);

      await service.revoke(jti, userId, expiresAt);

      expect(repositoryMock.create).toHaveBeenCalledWith({
        jti,
        userId,
        expiresAt,
      });
      expect(repositoryMock.save).toHaveBeenCalledWith({
        jti,
        userId,
        expiresAt,
      });
    });
  });

  describe('isRevoked', () => {
    it('should return true when token is revoked', async () => {
      const revokedToken = { jti: 'revoked-jti', userId: 'user-1', expiresAt: new Date() };
      repositoryMock.findOne.mockResolvedValue(revokedToken);

      const result = await service.isRevoked('revoked-jti');

      expect(repositoryMock.findOne).toHaveBeenCalledWith({ where: { jti: 'revoked-jti' } });
      expect(result).toBe(true);
    });

    it('should return false when token is not revoked', async () => {
      repositoryMock.findOne.mockResolvedValue(null);

      const result = await service.isRevoked('valid-jti');

      expect(result).toBe(false);
    });
  });

  describe('cleanExpired', () => {
    it('should delete expired tokens and return count', async () => {
      repositoryMock.delete.mockResolvedValue({ affected: 10 });

      const result = await service.cleanExpired();

      expect(repositoryMock.delete).toHaveBeenCalledWith({
        expiresAt: expect.any(Object), // LessThan(new Date())
      });
      expect(result).toBe(10);
    });

    it('should return 0 when no tokens deleted', async () => {
      repositoryMock.delete.mockResolvedValue({ affected: 0 });

      const result = await service.cleanExpired();

      expect(result).toBe(0);
    });

    it('should handle undefined affected', async () => {
      repositoryMock.delete.mockResolvedValue({ affected: undefined });

      const result = await service.cleanExpired();

      expect(result).toBe(0);
    });
  });
});