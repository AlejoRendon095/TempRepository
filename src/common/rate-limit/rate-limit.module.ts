import { ExecutionContext, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { seconds, ThrottlerModule } from '@nestjs/throttler';
import { AppThrottlerGuard } from './app-throttler.guard';

// Los envíos de comentarios son POST /comments
const isCommentSubmission = (context: ExecutionContext): boolean => {
  const request = context.switchToHttp().getRequest();
  return request.method === 'POST' && request.url === '/comments';
};

// Decodifica JWT sin verificar (solo para extraer sub para rate limiting)
const extractUserIdFromToken = (request: any): string | undefined => {
  const authHeader = request.headers?.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return undefined;

  const token = authHeader.slice(7);
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return undefined;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf-8');
    const payload = JSON.parse(jsonPayload);
    return payload.sub;
  } catch {
    return undefined;
  }
};

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const submitTtl = seconds(Number(config.get('THROTTLE_TTL', 60)));
        const submitLimit = Number(config.get('THROTTLE_LIMIT', 10));

        return {
          throttlers: [
            // Global por IP, permisivo: aplica a todas las rutas.
            {
              name: 'default',
              ttl: seconds(60),
              limit: Number(config.get('THROTTLE_GLOBAL_LIMIT', 60)),
            },
            // Envíos de comentarios por IP: frena ráfagas desde una misma máquina.
            {
              name: 'submit-ip',
              ttl: submitTtl,
              limit: submitLimit,
              skipIf: (context) => !isCommentSubmission(context),
            },
            // Envíos por userId: un bot no evade el límite rotando de IP.
            {
              name: 'submit-user',
              ttl: submitTtl,
              limit: submitLimit,
              skipIf: (context) => !isCommentSubmission(context),
              getTracker: (req) => {
                const userId = extractUserIdFromToken(req);
                return userId ? `user:${userId}` : req.ip;
              },
            },
          ],
        };
      },
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
})
export class RateLimitModule {}
