import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { CommentStatus, Label } from '../moderation/moderation.types';

@Entity('comments')
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column('text')
  text: string;

  @Column({ type: 'enum', enum: CommentStatus, default: CommentStatus.PENDING_REVIEW })
  status: CommentStatus;

  @Column({ type: 'enum', enum: Label, nullable: true })
  label: Label;

  @Column('float', { nullable: true })
  confidence: number;

  @Column('text', { nullable: true })
  reason: string;

  @Column({ nullable: true })
  reviewedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}