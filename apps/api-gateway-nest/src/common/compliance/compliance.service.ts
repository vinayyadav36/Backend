// apps/api-gateway-nest/src/common/compliance/compliance.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Consent } from './entities/consent.entity';

@Injectable()
export class ComplianceService {
  constructor(
    @InjectRepository(Consent)
    private readonly consentRepo: Repository<Consent>,
  ) {}

  async recordConsent(
    userId: string,
    purpose: string,
    granted: boolean,
    tenantId?: string,
  ): Promise<Consent> {
    const consent = this.consentRepo.create({ userId, purpose, granted, tenantId });
    return this.consentRepo.save(consent);
  }

  async getUserConsents(userId: string): Promise<Consent[]> {
    return this.consentRepo.find({ where: { userId }, order: { timestamp: 'DESC' } });
  }

  async revokeConsent(userId: string, purpose: string): Promise<Consent | null> {
    const consent = await this.consentRepo.findOne({ where: { userId, purpose, granted: true } });
    if (!consent) return null;
    consent.granted = false;
    return this.consentRepo.save(consent);
  }

  /** Right to Erasure (GDPR Art. 17) — anonymise personal data */
  async eraseUserData(userId: string): Promise<void> {
    await this.consentRepo.update({ userId }, { userId: `ERASED-${Date.now()}` });
  }
}
