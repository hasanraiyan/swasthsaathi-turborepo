import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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
export class ModelFactory implements OnModuleInit {
  private readonly logger = new Logger(ModelFactory.name);

  constructor(private readonly config: ConfigService) {}

  get chatModelName(): string {
    return this.config.get<string>('OPENAI_MODEL') ?? 'gpt-4o';
  }

  get titleModelName(): string {
    return this.config.get<string>('OPENAI_TITLE_MODEL') ?? 'gpt-4o-mini';
  }

  /**
   * Where the models are served from.
   *
   * Anything speaking the OpenAI chat API works here -- NVIDIA NIM
   * (`https://integrate.api.nvidia.com/v1`), OpenRouter, Together, a local
   * vLLM. Left unset it goes to OpenAI itself.
   *
   * One caveat that decides whether this product works at all: the assistant
   * is nothing but tool calls, so whichever model is chosen must support
   * function calling. Plenty of models on these gateways do not, and a model
   * that ignores tools will answer confidently out of thin air rather than
   * reading the health record -- which is worse here than failing outright.
   */
  get baseUrl(): string | undefined {
    return this.config.get<string>('OPENAI_BASE_URL') || undefined;
  }

  /** True when the assistant can run at all. */
  get isConfigured(): boolean {
    return Boolean(this.config.get<string>('OPENAI_API_KEY'));
  }

  private number(key: string, fallback: number): number {
    const value = Number(this.config.get<string>(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  /** Only set when pointed elsewhere, so the OpenAI default stays untouched. */
  private clientOptions():
    { configuration: { baseURL: string } } | Record<string, never> {
    const baseURL = this.baseUrl;
    return baseURL ? { configuration: { baseURL } } : {};
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
      // Generous: a hosted gateway can take tens of seconds for a tool call,
      // and cutting off a real answer is worse than waiting for it.
      timeout: this.number('AGENT_CHAT_TIMEOUT_MS', 180_000),
      ...this.clientOptions(),
    });
  }

  /** Cheap and short: one line out, no tools, no streaming. */
  forTitles(): ChatOpenAI {
    return new ChatOpenAI({
      model: this.titleModelName,
      apiKey: this.apiKey(),
      temperature: 0.2,
      maxTokens: 24,
      // Short on purpose. Naming a chat is a nicety; it must never be the
      // reason someone waits, and an untitled session costs nothing.
      timeout: this.number('AGENT_TITLE_TIMEOUT_MS', 15_000),
      ...this.clientOptions(),
    });
  }

  /** Say at startup what the assistant will talk to, and what is missing. */
  onModuleInit(): void {
    this.warnIfUnconfigured();
  }

  private warnIfUnconfigured(): void {
    if (!this.isConfigured) {
      this.logger.warn(
        'OPENAI_API_KEY is not set -- the assistant will refuse to run.',
      );
      return;
    }

    const endpoint = this.baseUrl;
    if (!endpoint) {
      return;
    }

    this.logger.log(`Assistant models served from ${endpoint}`);
    // A gateway will not have OpenAI's model names, so the defaults are
    // certainly wrong there -- and the failure is a 404 mid-conversation
    // rather than anything obvious at startup.
    if (!this.config.get<string>('OPENAI_MODEL')) {
      this.logger.warn(
        `OPENAI_BASE_URL is set but OPENAI_MODEL is not, so "${this.chatModelName}" will be requested from ${endpoint}. Set both.`,
      );
    }
  }
}
