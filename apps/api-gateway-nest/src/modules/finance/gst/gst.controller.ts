// apps/api-gateway-nest/src/modules/finance/gst/gst.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { GstService } from './gst.service';

@Controller('gst')
export class GstController {
  constructor(private readonly gstService: GstService) {}

  /** POST /gst/export — export GST invoice as PDF or Excel, upload to Drive */
  @Post('export')
  exportInvoice(@Body() body: { invoice: any; format: 'pdf' | 'excel' }) {
    return this.gstService.exportInvoice(body.invoice, body.format);
  }
}
