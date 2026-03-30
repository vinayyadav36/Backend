// libs/integrations/google-drive/sheets.service.ts
import { Injectable } from '@nestjs/common';

/**
 * SheetsService
 * Read/write Google Sheets rows — used for budget sync and reporting.
 */
@Injectable()
export class SheetsService {
  private async getClient() {
    const { google } = await import('googleapis');
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SA_KEY_PATH,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return google.sheets({ version: 'v4', auth });
  }

  /** Read all rows from a named sheet. */
  async readRows(spreadsheetId: string, range: string): Promise<any[][]> {
    const sheets = await this.getClient();
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    return res.data.values || [];
  }

  /** Append rows to the end of a named sheet. */
  async appendRows(spreadsheetId: string, range: string, values: any[][]): Promise<void> {
    const sheets = await this.getClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });
  }

  /** Overwrite a range with new values. */
  async writeRows(spreadsheetId: string, range: string, values: any[][]): Promise<void> {
    const sheets = await this.getClient();
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });
  }
}
