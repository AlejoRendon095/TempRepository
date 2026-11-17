import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { User } from './user.entity';
import { UserRole } from '../common/enums/user-role.enum';

export interface CreateUserDto {
  email: string;
  password: string;
  role?: UserRole;
}

export interface UpdateUserRoleDto {
  role: UserRole;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.userRepository.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email ya registrado');
    }

    const rounds = Number(this.configService.get('BCRYPT_ROUNDS', 12));
    const passwordHash = await bcrypt.hash(dto.password, rounds);

    const user = this.userRepository.create({
      email: dto.email,
      passwordHash,
      role: dto.role ?? UserRole.USER,
      twoFaEnabled: false,
    });

    return this.userRepository.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findByIdOrFail(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return user;
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }

  async updateRole(id: string, role: UserRole): Promise<User> {
    const user = await this.findByIdOrFail(id);
    user.role = role;
    return this.userRepository.save(user);
  }

  async updateTwoFaSecret(id: string, secret: string): Promise<User> {
    const user = await this.findByIdOrFail(id);
    user.twoFaSecret = secret;
    return this.userRepository.save(user);
  }

  async enableTwoFa(id: string): Promise<User> {
    const user = await this.findByIdOrFail(id);
    user.twoFaEnabled = true;
    return this.userRepository.save(user);
  }

  async disableTwoFa(id: string): Promise<User> {
    const user = await this.findByIdOrFail(id);
    user.twoFaSecret = null;
    user.twoFaEnabled = false;
    return this.userRepository.save(user);
  }
}