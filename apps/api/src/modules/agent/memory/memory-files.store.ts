import { BaseStore } from '@langchain/langgraph';
import type { Operation, OperationResults } from '@langchain/langgraph';
import type { Model } from 'mongoose';

import type {
  AgentMemory,
  AgentMemoryDocument,
} from '../../../database/schemas/agent-memory.schema';

/** Where one person's memory lives. One agent, so no per-agent namespace. */
export function userMemoryNamespace(userId: string): string[] {
  return ['users', userId];
}

/**
 * Normalise a memory path, rejecting traversal.
 *
 * The agent chooses these paths itself, so `..` has to be refused here rather
 * than trusted -- a model talked into writing `/memories/../../x` must not be
 * able to address another person's namespace.
 */
export function normalizeMemoryKey(rawKey: unknown): string {
  const cleaned = (typeof rawKey === 'string' ? rawKey : '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
  const parts = cleaned.split('/').filter(Boolean);

  if (parts.length === 0) {
    throw new Error('Memory file path is required');
  }
  if (
    parts.some(
      (part) =>
        part === '.' || part === '..' || part === '~' || part.includes('\0'),
    )
  ) {
    throw new Error(`Invalid memory file path: ${cleaned}`);
  }
  return `/${parts.join('/')}`;
}

/**
 * A LangGraph `BaseStore` over the memory collection.
 *
 * deepagents' `StoreBackend` mounts this as the agent's `/memories/`
 * filesystem, so its built-in read, write and edit tools operate on real
 * documents and memory survives between conversations with no bespoke
 * plumbing.
 *
 * Only `batch` is implemented. `BaseStore` already provides `get`, `put`,
 * `search` and `delete` as wrappers that funnel into it -- overriding them
 * changes signatures the base class has already fixed.
 */
export class MemoryFilesStore extends BaseStore {
  constructor(private readonly model: Model<AgentMemory>) {
    super();
  }

  async batch<Op extends readonly Operation[]>(
    operations: Op,
  ): Promise<OperationResults<Op>> {
    const results: unknown[] = [];

    for (const operation of operations) {
      if ('value' in operation) {
        await this.write(operation.namespace, operation.key, operation.value);
        results.push(null);
      } else if ('namespacePrefix' in operation) {
        results.push(await this.searchFiles(operation));
      } else if ('key' in operation && 'namespace' in operation) {
        results.push(await this.readFile(operation.namespace, operation.key));
      } else {
        // `listNamespaces` -- the filesystem tools never ask for it here,
        // since every run is scoped to one person's namespace.
        results.push([]);
      }
    }

    return results as OperationResults<Op>;
  }

  private async readFile(namespace: string[], key: string) {
    const doc = await this.model
      .findOne({ namespace, key: normalizeMemoryKey(key) })
      .exec();
    return doc ? this.toItem(doc) : null;
  }

  private async write(
    namespace: string[],
    key: string,
    value: Record<string, unknown> | null,
  ): Promise<void> {
    const path = normalizeMemoryKey(key);

    if (value === null) {
      await this.model.deleteOne({ namespace, key: path }).exec();
      return;
    }

    await this.model
      .findOneAndUpdate(
        { namespace, key: path },
        {
          $set: {
            content: toText(value.content),
            mimeType:
              typeof value.mimeType === 'string'
                ? value.mimeType
                : 'text/markdown',
          },
          // Kept beside the namespace so ownership-scoped reads elsewhere
          // don't have to understand the namespace layout.
          $setOnInsert: { namespace, key: path, userId: namespace[1] ?? '' },
        },
        { upsert: true, returnDocument: 'after' },
      )
      .exec();
  }

  private async searchFiles(operation: {
    namespacePrefix: string[];
    limit?: number;
    offset?: number;
    query?: string;
  }) {
    const filter: Record<string, unknown> = {};
    operation.namespacePrefix.forEach((part, index) => {
      filter[`namespace.${index}`] = part;
    });

    // Stable sort, so the backend's offset paging never skips or repeats.
    let cursor = this.model.find(filter).sort({ key: 1, _id: 1 });
    if (operation.offset) {
      cursor = cursor.skip(operation.offset);
    }
    if (operation.limit !== undefined) {
      cursor = cursor.limit(operation.limit);
    }

    const docs = await cursor.exec();
    const needle = operation.query?.trim().toLowerCase();

    return docs
      .filter(
        (doc) =>
          !needle ||
          doc.key.toLowerCase().includes(needle) ||
          doc.content.toLowerCase().includes(needle),
      )
      .map((doc) => this.toItem(doc));
  }

  private toItem(doc: AgentMemoryDocument) {
    const stamped = doc as unknown as { createdAt: Date; updatedAt: Date };
    return {
      key: doc.key,
      namespace: doc.namespace,
      // deepagents' FileData shape -- its filesystem tools read these fields.
      value: {
        content: doc.content,
        mimeType: doc.mimeType,
        created_at: stamped.createdAt.toISOString(),
        modified_at: stamped.updatedAt.toISOString(),
      },
      createdAt: stamped.createdAt,
      updatedAt: stamped.updatedAt,
    };
  }
}

function toText(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content.join('\n');
  }
  if (content instanceof Uint8Array) {
    return Buffer.from(content).toString('utf8');
  }
  return '';
}
