import { ExecutionContext } from '@nestjs/common';
import { User } from '../../users/user.entity';
import { UserRole } from '../enums/user-role.enum';

function extractCurrentUser(ctx: ExecutionContext): User | null | undefined {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
}

describe('CurrentUser decorator logic', () => {
  const createMockContext = (user: User | null): ExecutionContext => ({
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext);

  it('should return user from request', () => {
    const mockUser: User = {
      id: 'user-123',
      email: 'test@example.com',
      passwordHash: 'hash',
      role: UserRole.USER,
      twoFaSecret: null,
      twoFaEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const context = createMockContext(mockUser);
    const result = extractCurrentUser(context);

    expect(result).toEqual(mockUser);
  });

  it('should return null when no user in request', () => {
    const context = createMockContext(null);
    const result = extractCurrentUser(context);

    expect(result).toBeNull();
  });

  it('should return undefined when request has no user property', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as unknown as ExecutionContext;

    const result = extractCurrentUser(context);

    expect(result).toBeUndefined();
  });
});