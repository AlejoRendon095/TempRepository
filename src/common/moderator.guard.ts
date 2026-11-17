import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ModeratorGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    const validKey = this.configService.get<string>('MODERATOR_API_KEY');

    if (!apiKey || apiKey !== validKey) {
      throw new UnauthorizedException('API Key de moderador inválida o ausente');
    }
    
    return true;
  }
}