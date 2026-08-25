import { Module } from '@nestjs/common';

import { PreventionModule } from '../prevention/prevention.module';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { AgentFactory } from './llm/agent.factory';
import { ModelFactory } from './llm/model.factory';
import { TitleService } from './llm/title.service';
import { MemoryController } from './memory/memory.controller';
import { MemoryService } from './memory/memory.service';
import { SessionController } from './sessions/session.controller';
import { SessionService } from './sessions/session.service';

/**
 * The assistant, its conversations and its memory.
 *
 * Imports the prevention module for the health snapshot that opens every
 * system prompt. Everything else it can do arrives through the capability
 * registry, so this module deliberately depends on no other feature module --
 * adding a capability anywhere makes it available here with no wiring.
 */
@Module({
  imports: [PreventionModule],
  controllers: [AgentController, SessionController, MemoryController],
  providers: [
    AgentService,
    AgentFactory,
    SessionService,
    MemoryService,
    ModelFactory,
    TitleService,
  ],
  exports: [AgentService, SessionService, MemoryService],
})
export class AgentModule {}
