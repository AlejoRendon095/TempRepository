import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ModerationDecisionService } from './moderation-decision.service';
import { Label, CommentStatus } from './moderation.types';

describe('ModerationDecisionService', () => {
  let service: ModerationDecisionService;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn().mockReturnValue(0.85),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModerationDecisionService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ModerationDecisionService>(ModerationDecisionService);
  });

  it('debe bloquear SPAM/FRAUD si supera el umbral', () => {
    expect(service.decide({ label: Label.SPAM, confidence: 0.9, reason: '' })).toBe(CommentStatus.BLOCKED);
    expect(service.decide({ label: Label.FRAUD, confidence: 0.99, reason: '' })).toBe(CommentStatus.BLOCKED);
  });

  it('debe publicar LEGIT si supera el umbral', () => {
    expect(service.decide({ label: Label.LEGIT, confidence: 0.9, reason: '' })).toBe(CommentStatus.PUBLISHED);
  });

  it('debe mandar a revisión si está justo en el umbral (0.85)', () => {
    expect(service.decide({ label: Label.SPAM, confidence: 0.85, reason: '' })).toBe(CommentStatus.BLOCKED);
    expect(service.decide({ label: Label.LEGIT, confidence: 0.85, reason: '' })).toBe(CommentStatus.PUBLISHED);
  });

  it('debe mandar a revisión si la confianza es menor al umbral o es 0', () => {
    expect(service.decide({ label: Label.LEGIT, confidence: 0.84, reason: '' })).toBe(CommentStatus.PENDING_REVIEW);
    expect(service.decide({ label: Label.SPAM, confidence: 0.5, reason: '' })).toBe(CommentStatus.PENDING_REVIEW);
    expect(service.decide({ label: Label.FRAUD, confidence: 0, reason: '' })).toBe(CommentStatus.PENDING_REVIEW);
  });
});