import { Comment } from '../comment.entity';

export class CommentResponseDto {
  readonly id: string;
  readonly text: string;
  readonly createdAt: Date;

  constructor(comment: Comment) {
    this.id = comment.id;
    this.text = comment.text;
    this.createdAt = comment.createdAt;
  }
}
