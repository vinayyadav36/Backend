// apps/api-gateway-nest/src/modules/backup/backup.service.ts
import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Injectable()
export class BackupService {
  /** Trigger a Postgres pg_dump to /tmp and return the file path */
  async backupPostgres(): Promise<string> {
    const filePath = `/tmp/pg-backup-${Date.now()}.sql`;
    await execAsync(
      `pg_dump -U ${process.env.DB_USER} -h ${process.env.DB_HOST} ${process.env.DB_NAME} > ${filePath}`,
    );
    return filePath;
  }

  /** Trigger a mongodump archive to /tmp and return the file path */
  async backupMongo(): Promise<string> {
    const filePath = `/tmp/mongo-backup-${Date.now()}.gz`;
    await execAsync(
      `mongodump --uri="${process.env.MONGO_URI}" --archive=${filePath} --gzip`,
    );
    return filePath;
  }
}
