import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Event } from '@prisma/client';
import type { Request } from 'express';
import { memoryStorage } from 'multer';
import { EventAdminGuard } from '../events/event-admin.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ImportService } from './import.service.js';

const FILE_INTERCEPTOR_OPTIONS = {
  storage: memoryStorage(), // only JSON.parse'd, no disk write needed
  limits: { fileSize: 25 * 1024 * 1024 }, // real file is well under 1MB; generous headroom
  fileFilter: (
    _req: unknown,
    file: Express.Multer.File,
    cb: (err: Error | null, ok: boolean) => void,
  ) => {
    if (!file.originalname.toLowerCase().endsWith('.json')) {
      return cb(new BadRequestException('Expected a .json file'), false);
    }
    cb(null, true);
  },
};

@Controller('events/:slug/import')
@UseGuards(JwtAuthGuard, EventAdminGuard)
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('preview')
  @UseInterceptors(FileInterceptor('file', FILE_INTERCEPTOR_OPTIONS))
  preview(@Req() req: Request & { event: Event }, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Missing file');
    return this.importService.preview(req.event, file.buffer);
  }

  @Post('apply')
  @UseInterceptors(FileInterceptor('file', FILE_INTERCEPTOR_OPTIONS))
  apply(@Req() req: Request & { event: Event }, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Missing file');
    return this.importService.apply(req.event, file.buffer);
  }
}
