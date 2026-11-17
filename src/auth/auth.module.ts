import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { RevokedToken } from './tokens/revoked-token.entity';
import { RevokedTokensService } from './tokens/revoked-tokens.service';

@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: { algorithm: 'HS256' },
      }),
    }),
    TypeOrmModule.forFeature([RevokedToken]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RevokedTokensService],
  exports: [AuthService, JwtStrategy, RevokedTokensService],
})
export class AuthModule {}