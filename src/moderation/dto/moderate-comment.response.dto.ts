import { ApiProperty } from '@nestjs/swagger';
import { CommentStatus, Label } from '../moderation.types';

export class ModerateCommentResponseDto {
  @ApiProperty({ example: 'uuid-v4-string' })
  id: string;

  @ApiProperty({ example: 'Este es un comentario de prueba' })
  text: string;

  @ApiProperty({ enum: CommentStatus, example: CommentStatus.PUBLISHED })
  status: CommentStatus;

  @ApiProperty({ enum: Label, example: Label.LEGIT })
  label: Label;

  @ApiProperty({ example: 0.95 })
  confidence: number;

  @ApiProperty({ example: 'Contenido legítimo' })
  reason: string;

  @ApiProperty({ example: 'uuid-moderator-id' })
  reviewedBy: string;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-01-15T10:35:00.000Z' })
  updatedAt: Date;
}