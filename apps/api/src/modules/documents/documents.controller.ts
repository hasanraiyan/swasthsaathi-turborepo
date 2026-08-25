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

@UseGuards(ClerkAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(@CurrentActor() actor: Actor, @Query() query: unknown) {
    return this.documents.list(actor, parseInput(listDocumentsSchema, query));
  }

  @Get(':id')
  get(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.documents.get(actor, parseInput(byIdSchema, { id }));
  }

  @Post()
  create(@CurrentActor() actor: Actor, @Body() body: unknown) {
    return this.documents.create(actor, parseInput(createDocumentSchema, body));
  }

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

  @Delete(':id')
  remove(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.documents.remove(actor, parseInput(byIdSchema, { id }));
  }
}
