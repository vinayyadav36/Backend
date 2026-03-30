// apps/api-gateway-nest/src/common/security/keyvault.service.ts
import { Injectable } from '@nestjs/common';

/**
 * KeyVaultService
 * Retrieves secrets from Azure Key Vault using DefaultAzureCredential
 * (Managed Identity in AKS / service-principal via env vars locally).
 */
@Injectable()
export class KeyVaultService {
  private client: any = null;

  private async getClient() {
    if (this.client) return this.client;
    const { SecretClient } = await import('@azure/keyvault-secrets');
    const { DefaultAzureCredential } = await import('@azure/identity');
    const vaultUrl = `https://${process.env.KEYVAULT_NAME}.vault.azure.net`;
    this.client = new SecretClient(vaultUrl, new DefaultAzureCredential());
    return this.client;
  }

  async getSecret(name: string): Promise<string> {
    const client = await this.getClient();
    const secret = await client.getSecret(name);
    return secret.value;
  }

  async setSecret(name: string, value: string): Promise<void> {
    const client = await this.getClient();
    await client.setSecret(name, value);
  }
}
