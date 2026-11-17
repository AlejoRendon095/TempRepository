import { Repository, FindOptionsWhere } from 'typeorm';
import { RevokedToken } from '../src/auth/tokens/revoked-token.entity';

const revokedTokens = new Map<string, RevokedToken>();

function createRevokedToken(partial: Partial<RevokedToken>): RevokedToken {
  const token = new RevokedToken();
  Object.assign(token, {
    id: partial.id ?? crypto.randomUUID(),
    jti: partial.jti,
    userId: partial.userId,
    expiresAt: partial.expiresAt ?? new Date(Date.now() + 3600000),
    createdAt: partial.createdAt ?? new Date(),
  });
  revokedTokens.set(token.jti, token);
  return token;
}

function findByJti(jti: string): RevokedToken | undefined {
  return revokedTokens.get(jti);
}

function clear() {
  revokedTokens.clear();
}

export const InMemoryRevokedTokenRepository = {
  clear,
  create: createRevokedToken,
  findOne: ({ where }: { where: FindOptionsWhere<RevokedToken> }) => {
    if (where && typeof where === 'object' && 'jti' in where) {
      return Promise.resolve(findByJti(where.jti as string));
    }
    return Promise.resolve(undefined);
  },
  find: () => Promise.resolve(Array.from(revokedTokens.values())),
  save: (token: RevokedToken) => Promise.resolve(token),
  delete: () => Promise.resolve({ affected: 0, raw: [] }),
} as unknown as Repository<RevokedToken>;

export { createRevokedToken, findByJti, clear, revokedTokens };