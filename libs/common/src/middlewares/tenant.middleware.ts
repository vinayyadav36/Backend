// libs/common/src/middlewares/tenant.middleware.ts
import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';

/**
 * TenantMiddleware
 * Enforces multi-tenant isolation by requiring the x-tenant-id header on every request.
 * The extracted tenantId is injected into req so all downstream handlers can use it
 * without re-reading the header.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void): void {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      throw new UnauthorizedException(
        'Tenant ID is required for Jarvis operations. Provide the x-tenant-id header.',
      );
    }
    req.tenantId = tenantId;
    next();
  }
}
