import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { resumeAgentSchema, runAgentSchema } from '@repo/contracts';
import type { Actor } from '@repo/contracts';
import type { Request, Response } from 'express';

import { CurrentActor } from '../../auth/actor.decorator';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import { CapabilityRegistry } from '../../capabilities/capability-registry.service';
import { parseInput } from '../../common/validation';
import { AgentService } from './agent.service';
import { runError, type AguiEvent } from './agui/events';
import { closeStream, openStream, writeEvent } from './agui/sse';
import { buildToolset } from './llm/tool-adapter';

@UseGuards(ClerkAuthGuard)
@Controller('agent')
export class AgentController {
  constructor(
    private readonly agent: AgentService,
    private readonly registry: CapabilityRegistry,
  ) {}

  @Get()
  info() {
    return this.agent.info();
  }

  /** What the assistant can actually do, as the model sees it. */
  @Get('tools')
  tools(@CurrentActor() actor: Actor) {
    // Tools close over the caller so every capability call is scoped to them;
    // there is no actor-free view of the toolset.
    const { tools, writeToolNames } = buildToolset(this.registry, actor);
    return {
      tools: tools.map((item) => ({
        name: item.name,
        description: item.description,
        needsConfirmation: writeToolNames.includes(item.name),
      })),
    };
  }

  @Post('run')
  run(
    @CurrentActor() actor: Actor,
    @Body() body: unknown,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const input = parseInput(runAgentSchema, body);
    return this.pipe(this.agent.run(actor, input), request, response);
  }

  /** Answer a write the run stopped on. */
  @Post('resume')
  resume(
    @CurrentActor() actor: Actor,
    @Body() body: unknown,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const input = parseInput(resumeAgentSchema, body);
    return this.pipe(this.agent.resume(actor, input), request, response);
  }

  /**
   * Drain the run into the response as AG-UI events.
   *
   * Once the stream is open the status is already sent, so a failure can only
   * be reported as a `RUN_ERROR` frame -- never as an HTTP error. Aborting is
   * expected rather than exceptional: closing the app mid-answer is a normal
   * way for this to end.
   */
  private async pipe(
    events: AsyncGenerator<AguiEvent>,
    request: Request,
    response: Response,
  ): Promise<void> {
    openStream(response);

    let aborted = false;
    request.on('close', () => {
      aborted = true;
    });

    try {
      for await (const event of events) {
        if (aborted) {
          break;
        }
        writeEvent(response, event);
      }
    } catch (error) {
      writeEvent(response, runError(String(error), 'stream_failed'));
    } finally {
      // No explicit `return()` needed: leaving the `for await` -- by break or
      // by throw -- already closes the generator, which is what releases the
      // per-user run lock in its own `finally`.
      closeStream(response);
    }
  }
}
