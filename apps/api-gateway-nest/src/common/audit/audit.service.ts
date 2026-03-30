// apps/api-gateway-nest/src/common/audit/audit.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { ImmutableAuditLog } from './entities/immutable-audit.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(ImmutableAuditLog)
    private readonly auditRepo: Repository<ImmutableAuditLog>,
  ) {}

  async log(
    userId: string,
    action: string,
    details: any = {},
    tenantId?: string,
  ): Promise<void> {
    const timestamp = new Date();
    const payload = { userId, action, details, timestamp: timestamp.toISOString() };
    const hash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

    const record = this.auditRepo.create({ userId, action, details, tenantId, timestamp, hash });
    await this.auditRepo.save(record);
  }
}
