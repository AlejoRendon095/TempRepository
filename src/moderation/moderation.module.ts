import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModerationDecisionService } from './moderation-decision.service';
import { ModerationService } from './moderation.service';
import { ModerationController } from './moderation.controller';
import { Comment } from '../comments/comment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Comment])],
  controllers: [ModerationController],
  providers: [ModerationService, ModerationDecisionService],
  exports: [ModerationDecisionService], 
})
export class ModerationModule {}