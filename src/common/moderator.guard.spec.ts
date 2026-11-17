import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModeratorGuard } from './moderator.guard';

describe('ModeratorGuard', () => {
  let guard: ModeratorGuard;
  let mockConfigService: Partial<ConfigService>;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn().mockReturnValue('super-secreto'),
    };
    guard = new ModeratorGuard(mockConfigService as ConfigService);
  });

  const createMockContext = (apiKey?: string) => ({
    switchToHttp: () => ({
      getRequest: () => ({
        headers: apiKey ? { 'x-api-key': apiKey } : {},
      }),
    }),
  } as any);

  it('debe permitir el acceso si la api key es correcta', () => {
    const context = createMockContext('super-secreto');
    expect(guard.canActivate(context)).toBe(true);
  });

  it('debe lanzar UnauthorizedException si la api key es incorrecta', () => {
    const context = createMockContext('clave-falsa');
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('debe lanzar UnauthorizedException si no se envía el header', () => {
    const context = createMockContext();
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});