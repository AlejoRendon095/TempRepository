import { randomUUID } from 'node:crypto';
import { Comment } from '../src/comments/comment.entity';

/**
 * Sustituto en memoria del Repository<Comment> de TypeORM con solo los métodos
 * que usan CommentsService y ModerationService. Permite correr los e2e sin
 * levantar PostgreSQL.
 */
export class InMemoryCommentRepository {
  private comments: Comment[] = [];

  create(data: Partial<Comment>): Comment {
    return Object.assign(new Comment(), data);
  }

  async save(comment: Comment): Promise<Comment> {
    const now = new Date();
    const saved = Object.assign(new Comment(), comment, {
      id: comment.id ?? randomUUID(),
      createdAt: comment.createdAt ?? now,
      updatedAt: now,
    });
    this.comments = this.comments.filter((c) => c.id !== saved.id);
    this.comments.push(saved);
    return saved;
  }

  async find(options: {
    where: Partial<Comment>;
    order?: { createdAt?: 'ASC' | 'DESC' };
    skip?: number;
    take?: number;
  }): Promise<Comment[]> {
    const direction = options.order?.createdAt === 'DESC' ? -1 : 1;
    const skip = options.skip ?? 0;

    return this.comments
      .filter((c) => this.matches(c, options.where))
      .sort((a, b) => direction * (a.createdAt.getTime() - b.createdAt.getTime()))
      .slice(skip, skip + (options.take ?? this.comments.length));
  }

  async findOne(options: { where: Partial<Comment> }): Promise<Comment | null> {
    return this.comments.find((c) => this.matches(c, options.where)) ?? null;
  }

  async update(
    where: Partial<Comment>,
    changes: Partial<Comment>,
  ): Promise<{ affected: number }> {
    const targets = this.comments.filter((c) => this.matches(c, where));
    targets.forEach((c) => Object.assign(c, changes, { updatedAt: new Date() }));
    return { affected: targets.length };
  }

  private matches(comment: Comment, where: Partial<Comment>): boolean {
    return Object.entries(where).every(
      ([key, value]) => comment[key as keyof Comment] === value,
    );
  }
}
