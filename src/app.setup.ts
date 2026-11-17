import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';

/**
 * Configuración global de la app. Se comparte entre main.ts y las pruebas e2e
 * para que ambas se comporten igual.
 */
export function configureApp(app: NestExpressApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Detrás de un proxy (nginx, load balancer) req.ip sería la IP del proxy y
  // el rate limiting trataría a todos los usuarios como uno solo.
  // TRUST_PROXY=1 confía en el primer proxy y lee la IP real de X-Forwarded-For.
  const trustProxy = app.get(ConfigService).get<string | number>('TRUST_PROXY');
  if (trustProxy) {
    const hops = Number(trustProxy);
    app.set('trust proxy', Number.isNaN(hops) ? trustProxy : hops);
  }

  // Swagger /docs
  const config = new DocumentBuilder()
    .setTitle('Moderation API')
    .setDescription('API para moderación de comentarios con autenticación JWT y 2FA')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT-auth',
    )
    .addTag('auth', 'Autenticación y 2FA')
    .addTag('users', 'Gestión de usuarios')
    .addTag('comments', 'Comentarios públicos')
    .addTag('moderation', 'Moderación (MODERATOR/ADMIN)')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}
