// libs/integrations/google-drive/drive.service.ts
import { Injectable } from '@nestjs/common';
import * as path from 'path';

/**
 * DriveService
 * Wraps the Google Drive API to upload files and return shareable links.
 * Authentication uses a service-account JSON key (GOOGLE_SA_KEY_PATH env var)
 * or Application Default Credentials in GCP/Cloud Run environments.
 */
@Injectable()
export class DriveService {
  /**
   * Upload a file to Google Drive and return a shareable link.
   *
   * @param filePath  Local path to the file (or pass a Buffer with `fileName`)
   * @param fileName  Destination file name on Drive
   * @param mimeType  MIME type; defaults to application/octet-stream
   */
  async uploadFile(
    filePath: string,
    fileName: string,
    mimeType = 'application/octet-stream',
  ): Promise<string> {
    // Dynamic import keeps the google-auth-library optional at build time
    const { google } = await import('googleapis');
    const { createReadStream } = await import('fs');

    // Validate filePath to prevent path traversal: use only the basename, joined to /tmp
    const allowedDir = path.resolve('/tmp');
    const safeFileName = path.basename(filePath); // extract only the filename, dropping any directory component
    const safePath = path.join(allowedDir, safeFileName); // reconstruct safe path

    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SA_KEY_PATH,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });

    const folderId = await this.getTenantFolder(process.env.DRIVE_ROOT_FOLDER_ID);

    const res = await drive.files.create({
      requestBody: { name: fileName, parents: [folderId] },
      media: { mimeType, body: createReadStream(safePath) },
      fields: 'id, webViewLink',
    });

    await drive.permissions.create({
      fileId: res.data.id,
      requestBody: { role: 'reader', type: 'anyone' },
    });

    return res.data.webViewLink || `https://drive.google.com/file/d/${res.data.id}/view`;
  }

  /** Upload a raw Buffer to Drive and return a shareable link. */
  async uploadBuffer(
    buffer: Buffer,
    fileName: string,
    mimeType = 'application/octet-stream',
  ): Promise<string> {
    const { google } = await import('googleapis');
    const { Readable } = await import('stream');

    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SA_KEY_PATH,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });
    const folderId = await this.getTenantFolder(process.env.DRIVE_ROOT_FOLDER_ID);
    const body = Readable.from(buffer);

    const res = await drive.files.create({
      requestBody: { name: fileName, parents: [folderId] },
      media: { mimeType, body },
      fields: 'id, webViewLink',
    });

    await drive.permissions.create({
      fileId: res.data.id,
      requestBody: { role: 'reader', type: 'anyone' },
    });

    return res.data.webViewLink || `https://drive.google.com/file/d/${res.data.id}/view`;
  }

  /** Resolve or create the tenant's dedicated Drive folder. */
  private async getTenantFolder(rootFolderId?: string): Promise<string> {
    return rootFolderId || 'root';
  }
}
