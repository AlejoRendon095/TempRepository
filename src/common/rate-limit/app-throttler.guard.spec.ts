import { ExecutionContext } from '@nestjs/common';
import { ThrottlerLimitDetail } from '@nestjs/throttler';
import { AppThrottlerGuard } from './app-throttler.guard';

describe('AppThrottlerGuard', () => {
  let guard: AppThrottlerGuard;

  beforeEach(() => {
    guard = new AppThrottlerGuard(
      { throttlers: [] } as any,
      { increment: jest.fn(), get: jest.fn(), reset: jest.fn() } as any,
      { get: jest.fn(), getAllAndOverride: jest.fn() } as any,
    );
  });

  const createMockContext = (): ExecutionContext => {
    const mockRes = {
      setHeader: jest.fn(),
    };

    return {
      switchToHttp: () => ({
        getRequest: () => ({}),
        getResponse: () => mockRes,
      }),
    } as unknown as ExecutionContext;
  };

  describe('throwThrottlingException', () => {
    it('should set Retry-After header and call super', async () => {
      const context = createMockContext();
      const detail: ThrottlerLimitDetail = {
        limit: 10,
        totalHits: 11,
        timeToBlockExpire: 45,
        blockedFor: 45,
      };

      const mockGetRequestResponse = jest.spyOn(guard as any, 'getRequestResponse').mockReturnValue({
        res: context.switchToHttp().getResponse(),
      });

      const mockSetResponseHeader = jest.spyOn(guard as any, 'setResponseHeader').mockImplementation();
      const mockSuperThrow = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'throwThrottlingException').mockResolvedValue(undefined);

      await guard.throwThrottlingException(context, detail);

      expect(mockSetResponseHeader).toHaveBeenCalledWith(
        context.switchToHttp().getResponse(),
        'Retry-After',
        45
      );
      expect(mockSuperThrow).toHaveBeenCalledWith(context, detail);
    });
  });
});