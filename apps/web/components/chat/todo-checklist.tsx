"use client";

import * as React from "react";
import { CheckCircleIcon, ClockIcon, CircleIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { ChatTodo } from "./types";

function TodoStatusIcon({ status }: { status: ChatTodo["status"] }) {
  if (status === "completed") {
    return (
      <CheckCircleIcon weight="fill" className="size-[15px] shrink-0 text-primary" />
    );
  }
  if (status === "in_progress") {
    return <ClockIcon className="size-[15px] shrink-0 text-primary" />;
  }
  return <CircleIcon className="size-[15px] shrink-0 text-muted-foreground/40" />;
}

// Dostify-style plan list: bare, tightly-spaced rows — no bordered cards, no
// progress bar. Completed steps strike through and fade; the in-progress step
// is semibold; pending steps stay quiet.
function TodoChecklist({
  todos,
  className,
}: {
  todos: ChatTodo[];
  className?: string;
}) {
  if (!todos?.length) return null;

  return (
    <ul className={cn("flex flex-col", className)}>
      {todos.map((todo, i) => {
        const isCompleted = todo.status === "completed";
        const isInProgress = todo.status === "in_progress";

        return (
          <li key={i} className="flex items-start gap-2 py-[3px]">
            <span className="mt-px shrink-0">
              <TodoStatusIcon status={todo.status} />
            </span>
            <span
              className={cn(
                "min-w-0 flex-1 wrap-break-word text-[12.5px] leading-5",
                isCompleted
                  ? "text-muted-foreground/70 line-through"
                  : isInProgress
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground"
              )}
            >
              {todo.content}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export { TodoChecklist, TodoStatusIcon };
