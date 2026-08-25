import { Injectable, Logger } from '@nestjs/common';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

import { ModelFactory } from './model.factory';

const TITLE_PROMPT =
  'Name this conversation in three or four words. Reply with the name only -- ' +
  'no quotes, no punctuation, no preamble. Examples: Morning medicine routine, ' +
  'Blood pressure trend, Preparing for cardiology visit.';

/**
 * Names a conversation from its opening message.
 *
 * Runs alongside the answer rather than before it, so nobody waits on a title
 * to see their reply. A failure is swallowed: an untitled conversation is a
 * cosmetic problem, and it is not worth losing an answer over.
 */
@Injectable()
export class TitleService {
  private readonly logger = new Logger(TitleService.name);

  constructor(private readonly models: ModelFactory) {}

  async generate(firstMessage: string): Promise<string | null> {
    try {
      const response = await this.models
        .forTitles()
        .invoke([
          new SystemMessage(TITLE_PROMPT),
          new HumanMessage(firstMessage),
        ]);

      // Content is a string for a plain reply and a block array otherwise;
      // a title model that returns blocks has not followed the instruction.
      const raw = typeof response.content === 'string' ? response.content : '';
      const title = raw.replace(/["'\n]/g, '').trim();
      // A model that ignores the instruction and writes a sentence should not
      // end up as a session name.
      return title.length > 0 && title.length <= 60 ? title : null;
    } catch (error) {
      this.logger.warn(`Could not title the conversation: ${String(error)}`);
      return null;
    }
  }
}
