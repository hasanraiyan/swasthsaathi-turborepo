import { useAuth } from '@clerk/expo';
import type {
  AgentFile,
  AgentTodo,
  ChatSession,
  ListResult,
  PendingApproval,
  SessionState,
  TranscriptTurn,
} from '@repo/contracts';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { SwasthyaAgent, turnsFrom, workspaceFrom, type ApprovalDecision } from './agent';
import { ApiError, createApiClient } from './api';

/**
 * The chat, as the app holds it.
 *
 * Two sources, kept deliberately apart. `GET /sessions/:id/messages` gives the
 * conversation as it was left, and the AG-UI agent gives what has happened
 * since -- so the thread is the restored turns followed by the live ones, and
 * neither has to be reconciled against the other.
 */

/** A conversation in the drawer. */
export interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

interface ChatContextValue {
  conversations: Conversation[];
  activeConversation: (Conversation & { turns: TranscriptTurn[] }) | null;
  turns: TranscriptTurn[];
  todos: AgentTodo[];
  approvals: PendingApproval[];
  /** Approvals already answered, waiting on the rest before resuming. */
  answered: number[];
  pending: boolean;
  error: string | null;
  draft: string;
  setDraft: (value: string) => void;
  sendMessage: (text: string) => void;
  answerApproval: (index: number, decision: ApprovalDecision) => void;
  newChat: () => void;
  selectConversation: (id: string) => void;
  fileAt: (filePath: string) => AgentFile | null;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { getToken, isSignedIn } = useAuth();
  const api = useMemo(() => createApiClient(() => getToken()), [getToken]);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // What the server had, and what has happened since, held separately.
  const [restored, setRestored] = useState<TranscriptTurn[]>([]);
  const [live, setLive] = useState<TranscriptTurn[]>([]);
  const [files, setFiles] = useState<AgentFile[]>([]);
  const [todos, setTodos] = useState<AgentTodo[]>([]);
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [answers, setAnswers] = useState<Record<number, ApprovalDecision>>({});

  const agentRef = useRef<SwasthyaAgent | null>(null);
  // Which conversation is open, readable from inside a run that is already
  // under way -- state would be the value captured when the run started.
  const activeIdRef = useRef<string | null>(null);

  const setActive = useCallback((id: string | null) => {
    activeIdRef.current = id;
    setActiveId(id);
  }, []);

  useEffect(() => {
    if (!isSignedIn) {
      return;
    }
    let cancelled = false;
    api
      .get<ListResult<ChatSession>>('/sessions', { limit: 50 })
      .then((result) => {
        if (!cancelled) {
          setConversations(result.items.map(toConversation));
        }
      })
      .catch(() => {
        // A failed list leaves the drawer empty; it is not worth interrupting
        // someone who only wants to ask a question.
      });
    return () => {
      cancelled = true;
    };
  }, [api, isSignedIn]);

  /** Everything that belongs to one conversation, cleared together. */
  const resetThread = useCallback(() => {
    agentRef.current?.abortRun();
    agentRef.current = null;
    setRestored([]);
    setLive([]);
    setFiles([]);
    setTodos([]);
    setApprovals([]);
    setAnswers({});
    setPending(false);
    setError(null);
    setDraft('');
  }, []);

  const newChat = useCallback(() => {
    resetThread();
    setActive(null);
  }, [resetThread, setActive]);

  /**
   * Wire an agent up to this component's state.
   *
   * Both `onNewMessage` and `onMessagesChanged` re-read the whole list:
   * adding the user's own message fires only the first, and streamed replies
   * only the second, so listening to one of them would leave the thread a
   * turn behind.
   */
  const attach = useCallback((agent: SwasthyaAgent) => {
    const sync = () => setLive(turnsFrom(agent.messages));
    agent.subscribe({
      onNewMessage: sync,
      onMessagesChanged: sync,
      onStateChanged: () => {
        const workspace = workspaceFrom(agent.state);
        setFiles(workspace.files);
        setTodos(workspace.todos);
      },
      onCustomEvent: ({ event }) => {
        if (event.name === 'tool.confirmation_required') {
          setApprovals((current) => [...current, event.value as PendingApproval]);
        }
        if (event.name === 'session.title') {
          const { sessionId, title } = event.value as { sessionId: string; title: string };
          setConversations((current) =>
            current.map((item) => (item.id === sessionId ? { ...item, title } : item)),
          );
        }
      },
      // A run that fails ends by resolving, not by throwing, so this is the
      // only place a rate limit or a model failure can be caught.
      onRunErrorEvent: ({ event }) => setError(event.message),
    });
    return agent;
  }, []);

