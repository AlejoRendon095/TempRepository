import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from '../src/app.setup';
import { Comment } from '../src/comments/comment.entity';
import { CommentsModule } from '../src/comments/comments.module';
import { ModerationModule } from '../src/moderation/moderation.module';
import { RateLimitModule } from '../src/common/rate-limit/rate-limit.module';
import { AuthModule } from '../src/auth/auth.module';
import { UsersModule } from '../src/users/users.module';
import { RevokedToken } from '../src/auth/tokens/revoked-token.entity';
import { InMemoryCommentRepository } from './in-memory-comment.repository';
import { InMemoryUserRepository } from './in-memory-user.repository';
import { InMemoryRevokedTokenRepository } from './in-memory-revoked-token.repository';
import { User } from '../src/users/user.entity';
import { UserRole } from '../src/common/enums/user-role.enum';
import * as bcrypt from 'bcrypt';

const THROTTLE_LIMIT = 5;
const TEST_USER_EMAIL = 'test@test.com';
const TEST_USER_PASSWORD = 'Password123!';
const MODERATOR_EMAIL = 'mod@test.com';
const MODERATOR_PASSWORD = 'Password123!';
const ADMIN_EMAIL = 'admin@test.com';
const ADMIN_PASSWORD = 'Password123!';

// Ejemplos alineados con las reglas de RulesClassifier.
const LEGIT_TEXT = 'El pedido llegó a tiempo y la atención fue excelente.';
const SPAM_TEXT = 'Mira esta promo https://bit.ly/abc123';
const AMBIGUOUS_TEXT = 'ESTE ES EL MEJOR LUGAR DEL MUNDO!!!!';

