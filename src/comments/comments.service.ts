import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from './comment.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import {
  TEXT_CLASSIFIER,
  Label,
  CommentStatus,
  type TextClassifier,
} from '../moderation/moderation.types';
import { ModerationDecisionService } from '../moderation/moderation-decision.service';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @Inject(TEXT_CLASSIFIER)
    private readonly classifier: TextClassifier,
    private readonly decisionService: ModerationDecisionService,
  ) {}

  async create(createCommentDto: CreateCommentDto, userId: string): Promise<Comment> {
    let classificationResult;

    try {
      classificationResult = await this.classifier.classify(createCommentDto.text);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error en el clasificador: ${message}`);
      classificationResult = {
        label: Label.SPAM,
        confidence: 0,
        reason: 'Fallo del clasificador',
      };
    }

    const status = this.decisionService.decide(classificationResult);

    const comment = this.commentRepository.create({
      text: createCommentDto.text,
      userId,
      status,
      label: classificationResult.label,
      confidence: classificationResult.confidence,
      reason: classificationResult.reason,
    });

    return this.commentRepository.save(comment);
  }

  async findAllPublished(page: number = 1, limit: number = 20): Promise<Comment[]> {
    return this.commentRepository.find({
      where: { status: CommentStatus.PUBLISHED },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }
}