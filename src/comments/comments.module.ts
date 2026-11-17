import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { Comment } from './comment.entity';
import { ModerationModule } from '../moderation/moderation.module';
import { ClassifierModule } from '../classifier/classifier.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Comment]),
    ModerationModule,
    ClassifierModule,
  ],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}