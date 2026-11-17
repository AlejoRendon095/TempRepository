import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { UsersService, CreateUserDto } from './users.service';
import { User } from './user.entity';
import { UserRole } from '../common/enums/user-role.enum';

jest.mock('bcrypt');

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: jest.Mocked<Repository<User>>;
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
    const mockUserRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: 'UserRepository', useValue: mockUserRepository },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepository = module.get('UserRepository');
    configService = module.get(ConfigService);

    jest.clearAllMocks();

    configService.get.mockReturnValue('10');
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
  });

  describe('create', () => {
    it('should create a new user with hashed password', async () => {
      const dto: CreateUserDto = { email: 'new@example.com', password: 'Password123!', role: UserRole.USER };
      const createdUser = { ...mockUser, id: 'new-id', email: dto.email, role: dto.role };

      userRepository.findOne.mockResolvedValue(null);
      userRepository.create.mockReturnValue(createdUser);
      userRepository.save.mockResolvedValue(createdUser);

      const result = await service.create(dto);

      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { email: dto.email } });
      expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, 10);
      expect(userRepository.create).toHaveBeenCalledWith({
        email: dto.email,
        passwordHash: 'hashed-password',
        role: dto.role,
        twoFaEnabled: false,
      });
      expect(userRepository.save).toHaveBeenCalledWith(createdUser);
      expect(result).toEqual(createdUser);
    });

    it('should create user with default role USER when not provided', async () => {
      const dto: CreateUserDto = { email: 'new@example.com', password: 'Password123!' };
      const createdUser = { ...mockUser, id: 'new-id', email: dto.email, role: UserRole.USER };

      userRepository.findOne.mockResolvedValue(null);
      userRepository.create.mockReturnValue(createdUser);
      userRepository.save.mockResolvedValue(createdUser);

      const result = await service.create(dto);

      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.USER })
      );
      expect(result.role).toBe(UserRole.USER);
    });

    it('should throw ConflictException when email already exists', async () => {
      const dto: CreateUserDto = { email: 'existing@example.com', password: 'Password123!' };

      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { email: dto.email } });
      expect(userRepository.create).not.toHaveBeenCalled();
      expect(userRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('findByEmail', () => {
    it('should return user when found', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findById('user-123');

      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: 'user-123' } });
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.findById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByIdOrFail', () => {
    it('should return user when found', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByIdOrFail('user-123');

      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.findByIdOrFail('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('validatePassword', () => {
    it('should return true for valid password', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validatePassword(mockUser, 'Password123!');

      expect(bcrypt.compare).toHaveBeenCalledWith('Password123!', mockUser.passwordHash);
      expect(result).toBe(true);
    });

    it('should return false for invalid password', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validatePassword(mockUser, 'WrongPassword!');

      expect(result).toBe(false);
    });
  });

  describe('updateRole', () => {
    it('should update user role and save', async () => {
      const updatedUser = { ...mockUser, role: UserRole.ADMIN };

      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue(updatedUser);

      const result = await service.updateRole('user-123', UserRole.ADMIN);

      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: 'user-123' } });
      expect(mockUser.role).toBe(UserRole.ADMIN);
      expect(userRepository.save).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual(updatedUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.updateRole('nonexistent-id', UserRole.ADMIN)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateTwoFaSecret', () => {
    it('should update user 2FA secret and save', async () => {
      const updatedUser = { ...mockUser, twoFaSecret: 'NEW_SECRET' };

      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue(updatedUser);

      const result = await service.updateTwoFaSecret('user-123', 'NEW_SECRET');

      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: 'user-123' } });
      expect(mockUser.twoFaSecret).toBe('NEW_SECRET');
      expect(userRepository.save).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual(updatedUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.updateTwoFaSecret('nonexistent-id', 'SECRET')).rejects.toThrow(NotFoundException);
    });
  });

  describe('enableTwoFa', () => {
    it('should enable 2FA and save', async () => {
      const updatedUser = { ...mockUser, twoFaEnabled: true };

      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue(updatedUser);

      const result = await service.enableTwoFa('user-123');

      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: 'user-123' } });
      expect(mockUser.twoFaEnabled).toBe(true);
      expect(userRepository.save).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual(updatedUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.enableTwoFa('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('disableTwoFa', () => {
    it('should disable 2FA, clear secret, and save', async () => {
      const userWith2fa = { ...mockUser, twoFaEnabled: true, twoFaSecret: 'SECRET' };
      const updatedUser = { ...userWith2fa, twoFaEnabled: false, twoFaSecret: null };

      userRepository.findOne.mockResolvedValue(userWith2fa);
      userRepository.save.mockResolvedValue(updatedUser);

      const result = await service.disableTwoFa('user-123');

      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: 'user-123' } });
      expect(userWith2fa.twoFaEnabled).toBe(false);
      expect(userWith2fa.twoFaSecret).toBeNull();
      expect(userRepository.save).toHaveBeenCalledWith(userWith2fa);
      expect(result).toEqual(updatedUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.disableTwoFa('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });
});