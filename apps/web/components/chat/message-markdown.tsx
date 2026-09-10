"use client";

import * as React from "react";
import { Streamdown } from "streamdown";
import remarkGfm from "remark-gfm";
import { code } from "@streamdown/code";
import { cn } from "@/lib/utils";

/**
 * Every markdown render in the library goes through this one wrapper.
 * `Streamdown` is purpose-built for partial/incomplete markdown mid-stream
 * (unclosed code fences, half-written tables) — the exact problem the
 * NotebookChat.js reference solved by hand, switching between a raw
 * streaming renderer and a full block renderer once a message finished.
 * One renderer, used for both states, is simpler and doesn't need that split.
 */
function MessageMarkdown({
  className,
  content,
  muted = false,
}: {
  className?: string;
  content: string;
  /** Render in muted tones (used for reasoning/thinking blocks). */
  muted?: boolean;
}) {
  return (
    <Streamdown
      className={cn(
        // Exactly one root color: streamdown text (and fenced code that inherits
        // rather than self-coloring) reads either foreground or muted. Appending
        // both would leave the winner to CSS source order, so muted swaps rather
        // than stacks. Links/inline chips below stay colorful in either state.
        "max-w-none text-xs/relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        muted ? "text-muted-foreground" : "text-foreground",
        "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4",
        // Only inline code gets our chip styling — fenced code blocks are
        // fully owned by Streamdown's own code-block renderer (header bar +
        // token colors from the `code` plugin); adding another border/bg/
        // padding layer around its <pre>/<code> just nests boxes inside
        // boxes.
        "[&_code:not(pre_code)]:rounded-none [&_code:not(pre_code)]:bg-muted [&_code:not(pre_code)]:px-1 [&_code:not(pre_code)]:py-0.5 [&_code:not(pre_code)]:text-xs",
        "[&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-sm [&_h1]:font-semibold",
        "[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold",
        "[&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-xs [&_h3]:font-semibold",
        "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
        "[&_p]:my-2",
        // Wrap fenced code instead of letting it scroll horizontally —
        // a long unbroken line otherwise forces the code block wider than
        // its flex ancestors are willing to shrink to, which overflows the
        // whole page sideways on narrow (mobile) viewports.
        "[&_[data-streamdown=code-block-body]]:overflow-x-visible!",
        "[&_[data-streamdown=code-block-body]_pre]:whitespace-pre-wrap! [&_[data-streamdown=code-block-body]_pre]:break-words!",
        "[&_[data-streamdown=code-block-body]_code]:whitespace-pre-wrap! [&_[data-streamdown=code-block-body]_code]:break-words!",
        "[&_table]:my-2 [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1",
        className
      )}
      remarkPlugins={[remarkGfm]}
      plugins={{ code }}
    >
      {content}
    </Streamdown>
  );
}

export { MessageMarkdown };
