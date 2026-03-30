// apps/api-gateway-nest/src/app.module.ts
import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { TenantMiddleware } from '@libs/common';
import { JournalEntry } from '@libs/accounting';
import { LedgerLine } from '@libs/accounting';

import { AuthModule } from './auth/auth.module';
import { HotelModule } from './hotel/hotel.module';
import { FinanceModule } from './modules/finance/finance.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AutomationModule } from './modules/automation/automation.module';
import { BackupModule } from './modules/backup/backup.module';
import { AiModule } from './modules/ai/ai.module';
import { WorkerModule } from './modules/worker/worker.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';
import { AuditModule } from './common/audit/audit.module';
import { ComplianceModule } from './common/compliance/compliance.module';
import { MlBridgeModule } from './ml-bridge/ml-bridge.module';

import { ImmutableAuditLog } from './common/audit/entities/immutable-audit.entity';
import { Consent } from './common/compliance/entities/consent.entity';

@Module({
  imports: [
    // ── Database (Postgres via TypeORM) ──────────────────────────────────────
    TypeOrmModule.forRootAsync({
      useFactory: async () => {
        // Resolve DB password from Azure Key Vault when available
        let password = process.env.DB_PASSWORD;
        if (process.env.KEYVAULT_NAME) {
          try {
            const { KeyVaultService } = await import('./common/security/keyvault.service');
            const kv = new KeyVaultService();
            password = await kv.getSecret('DB-Password');
          } catch {
            // fall through to env var
          }
        }
        return {
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432'),
          username: process.env.DB_USER || 'postgres',
          password,
          database: process.env.DB_NAME || 'jarvis_accounting',
          ssl: process.env.NODE_ENV === 'production',
          entities: [JournalEntry, LedgerLine, ImmutableAuditLog, Consent],
          synchronize: process.env.NODE_ENV !== 'production',
        };
      },
    }),

    // ── Shared HTTP client ───────────────────────────────────────────────────
    HttpModule.register({ timeout: 30000 }),

    // ── Feature modules ──────────────────────────────────────────────────────
    AuthModule,
    HotelModule,
    FinanceModule,
    ReportsModule,
    AutomationModule,
    BackupModule,
    AiModule,
    WorkerModule,
    WorkflowsModule,
    MlBridgeModule,

    // ── Cross-cutting modules ────────────────────────────────────────────────
    AuditModule,
    ComplianceModule,
  ],
})
export class AppModule {
  /** Apply TenantMiddleware globally — every route requires x-tenant-id */
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
