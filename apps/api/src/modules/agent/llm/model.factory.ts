import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';

/**
 * The models the assistant runs on.
 *
 * Two, deliberately: the conversation needs to reason over a health record
 * and call tools, while naming a conversation in four words does not. Paying
 * the larger model to write titles would be most of the cost of a short chat.
 */
@Injectable()
export class ModelFactory {
  private readonly logger = new Logger(ModelFactory.name);

  constructor(private readonly config: ConfigService) {}

  get chatModelName(): string {
    return this.config.get<string>('OPENAI_MODEL') ?? 'gpt-4o';
  }

  get titleModelName(): string {
    return this.config.get<string>('OPENAI_TITLE_MODEL') ?? 'gpt-4o-mini';
  }

  /** True when the assistant can run at all. */
  get isConfigured(): boolean {
    return Boolean(this.config.get<string>('OPENAI_API_KEY'));
  }

  private apiKey(): string {
    const key = this.config.get<string>('OPENAI_API_KEY');
    if (!key) {
      throw new Error(
        'OPENAI_API_KEY is not set. Copy apps/api/.env.example to apps/api/.env and add it.',
      );
    }
    return key;
  }

  /** The conversational model. Streaming, so the UI can show text as it lands. */
  forChat(): ChatOpenAI {
    return new ChatOpenAI({
      model: this.chatModelName,
      apiKey: this.apiKey(),
      temperature: 0.3,
      streaming: true,
    });
  }

  /** Cheap and short: one line out, no tools, no streaming. */
  forTitles(): ChatOpenAI {
    return new ChatOpenAI({
      model: this.titleModelName,
      apiKey: this.apiKey(),
      temperature: 0.2,
      maxTokens: 24,
    });
  }

  warnIfUnconfigured(): void {
    if (!this.isConfigured) {
      this.logger.warn(
        'OPENAI_API_KEY is not set -- the assistant will refuse to run.',
      );
    }
  }
}
