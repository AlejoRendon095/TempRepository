import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../enums/user-role.enum';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  const createMockContext = (user: any = null): ExecutionContext => ({
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
  } as unknown as ExecutionContext);

  beforeEach(async () => {
    const mockReflector = {
      getAllAndOverride: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        { provide: Reflector, useValue: mockReflector },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get(Reflector);

    jest.clearAllMocks();
  });

  it('should allow access when no roles required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const context = createMockContext({ id: 'user-1', role: UserRole.USER });
    const result = guard.canActivate(context);

    expect(result).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [context.getHandler(), context.getClass()]);
  });

  it('should allow access when required roles array is empty', () => {
    reflector.getAllAndOverride.mockReturnValue([]);

    const context = createMockContext({ id: 'user-1', role: UserRole.USER });
    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should allow access when user has required role', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN, UserRole.MODERATOR]);

    const context = createMockContext({ id: 'user-1', role: UserRole.MODERATOR });
    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should allow access when user has one of multiple required roles', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    const context = createMockContext({ id: 'user-1', role: UserRole.ADMIN });
    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should throw ForbiddenException when user has no role', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    const context = createMockContext({ id: 'user-1' });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow('No se pudo determinar el rol del usuario');
  });

  it('should throw ForbiddenException when user is null', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    const context = createMockContext(null);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow('No se pudo determinar el rol del usuario');
  });

  it('should throw ForbiddenException when user role not in required roles', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN, UserRole.MODERATOR]);

    const context = createMockContext({ id: 'user-1', role: UserRole.USER });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow('Se requiere uno de los roles: ADMIN, MODERATOR');
  });

  it('should throw ForbiddenException when user role is null', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    const context = createMockContext({ id: 'user-1', role: null });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});