describe('Moderation API (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let accessToken: string;
  let moderatorToken: string;
  let adminToken: string;

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          ignoreEnvVars: true,
          load: [
            () => ({
              CLASSIFIER_MODE: 'rules',
              THROTTLE_LIMIT,
              THROTTLE_TTL: 60,
              TRUST_PROXY: 1,
              JWT_SECRET: 'test-secret-key-for-testing-only-32chars!!',
              JWT_ACCESS_TTL: 900,
              JWT_REFRESH_TTL: 604800,
              BCRYPT_ROUNDS: 12,
            }),
          ],
        }),
        RateLimitModule,
        AuthModule,
        UsersModule,
        CommentsModule,
        ModerationModule,
      ],
    })
      .overrideProvider(getRepositoryToken(Comment))
      .useValue(new InMemoryCommentRepository())
      .overrideProvider(getRepositoryToken(User))
      .useValue(InMemoryUserRepository)
      .overrideProvider(getRepositoryToken(RevokedToken))
      .useValue(InMemoryRevokedTokenRepository)
      .compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    server = app.getHttpServer();

    await InMemoryUserRepository.clear();
    await InMemoryRevokedTokenRepository.clear();

    // Create test users
    const passwordHash = await bcrypt.hash(TEST_USER_PASSWORD, 12);
    InMemoryUserRepository.create({
      email: TEST_USER_EMAIL,
      passwordHash,
      role: UserRole.USER,
      twoFaEnabled: false,
    });

    const modPasswordHash = await bcrypt.hash(MODERATOR_PASSWORD, 12);
    InMemoryUserRepository.create({
      email: MODERATOR_EMAIL,
      passwordHash: modPasswordHash,
      role: UserRole.MODERATOR,
      twoFaEnabled: false,
    });

    const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    InMemoryUserRepository.create({
      email: ADMIN_EMAIL,
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      twoFaEnabled: false,
    });

    // Login to get tokens
    const userLogin = await request(server)
      .post('/auth/login')
      .send({ email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD })
      .expect(200);
    accessToken = userLogin.body.accessToken;

    const modLogin = await request(server)
      .post('/auth/login')
      .send({ email: MODERATOR_EMAIL, password: MODERATOR_PASSWORD })
      .expect(200);
    moderatorToken = modLogin.body.accessToken;

    const adminLogin = await request(server)
      .post('/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200);
    adminToken = adminLogin.body.accessToken;
  });

  afterEach(async () => {
    await app.close();
  });

  const postComment = (text: string, token = accessToken) =>
    request(server).post('/comments').set('Authorization', `Bearer ${token}`).send({ text });

  it('texto legítimo → 201 y aparece en GET /comments', async () => {
    const res = await postComment(LEGIT_TEXT).expect(201);

    expect(res.body).toEqual({
      id: expect.any(String),
      text: LEGIT_TEXT,
      createdAt: expect.any(String),
    });

    const list = await request(server).get('/comments').expect(200);
    expect(list.body.map((c: Comment) => c.text)).toEqual([LEGIT_TEXT]);
  });

  it('spam evidente → 422 y no aparece en GET /comments', async () => {
    const res = await postComment(SPAM_TEXT).expect(422);
    expect(res.body.message).toContain('spam');

    const list = await request(server).get('/comments').expect(200);
    expect(list.body).toEqual([]);
  });

  it('texto ambiguo → 202 y aparece en /moderation/pending', async () => {
    const res = await postComment(AMBIGUOUS_TEXT).expect(202);
    expect(res.body).toEqual({ message: 'Tu comentario está en revisión' });

    const pending = await request(server)
      .get('/moderation/pending')
      .set('Authorization', `Bearer ${moderatorToken}`)
      .expect(200);

    expect(pending.body).toHaveLength(1);
    expect(pending.body[0]).toMatchObject({
      text: AMBIGUOUS_TEXT,
      status: 'PENDING_REVIEW',
      label: 'SPAM',
    });
    expect(pending.body[0].reason).toBeTruthy();
  });

  it('aprobar un comentario en revisión lo publica; aprobarlo otra vez → 409', async () => {
    await postComment(AMBIGUOUS_TEXT).expect(202);
    const pending = await request(server)
      .get('/moderation/pending')
      .set('Authorization', `Bearer ${moderatorToken}`);
    const id = pending.body[0].id;

    await request(server)
      .patch(`/moderation/${id}/approve`)
      .set('Authorization', `Bearer ${moderatorToken}`)
      .expect(200);

    const list = await request(server).get('/comments').expect(200);
    expect(list.body.map((c: Comment) => c.id)).toEqual([id]);

    await request(server)
      .patch(`/moderation/${id}/reject`)
      .set('Authorization', `Bearer ${moderatorToken}`)
      .expect(409);
  });

  it('endpoints de moderación sin token → 401', async () => {
    await request(server).get('/moderation/pending').expect(401);
    await request(server)
      .get('/moderation/pending')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });

  it('usuario normal no puede acceder a moderación → 403', async () => {
    await request(server)
      .get('/moderation/pending')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
  });

  it('payload inválido → 400', async () => {
    await request(server)
      .post('/comments')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ text: '' })
      .expect(400);
  });

  it('comentario sin autenticación → 401', async () => {
    await request(server)
      .post('/comments')
      .send({ text: 'test' })
      .expect(401);
  });

  it('ráfaga de peticiones → 429 con Retry-After', async () => {
    for (let i = 0; i < THROTTLE_LIMIT; i++) {
      await postComment(`${LEGIT_TEXT} #${i}`).expect(201);
    }

    const res = await postComment(LEGIT_TEXT).expect(429);
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('el límite por usuario se aplica aunque cambie la IP', async () => {
    for (let i = 0; i < THROTTLE_LIMIT; i++) {
      await postComment(`${LEGIT_TEXT} #${i}`)
        .set('X-Forwarded-For', `10.0.0.${i}`)
        .expect(201);
    }

    await postComment(LEGIT_TEXT)
      .set('X-Forwarded-For', '10.0.0.99')
      .expect(429);
  });
});