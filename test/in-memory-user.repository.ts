import { Repository, FindOptionsWhere } from 'typeorm';
import { User } from '../src/users/user.entity';
import { UserRole } from '../src/common/enums/user-role.enum';

const users = new Map<string, User>();

function createUser(partial: Partial<User>): User {
  const user = new User();
  Object.assign(user, {
    id: partial.id ?? crypto.randomUUID(),
    email: partial.email,
    passwordHash: partial.passwordHash,
    role: partial.role ?? UserRole.USER,
    twoFaSecret: partial.twoFaSecret ?? null,
    twoFaEnabled: partial.twoFaEnabled ?? false,
    createdAt: partial.createdAt ?? new Date(),
    updatedAt: partial.updatedAt ?? new Date(),
  });
  users.set(user.email, user);
  return user;
}

function findByEmail(email: string): User | undefined {
  return users.get(email);
}

function findById(id: string): User | undefined {
  for (const user of users.values()) {
    if (user.id === id) return user;
  }
  return undefined;
}

function save(user: User): User {
  user.updatedAt = new Date();
  users.set(user.email, user);
  return user;
}

function clear() {
  users.clear();
}

export const InMemoryUserRepository = {
  clear,
  create: createUser,
  findOne: ({ where }: { where: FindOptionsWhere<User> }) => {
    if (where && typeof where === 'object') {
      if ('email' in where) return Promise.resolve(findByEmail(where.email as string));
      if ('id' in where) return Promise.resolve(findById(where.id as string));
    }
    return Promise.resolve(undefined);
  },
  find: ({ where }: { where?: FindOptionsWhere<User> }) => {
    if (where && typeof where === 'object') {
      if ('email' in where) {
        const u = findByEmail(where.email as string);
        return Promise.resolve(u ? [u] : []);
      }
      if ('id' in where) {
        const u = findById(where.id as string);
        return Promise.resolve(u ? [u] : []);
      }
    }
    return Promise.resolve(Array.from(users.values()));
  },
  save: (user: User) => Promise.resolve(save(user)),
  delete: () => Promise.resolve({ affected: 0, raw: [] }),
} as unknown as Repository<User>;

export { createUser, findByEmail, findById, save, clear, users };