import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { User } from '../../users/user.entity';
import { RevokedTokensService } from '../tokens/revoked-tokens.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  jti: string;
  purpose?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly revokedTokensService: RevokedTokensService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    if (payload.purpose === '2fa') {
      throw new UnauthorizedException('Token 2FA no válido para esta ruta');
    }

    const isRevoked = await this.revokedTokensService.isRevoked(payload.jti);
    if (isRevoked) {
      throw new UnauthorizedException('Token revocado');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    return user;
  }
}