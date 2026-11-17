import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CommentsService } from './comments.service';
import { Comment } from './comment.entity';
import { ModerationDecisionService } from '../moderation/moderation-decision.service';
import { TEXT_CLASSIFIER, Label, CommentStatus } from '../moderation/moderation.types';
import { CreateCommentDto } from './dto/create-comment.dto';

describe('CommentsService', () => {
  let service: CommentsService;
  let classifierMock: any;
  let decisionMock: any;
  let repositoryMock: any;

  beforeEach(async () => {
    classifierMock = { classify: jest.fn() };
    decisionMock = { decide: jest.fn() };
    repositoryMock = {
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation((comment) => Promise.resolve({ id: 'uuid-123', ...comment })),
      find: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: getRepositoryToken(Comment), useValue: repositoryMock },
        { provide: TEXT_CLASSIFIER, useValue: classifierMock },
        { provide: ModerationDecisionService, useValue: decisionMock },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should save comment with status decided by ModerationDecisionService', async () => {
      const dto: CreateCommentDto = { text: 'Hola mundo' };
      const userId = 'user-123';

      classifierMock.classify.mockResolvedValue({ label: Label.LEGIT, confidence: 0.95, reason: 'Ok' });
      decisionMock.decide.mockReturnValue(CommentStatus.PUBLISHED);

      const result = await service.create(dto, userId);

      expect(classifierMock.classify).toHaveBeenCalledWith(dto.text);
      expect(decisionMock.decide).toHaveBeenCalledWith({
        label: Label.LEGIT,
        confidence: 0.95,
        reason: 'Ok',
      });
      expect(repositoryMock.create).toHaveBeenCalledWith({
        text: dto.text,
        userId,
        status: CommentStatus.PUBLISHED,
        label: Label.LEGIT,
        confidence: 0.95,
        reason: 'Ok',
      });
      expect(repositoryMock.save).toHaveBeenCalled();
      expect(result.status).toBe(CommentStatus.PUBLISHED);
      expect(result.userId).toBe(userId);
      expect(result.text).toBe(dto.text);
    });

    it('should force PENDING_REVIEW when classifier throws error', async () => {
      const dto: CreateCommentDto = { text: 'Fallo' };
      const userId = 'user-456';

      classifierMock.classify.mockRejectedValue(new Error('Timeout de API'));
      decisionMock.decide.mockReturnValue(CommentStatus.PENDING_REVIEW);

      const result = await service.create(dto, userId);

      expect(classifierMock.classify).toHaveBeenCalledWith(dto.text);
      expect(decisionMock.decide).toHaveBeenCalledWith({
        label: Label.SPAM,
        confidence: 0,
        reason: 'Fallo del clasificador',
      });
      expect(repositoryMock.create).toHaveBeenCalledWith({
        text: dto.text,
        userId,
        status: CommentStatus.PENDING_REVIEW,
        label: Label.SPAM,
        confidence: 0,
        reason: 'Fallo del clasificador',
      });
      expect(result.status).toBe(CommentStatus.PENDING_REVIEW);
    });

    it('should handle SPAM classification', async () => {
      const dto: CreateCommentDto = { text: 'Buy now!!!' };
      const userId = 'user-789';

      classifierMock.classify.mockResolvedValue({ label: Label.SPAM, confidence: 0.99, reason: 'Spam detected' });
      decisionMock.decide.mockReturnValue(CommentStatus.BLOCKED);

      const result = await service.create(dto, userId);

      expect(decisionMock.decide).toHaveBeenCalledWith({
        label: Label.SPAM,
        confidence: 0.99,
        reason: 'Spam detected',
      });
      expect(result.status).toBe(CommentStatus.BLOCKED);
    });

    it('should handle TOXIC classification', async () => {
      const dto: CreateCommentDto = { text: 'You are stupid' };
      const userId = 'user-999';

      classifierMock.classify.mockResolvedValue({ label: Label.TOXIC, confidence: 0.85, reason: 'Toxic language' });
      decisionMock.decide.mockReturnValue(CommentStatus.PENDING_REVIEW);

      const result = await service.create(dto, userId);

      expect(decisionMock.decide).toHaveBeenCalledWith({
        label: Label.TOXIC,
        confidence: 0.85,
        reason: 'Toxic language',
      });
      expect(result.status).toBe(CommentStatus.PENDING_REVIEW);
    });
  });

  describe('findAllPublished', () => {
    it('should return published comments with pagination', async () => {
      const comments = [
        { id: '1', text: 'Comment 1', status: CommentStatus.PUBLISHED, createdAt: new Date() },
        { id: '2', text: 'Comment 2', status: CommentStatus.PUBLISHED, createdAt: new Date() },
      ];

      repositoryMock.find.mockResolvedValue(comments);

      const result = await service.findAllPublished(1, 10);

      expect(repositoryMock.find).toHaveBeenCalledWith({
        where: { status: CommentStatus.PUBLISHED },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 10,
      });
      expect(result).toEqual(comments);
    });

    it('should use default pagination values', async () => {
      repositoryMock.find.mockResolvedValue([]);

      await service.findAllPublished();

      expect(repositoryMock.find).toHaveBeenCalledWith({
        where: { status: CommentStatus.PUBLISHED },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 20,
      });
    });

    it('should calculate correct skip for page 2', async () => {
      repositoryMock.find.mockResolvedValue([]);

      await service.findAllPublished(2, 5);

      expect(repositoryMock.find).toHaveBeenCalledWith({
        where: { status: CommentStatus.PUBLISHED },
        order: { createdAt: 'DESC' },
        skip: 5,
        take: 5,
      });
    });
  });
});