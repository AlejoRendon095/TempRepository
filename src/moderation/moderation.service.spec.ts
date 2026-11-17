import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { Comment } from '../comments/comment.entity';
import { CommentStatus } from './moderation.types';

describe('ModerationService', () => {
  let service: ModerationService;
  let repositoryMock: any;

  beforeEach(async () => {
    repositoryMock = {
      find: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      findOne: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModerationService,
        { provide: getRepositoryToken(Comment), useValue: repositoryMock },
      ],
    }).compile();

    service = module.get<ModerationService>(ModerationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findPending', () => {
    it('should return pending comments with pagination', async () => {
      const comments = [
        { id: '1', text: 'Comment 1', status: CommentStatus.PENDING_REVIEW, createdAt: new Date('2024-01-01') },
        { id: '2', text: 'Comment 2', status: CommentStatus.PENDING_REVIEW, createdAt: new Date('2024-01-02') },
      ];

      repositoryMock.find.mockResolvedValue(comments);

      const result = await service.findPending(1, 10);

      expect(repositoryMock.find).toHaveBeenCalledWith({
        where: { status: CommentStatus.PENDING_REVIEW },
        order: { createdAt: 'ASC' },
        skip: 0,
        take: 10,
      });
      expect(result).toEqual(comments);
    });

    it('should use default pagination values', async () => {
      repositoryMock.find.mockResolvedValue([]);

      await service.findPending();

      expect(repositoryMock.find).toHaveBeenCalledWith({
        where: { status: CommentStatus.PENDING_REVIEW },
        order: { createdAt: 'ASC' },
        skip: 0,
        take: 20,
      });
    });

    it('should calculate correct skip for page 2', async () => {
      repositoryMock.find.mockResolvedValue([]);

      await service.findPending(2, 5);

      expect(repositoryMock.find).toHaveBeenCalledWith({
        where: { status: CommentStatus.PENDING_REVIEW },
        order: { createdAt: 'ASC' },
        skip: 5,
        take: 5,
      });
    });
  });

  describe('moderateComment', () => {
    it('should approve comment and return updated comment', async () => {
      const updatedComment = {
        id: 'comment-123',
        text: 'Test comment',
        status: CommentStatus.PUBLISHED,
        reviewedBy: 'moderator-123',
      };

      repositoryMock.update.mockResolvedValue({ affected: 1 });
      repositoryMock.findOne.mockResolvedValue(updatedComment);

      const result = await service.moderateComment('comment-123', CommentStatus.PUBLISHED, 'moderator-123');

      expect(repositoryMock.update).toHaveBeenCalledWith(
        { id: 'comment-123', status: CommentStatus.PENDING_REVIEW },
        { status: CommentStatus.PUBLISHED, reviewedBy: 'moderator-123' }
      );
      expect(repositoryMock.findOne).toHaveBeenCalledWith({ where: { id: 'comment-123' } });
      expect(result).toEqual(updatedComment);
    });

    it('should reject comment and return updated comment', async () => {
      const updatedComment = {
        id: 'comment-123',
        text: 'Test comment',
        status: CommentStatus.BLOCKED,
        reviewedBy: 'moderator-123',
      };

      repositoryMock.update.mockResolvedValue({ affected: 1 });
      repositoryMock.findOne.mockResolvedValue(updatedComment);

      const result = await service.moderateComment('comment-123', CommentStatus.BLOCKED, 'moderator-123');

      expect(repositoryMock.update).toHaveBeenCalledWith(
        { id: 'comment-123', status: CommentStatus.PENDING_REVIEW },
        { status: CommentStatus.BLOCKED, reviewedBy: 'moderator-123' }
      );
      expect(result).toEqual(updatedComment);
    });

    it('should throw NotFoundException when comment does not exist', async () => {
      repositoryMock.update.mockResolvedValue({ affected: 0 });
      repositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.moderateComment('nonexistent-id', CommentStatus.PUBLISHED, 'moderator-123')
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when comment already processed', async () => {
      const existingComment = {
        id: 'comment-123',
        text: 'Test comment',
        status: CommentStatus.PUBLISHED,
        reviewedBy: 'other-moderator',
      };

      repositoryMock.update.mockResolvedValue({ affected: 0 });
      repositoryMock.findOne.mockResolvedValue(existingComment);

      await expect(
        service.moderateComment('comment-123', CommentStatus.BLOCKED, 'moderator-123')
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when findOne returns null after update', async () => {
      repositoryMock.update.mockResolvedValue({ affected: 1 });
      repositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.moderateComment('comment-123', CommentStatus.PUBLISHED, 'moderator-123')
      ).rejects.toThrow(NotFoundException);
    });
  });
});