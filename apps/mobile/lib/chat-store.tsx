import {
  useChat as usePersonaChat,
  useThreads,
  useVoice,
  type PersonaVoiceState,
} from '@personaai/react';
import type {
  AgentFile,
  AgentTodo,
  PendingApproval,
  TranscriptTurn,
} from '@repo/contracts';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';

export const PERSONA_AGENT_ID = '6a82eda2b3d55db9792762cf';

export interface ApprovalDecision {
  type: 'approve' | 'reject';
  message?: string;
}

/** A conversation in the drawer. */
export interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

export interface VoiceControl {
  state: PersonaVoiceState;
  isMuted: boolean;
  isActive: boolean;
  start: () => Promise<void>;
  stop: () => void;
  mute: (muted: boolean) => void;
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
  /** Rejects on failure so the drawer's dialog can show it inline and stay open. */
  renameConversation: (id: string, title: string) => Promise<void>;
  /** Rejects on failure so the drawer's dialog can show it inline and stay open. */
  deleteConversation: (id: string) => Promise<void>;
  fileAt: (filePath: string) => AgentFile | null;
  voice: VoiceControl;
}

const ChatContext = createContext<ChatContextValue | null>(null);

function parseArgs(raw?: string): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [answeredIndices, setAnsweredIndices] = useState<number[]>([]);

  const {
    threads,
    createThread,
    deleteThread,
    renameThread,
    refetch: refetchThreads,
  } = useThreads();

  const voiceInstance = useVoice({
    agentId: PERSONA_AGENT_ID,
    threadId: activeId ?? undefined,
  });

  const {
    messages,
    sendMessage: personaSendMessage,
    isStreaming,
    isLoading,
    error: personaError,
    files: personaFiles,
    todos: personaTodos,
    interrupt,
    resumeInterrupt,
    clear: clearChat,
    loadThreadMessages,
  } = usePersonaChat({
    agentId: PERSONA_AGENT_ID,
    threadId: activeId ?? undefined,
    voice: voiceInstance,
  });

  const conversations: Conversation[] = useMemo(() => {
    return (threads ?? [])
      .filter((t) => !t.isArchived)
      .map((t) => ({
        id: t._id,
        title: t.title || 'New conversation',
        updatedAt: t.updatedAt || t.createdAt,
      }));
  }, [threads]);

  const turns = useMemo<TranscriptTurn[]>(() => {
    return messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content || '',
        toolCalls: (m.toolCalls ?? []).map((tc) => ({
          toolCallId: tc.toolCallId,
          toolName: tc.toolName.replace(/__/g, '.'),
          args: parseArgs(tc.args),
          result: tc.result ?? null,
          isError: tc.isError ?? false,
        })),
      }));
  }, [messages]);

  const todos = useMemo<AgentTodo[]>(() => {
    return (personaTodos ?? []).map((t) => ({
      content: t.content,
      status:
        t.status === 'completed' || t.status === 'done'
          ? 'completed'
          : t.status === 'in_progress'
            ? 'in_progress'
            : 'pending',
    }));
  }, [personaTodos]);

  const approvals = useMemo<PendingApproval[]>(() => {
    if (!interrupt || interrupt.kind !== 'hitl') return [];
    return interrupt.actionRequests.map((req, idx) => ({
      index: idx,
      toolName: req.name.replace(/__/g, '.'),
      description:
        ((req.args as Record<string, unknown>)?.description as string) ??
        req.name,
      args: (req.args as Record<string, unknown>) ?? {},
    }));
  }, [interrupt]);

  const newChat = useCallback(() => {
    setActiveId(null);
    setDraft('');
    setAnsweredIndices([]);
    clearChat();
  }, [clearChat]);

  const selectConversation = useCallback(
    (id: string) => {
      setActiveId(id);
      setDraft('');
      setAnsweredIndices([]);
      loadThreadMessages(id).catch((err) => {
        console.warn('Failed to load thread messages:', err);
      });
    },
    [loadThreadMessages],
  );

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming || isLoading) {
        return;
      }
      setDraft('');
      setAnsweredIndices([]);

      void (async () => {
        try {
          let threadId = activeId;
          if (!threadId) {
            const thread = await createThread(PERSONA_AGENT_ID);
            threadId = thread._id;
            setActiveId(threadId);
          }
          await personaSendMessage(trimmed, { threadId });
          void refetchThreads();
        } catch (err) {
          console.error('sendMessage failed:', err);
        }
      })();
    },
    [
      activeId,
      createThread,
      isLoading,
      isStreaming,
      personaSendMessage,
      refetchThreads,
    ],
  );

  const answerApproval = useCallback(
    (index: number, decision: ApprovalDecision) => {
      if (!interrupt || interrupt.kind !== 'hitl') return;
      setAnsweredIndices((prev) => [...prev, index]);
      void resumeInterrupt(
        {
          decisions: [
            {
              type: decision.type,
              message: decision.message,
            },
          ],
        },
        decision.type === 'approve' ? 'Approved' : 'Rejected',
      );
    },
    [interrupt, resumeInterrupt],
  );

  const renameConversation = useCallback(
    async (id: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      await renameThread(id, trimmed);
      void refetchThreads();
    },
    [refetchThreads, renameThread],
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      if (activeId === id) {
        newChat();
      }
      await deleteThread(id);
      void refetchThreads();
    },
    [activeId, deleteThread, newChat, refetchThreads],
  );

  const fileAt = useCallback(
    (filePath: string): AgentFile | null => {
      const f = personaFiles?.[filePath];
      if (!f) return null;
      return {
        path: filePath,
        content: f.content,
        size: f.size,
      };
    },
    [personaFiles],
  );

  const activeConversation = useMemo(() => {
    if (!activeId) return null;
    const conversation = conversations.find((item) => item.id === activeId);
    return conversation ? { ...conversation, turns } : null;
  }, [conversations, activeId, turns]);

  const isVoiceActive =
    voiceInstance.state !== 'idle' &&
    voiceInstance.state !== 'ended' &&
    voiceInstance.state !== 'error';

  const voice: VoiceControl = useMemo(
    () => ({
      state: voiceInstance.state,
      isMuted: voiceInstance.isMuted,
      isActive: isVoiceActive,
      start: voiceInstance.start,
      stop: voiceInstance.stop,
      mute: voiceInstance.mute,
    }),
    [
      voiceInstance.state,
      voiceInstance.isMuted,
      isVoiceActive,
      voiceInstance.start,
      voiceInstance.stop,
      voiceInstance.mute,
    ],
  );

  const value = useMemo<ChatContextValue>(
    () => ({
      conversations,
      activeConversation,
      turns,
      todos,
      approvals,
      answered: answeredIndices,
      pending: isStreaming || isLoading,
      error: personaError ? personaError.message : null,
      draft,
      setDraft,
      sendMessage,
      answerApproval,
      newChat,
      selectConversation,
      renameConversation,
      deleteConversation,
      fileAt,
      voice,
    }),
    [
      conversations,
      activeConversation,
      turns,
      todos,
      approvals,
      answeredIndices,
      isStreaming,
      isLoading,
      personaError,
      draft,
      sendMessage,
      answerApproval,
      newChat,
      selectConversation,
      renameConversation,
      deleteConversation,
      fileAt,
      voice,
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
    const bucket =
      age < day ? buckets[0] : age < 7 * day ? buckets[1] : buckets[2];
    bucket!.items.push(conversation);
  }

  return buckets.filter((bucket) => bucket.items.length > 0);
}
