import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClassificationResult, CommentStatus, Label } from './moderation.types';

@Injectable()
export class ModerationDecisionService {
  constructor(private readonly configService: ConfigService) {}

  decide(result: ClassificationResult): CommentStatus {
    const blockThreshold = this.configService.get<number>('BLOCK_THRESHOLD', 0.85);
    const publishThreshold = this.configService.get<number>('PUBLISH_THRESHOLD', 0.85);

    if ((result.label === Label.SPAM || result.label === Label.FRAUD) && result.confidence >= blockThreshold) {
      return CommentStatus.BLOCKED;
    }

    if (result.label === Label.LEGIT && result.confidence >= publishThreshold) {
      return CommentStatus.PUBLISHED;
    }

    return CommentStatus.PENDING_REVIEW;
  }
}