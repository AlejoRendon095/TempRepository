import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from '../comments/comment.entity';
import { CommentStatus } from './moderation.types';

@Injectable()
export class ModerationService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
  ) {}

  async findPending(page: number = 1, limit: number = 20): Promise<Comment[]> {
    return this.commentRepository.find({
      where: { status: CommentStatus.PENDING_REVIEW },
      order: { createdAt: 'ASC' }, // Los más antiguos primero (FIFO)
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async moderateComment(id: string, status: CommentStatus, moderatorId: string): Promise<Comment> {
    const result = await this.commentRepository.update(
      { id, status: CommentStatus.PENDING_REVIEW },
      { status, reviewedBy: moderatorId },
    );

    if (!result.affected) {
      const comment = await this.commentRepository.findOne({ where: { id } });

      if (!comment) {
        throw new NotFoundException(`Comentario con id ${id} no encontrado`);
      }

      throw new ConflictException(
        `El comentario ya fue procesado. Estado actual: ${comment.status}`,
      );
    }

    const updatedComment = await this.commentRepository.findOne({ where: { id } });

    if (!updatedComment) {
      throw new NotFoundException(`Comentario con id ${id} no encontrado`);
    }

    return updatedComment;
  }
}