import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  byIdSchema,
  createDocumentSchema,
  listDocumentsSchema,
  updateDocumentSchema,
} from '@repo/contracts';
import type { Actor } from '@repo/contracts';

import { CurrentActor } from '../../auth/actor.decorator';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import { parseInput } from '../../common/validation';
import { DocumentsService } from './documents.service';

@ApiTags('Documents')
@ApiBearerAuth('clerk-jwt')
@UseGuards(ClerkAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @ApiOperation({
    summary: 'List Health Documents',
    description: 'Returns uploaded medical reports, lab findings, prescription scans, and discharge summaries.',
  })
  @ApiResponse({ status: 200, description: 'List of documents' })
  @Get()
  list(@CurrentActor() actor: Actor, @Query() query: unknown) {
    return this.documents.list(actor, parseInput(listDocumentsSchema, query));
  }

  @ApiOperation({
    summary: 'Get Document by ID',
    description: 'Retrieves document metadata, storage URI, tags, and summary.',
  })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({ status: 200, description: 'Document details' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  @Get(':id')
  get(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.documents.get(actor, parseInput(byIdSchema, { id }));
  }

  @ApiOperation({
    summary: 'Upload / Register Document',
    description: 'Registers a new medical document or diagnostic report.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['title', 'category', 'fileUrl'],
      properties: {
        title: { type: 'string', example: 'Complete Blood Count (CBC) Report' },
        category: { type: 'string', enum: ['lab_report', 'prescription', 'scan', 'discharge_summary', 'other'], example: 'lab_report' },
        fileUrl: { type: 'string', example: 'https://storage.swasthsaathi.me/reports/cbc-2026.pdf' },
        documentDate: { type: 'string', example: '2026-09-05' },
        notes: { type: 'string', example: 'Normal hemoglobin levels' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Document registered' })
  @Post()
  create(@CurrentActor() actor: Actor, @Body() body: unknown) {
    return this.documents.create(actor, parseInput(createDocumentSchema, body));
  }

  @ApiOperation({
    summary: 'Update Document Metadata',
    description: 'Updates document title, category, or notes.',
  })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({ status: 200, description: 'Document updated' })
  @Patch(':id')
  update(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: object,
  ) {
    return this.documents.update(
      actor,
      parseInput(updateDocumentSchema, { ...body, id }),
    );
  }

  @ApiOperation({
    summary: 'Delete Document',
    description: 'Removes a document record from the health profile.',
  })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({ status: 200, description: 'Document removed' })
  @Delete(':id')
  remove(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.documents.remove(actor, parseInput(byIdSchema, { id }));
  }
}
