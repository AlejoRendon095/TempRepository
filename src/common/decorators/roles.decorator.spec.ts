import { SetMetadata } from '@nestjs/common';
import { Roles, ROLES_KEY } from './roles.decorator';
import { UserRole } from '../enums/user-role.enum';

jest.mock('@nestjs/common', () => ({
  SetMetadata: jest.fn(),
}));

describe('Roles decorator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call SetMetadata with correct key and roles', () => {
    const roles = [UserRole.ADMIN, UserRole.MODERATOR];

    Roles(...roles);

    expect(SetMetadata).toHaveBeenCalledWith(ROLES_KEY, roles);
  });

  it('should handle single role', () => {
    Roles(UserRole.USER);

    expect(SetMetadata).toHaveBeenCalledWith(ROLES_KEY, [UserRole.USER]);
  });

  it('should handle empty roles array', () => {
    Roles();

    expect(SetMetadata).toHaveBeenCalledWith(ROLES_KEY, []);
  });

  it('should export ROLES_KEY constant', () => {
    expect(ROLES_KEY).toBe('roles');
  });
});