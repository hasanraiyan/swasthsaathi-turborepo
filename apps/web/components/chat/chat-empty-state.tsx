"use client";

import * as React from "react";
import type { Icon } from "@phosphor-icons/react";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";

export interface ChatStarterPrompt {
  label: string;
  icon: Icon;
  template: string;
}

/**
 * Blank-conversation state — a title plus starter-prompt pills that
 * prefill (not auto-send) the composer, matching NotebookChat.js's
 * STARTER_PROMPTS pattern, generalized (no notebook/course wording baked
 * in — the caller supplies its own prompts and copy).
 */
function ChatEmptyState({
  title,
  description,
  starterPrompts,
  onSelectPrompt,
}: {
  title: string;
  description?: string;
  starterPrompts?: ChatStarterPrompt[];
  onSelectPrompt?: (template: string) => void;
}) {
  return (
    <Empty className="flex-1 border-none">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {starterPrompts?.length ? (
        <EmptyContent>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {starterPrompts.map(({ label, icon: PromptIcon, template }) => (
              <Button
                key={label}
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => onSelectPrompt?.(template)}
              >
                <PromptIcon /> {label}
              </Button>
            ))}
          </div>
        </EmptyContent>
      ) : null}
    </Empty>
  );
}

export { ChatEmptyState };
