import { tool } from '@langchain/core/tools';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * Hand a file to the user.
 *
 * Writes nothing and reads nothing -- it exists so the agent can say "look at
 * this one" and have the app open it, instead of pasting a whole document
 * into the conversation where it cannot be saved or reread. The run emits a
 * `file.presented` event when this returns.
 */
export function presentFileTool(): StructuredToolInterface {
  return tool(
    ({ filePath, title, description }) =>
      Promise.resolve(
        JSON.stringify({
          presented: true,
          filePath,
          title: title ?? filePath.split('/').pop() ?? filePath,
          description: description ?? '',
        }),
      ),
    {
      name: 'present_file',
      description:
        'Show a file you have written to the user, so it opens in the app. Use it after writing something they should keep, such as a summary to take to a doctor. Do not also paste the file contents into your reply.',
      schema: z.object({
        filePath: z
          .string()
          .min(1)
          .describe(
            'Path of the file to show, e.g. "/workspace/outputs/appointment-2026-09-14.md"',
          ),
        title: z
          .string()
          .max(120)
          .optional()
          .describe('Short name for the card'),
        description: z
          .string()
          .max(300)
          .optional()
          .describe('One line on why this is worth opening'),
      }),
    },
  ) as StructuredToolInterface;
}
