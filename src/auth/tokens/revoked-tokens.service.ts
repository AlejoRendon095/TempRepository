import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { RevokedToken } from './revoked-token.entity';

@Injectable()
export class RevokedTokensService {
  constructor(
    @InjectRepository(RevokedToken)
    private readonly revokedTokenRepository: Repository<RevokedToken>,
  ) {}

  async revoke(jti: string, userId: string, expiresAt: Date): Promise<void> {
    const revokedToken = this.revokedTokenRepository.create({
      jti,
      userId,
      expiresAt,
    });
    await this.revokedTokenRepository.save(revokedToken);
  }

  async isRevoked(jti: string): Promise<boolean> {
    const token = await this.revokedTokenRepository.findOne({ where: { jti } });
    return !!token;
  }

  async cleanExpired(): Promise<number> {
    const result = await this.revokedTokenRepository.delete({
      expiresAt: LessThan(new Date()),
    });
    return result.affected ?? 0;
  }
}