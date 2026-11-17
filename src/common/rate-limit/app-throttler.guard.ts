import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';

/**
 * El ThrottlerGuard solo envía "Retry-After" para el throttler "default"; para
 * los demás usa "Retry-After-<nombre>". Aquí se agrega siempre el header
 * estándar para que cualquier cliente sepa cuánto esperar.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const { res } = this.getRequestResponse(context);
    this.setResponseHeader(res, 'Retry-After', detail.timeToBlockExpire);
    return super.throwThrottlingException(context, detail);
  }
}
