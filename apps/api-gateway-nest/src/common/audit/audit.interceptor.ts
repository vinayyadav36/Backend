// apps/api-gateway-nest/src/common/audit/audit.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';

/**
 * AuditInterceptor
 * Automatically records every mutating API call (non-GET) to the immutable audit log.
 * Applied globally in app.module.ts.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, url, body, tenantId } = req;
    const userId: string = req.user?.id || 'anonymous';

    return next.handle().pipe(
      tap(() => {
        if (method !== 'GET') {
          // Fire-and-forget — never block the response
          this.auditService.log(userId, `${method} ${url}`, body, tenantId).catch(() => {});
        }
      }),
    );
  }
}