  /**
   * Take the conversation from the server.
   *
   * Also run once a stream settles, which is what keeps a live answer and the
   * same answer after a reload identical: the API merges an assistant's
   * messages and folds each tool result onto its call, and a resumed run
   * carries a result whose call was made before the stream even opened. The
   * agent is dropped at the same time, since what it was holding has just
   * become part of the restored conversation.
   */
  const refresh = useCallback(
    async (sessionId: string) => {
      const state = await api.get<SessionState>(`/sessions/${sessionId}/messages`);
      if (activeIdRef.current !== sessionId) {
        // Moved on while this was in flight -- starting a new chat during an
        // answer must not pull the old conversation back onto the screen.
        return;
      }
      agentRef.current = null;
      setLive([]);
      setRestored(state.messages);
      setFiles(state.files);
      setTodos(state.todos);
      // A conversation left waiting on a write is still waiting on it.
      setApprovals(state.pendingApprovals);
      setAnswers({});
    },
    [api],
  );

  const selectConversation = useCallback(
    (id: string) => {
      resetThread();
      setActive(id);
      refresh(id).catch((cause: unknown) => setError(messageFor(cause)));
    },
    [refresh, resetThread, setActive],
  );

  /** The agent for the open conversation, made on first use. */
  const agentFor = useCallback(
    (sessionId: string) => {
      if (!agentRef.current) {
        agentRef.current = attach(new SwasthyaAgent(sessionId, () => getToken()));
      }
      return agentRef.current;
    },
    [attach, getToken],
  );

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || pending) {
        return;
      }
      setDraft('');
      setError(null);
      setPending(true);

      void (async () => {
        try {
          // A new chat becomes a real session before the first message, so
          // the run has somewhere to be checkpointed and the drawer has a
          // row to rename once the title lands.
          let sessionId = activeId;
          if (!sessionId) {
            const session = await api.post<ChatSession>('/sessions', {});
            sessionId = session.id;
            setConversations((current) => [toConversation(session), ...current]);
            setActive(session.id);
          }

          await agentFor(sessionId).ask(trimmed);
          // Only on success: a failed read would otherwise wipe the answer
          // that just arrived.
          await refresh(sessionId).catch(() => undefined);
        } catch (cause) {
          setError(messageFor(cause));
        } finally {
          setPending(false);
        }
      })();
    },
    [activeId, agentFor, api, pending, refresh, setActive],
  );

  /**
   * Record one answer, and resume once every pending write has one.
   *
   * The API takes a decision per pending action in the order they were
   * offered. Sending as soon as the first button is pressed would answer the
   * others by omission, so the run stays paused until the set is complete --
   * which, for a single pending write, is immediately.
   */
  const answerApproval = useCallback(
    (index: number, decision: ApprovalDecision) => {
      const next = { ...answers, [index]: decision };
      setAnswers(next);

      const ordered = [...approvals].sort((a, b) => a.index - b.index);
      if (!activeId || ordered.some((approval) => !next[approval.index])) {
        return;
      }

      setPending(true);
      setApprovals([]);
      setAnswers({});
      void (async () => {
        try {
          await agentFor(activeId).decide(ordered.map((approval) => next[approval.index]!));
          await refresh(activeId).catch(() => undefined);
        } catch (cause) {
          setError(messageFor(cause));
        } finally {
          setPending(false);
        }
      })();
    },
    [activeId, agentFor, answers, approvals, refresh],
  );

  const turns = useMemo(() => [...restored, ...live], [restored, live]);

  const activeConversation = useMemo(() => {
    const conversation = conversations.find((item) => item.id === activeId);
    return conversation ? { ...conversation, turns } : null;
  }, [conversations, activeId, turns]);

  const fileAt = useCallback(
    (filePath: string) => files.find((file) => file.path === filePath) ?? null,
    [files],
  );

  const value = useMemo(
    () => ({
      conversations,
      activeConversation,
      turns,
      todos,
      approvals,
      answered: Object.keys(answers).map(Number),
      pending,
      error,
      draft,
      setDraft,
      sendMessage,
      answerApproval,
      newChat,
      selectConversation,
      fileAt,
    }),
    [
      conversations,
      activeConversation,
      turns,
      todos,
      approvals,
      answers,
      pending,
      error,
      draft,
      sendMessage,
      answerApproval,
      newChat,
      selectConversation,
      fileAt,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used inside <ChatProvider>');
  }
  return context;
}

/** Group conversations the way a person thinks about them, not by raw date. */
export function groupConversations(
  conversations: Conversation[],
): Array<{ label: string; items: Conversation[] }> {
  const now = Date.now();
  const day = 86_400_000;
  const buckets: Array<{ label: string; items: Conversation[] }> = [
    { label: 'Today', items: [] },
    { label: 'Previous 7 days', items: [] },
    { label: 'Earlier', items: [] },
  ];

  for (const conversation of [...conversations].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  )) {
    const age = now - new Date(conversation.updatedAt).getTime();
    const bucket = age < day ? buckets[0] : age < 7 * day ? buckets[1] : buckets[2];
    bucket!.items.push(conversation);
  }

  return buckets.filter((bucket) => bucket.items.length > 0);
}

/** Ordered by when it was last spoken in, not when the record changed. */
function toConversation(session: ChatSession): Conversation {
  return {
    id: session.id,
    title: session.title,
    updatedAt: session.lastMessageAt ?? session.updatedAt,
  };
}

function messageFor(cause: unknown): string {
  if (cause instanceof ApiError) {
    return cause.userMessage;
  }
  return 'Something went wrong. Try again.';
}
