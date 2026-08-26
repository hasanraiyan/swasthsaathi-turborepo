import type { AgentFile, AgentTodo, PendingApproval, TranscriptTurn } from '@repo/contracts';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Chat state for the interface, ahead of the stream being wired up.
 *
 * The shapes are the real ones from `@repo/contracts` -- `TranscriptTurn`,
 * `AgentFile`, `AgentTodo`, `PendingApproval` -- so connecting
 * `POST /api/agent/run` later replaces where this data comes from without
 * touching a single component.
 */

export interface Conversation {
  id: string;
  title: string;
  turns: TranscriptTurn[];
  todos: AgentTodo[];
  files: AgentFile[];
  pendingApprovals: PendingApproval[];
  updatedAt: string;
}

interface ChatContextValue {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  pending: boolean;
  draft: string;
  setDraft: (value: string) => void;
  sendMessage: (text: string) => void;
  newChat: () => void;
  selectConversation: (id: string) => void;
  /** Look a file up by the path a `present_file` card carries. */
  fileAt: (filePath: string) => AgentFile | null;
}

const ChatContext = createContext<ChatContextValue | null>(null);

const NOT_CONNECTED =
  "The assistant isn't connected yet. Your message is kept on this device so the chat can be tried out — nothing is sent anywhere.";

export function ChatProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>(mockConversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (replyTimer.current) {
        clearTimeout(replyTimer.current);
      }
    },
    [],
  );

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeId) ?? null,
    [conversations, activeId],
  );

  const newChat = useCallback(() => {
    setActiveId(null);
    setDraft('');
    setPending(false);
  }, []);

  const selectConversation = useCallback((id: string) => {
    setActiveId(id);
    setDraft('');
    setPending(false);
  }, []);

  const fileAt = useCallback(
    (filePath: string) =>
      conversations.flatMap((c) => c.files).find((file) => file.path === filePath) ?? null,
    [conversations],
  );

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }

      const now = new Date().toISOString();
      const turn: TranscriptTurn = {
        id: nextId('t'),
        role: 'user',
        content: trimmed,
        toolCalls: [],
      };

      const conversationId = activeId ?? nextId('c');
      setConversations((current) => {
        const existing = current.find((c) => c.id === conversationId);
        if (!existing) {
          return [
            {
              id: conversationId,
              title: titleFrom(trimmed),
              turns: [turn],
              todos: [],
              files: [],
              pendingApprovals: [],
              updatedAt: now,
            },
            ...current,
          ];
        }
        return current.map((c) =>
          c.id === conversationId ? { ...c, turns: [...c.turns, turn], updatedAt: now } : c,
        );
      });
      setActiveId(conversationId);
      setDraft('');
      setPending(true);

      // Stands in for the round trip so the waiting state is visible. It says
      // plainly that nothing is connected -- it never invents an answer.
      replyTimer.current = setTimeout(() => {
        setConversations((current) =>
          current.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  turns: [
                    ...c.turns,
                    { id: nextId('t'), role: 'assistant', content: NOT_CONNECTED, toolCalls: [] },
                  ],
                }
              : c,
          ),
        );
        setPending(false);
      }, 900);
    },
    [activeId],
  );

  const value = useMemo(
    () => ({
      conversations,
      activeConversation,
      pending,
      draft,
      setDraft,
      sendMessage,
      newChat,
      selectConversation,
      fileAt,
    }),
    [conversations, activeConversation, pending, draft, sendMessage, newChat, selectConversation, fileAt],
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

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}

function titleFrom(text: string): string {
  const firstLine = text.split('\n')[0]!.trim();
  return firstLine.length > 44 ? `${firstLine.slice(0, 44).trimEnd()}…` : firstLine;
}

function daysAgo(days: number, hour = 9): string {
  const date = new Date(Date.now() - days * 86_400_000);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

const APPOINTMENT_SHEET = `# Cardiology follow-up — 14 September

## Why I am here
Six-month review after starting Amlodipine.

## What has changed
- Blood pressure down from 148/94 to 128/82 across six readings
- Two missed evening doses in the last month
- Occasional ankle swelling in the evenings

## What I am taking
- Metformin 500 mg, twice a day, after food
- Amlodipine 5 mg, once in the morning

## What I want to ask
1. Is the ankle swelling related to the Amlodipine?
2. Should the evening Metformin move earlier?
3. When is the next blood test due?
`;

/**
 * Placeholder history, written to exercise every part of the interface --
 * a tool trace, a produced file, a plan, and a pending approval. It goes away
 * with the first real stream.
 */
const mockConversations: Conversation[] = [
  {
    id: 'c_mock_1',
    title: 'Preparing for the cardiology visit',
    updatedAt: daysAgo(0, 8),
    todos: [
      { content: 'Read the upcoming appointment', status: 'completed' },
      { content: 'Check recent blood pressure readings', status: 'completed' },
      { content: 'Write the summary sheet', status: 'in_progress' },
      { content: 'Note questions to ask', status: 'pending' },
    ],
    files: [{ path: '/workspace/outputs/appointment-2026-09-14.md', content: APPOINTMENT_SHEET, size: APPOINTMENT_SHEET.length }],
    pendingApprovals: [],
    turns: [
      {
        id: 't1',
        role: 'user',
        content: 'I have a cardiology appointment next week. Can you help me get ready?',
        toolCalls: [],
      },
      {
        id: 't2',
        role: 'assistant',
        content:
          'I have put together a page you can take with you. Your blood pressure has come down from 148/94 to 128/82 since starting Amlodipine, which is worth mentioning — as are the two evening doses you missed last month.',
        toolCalls: [
          {
            toolCallId: 'call_1',
            toolName: 'appointments.list',
            args: { upcomingOnly: true },
            result: '{"items":[{"title":"Cardiology follow-up","scheduledFor":"2026-09-14T10:30:00+05:30"}],"total":1}',
            isError: false,
          },
          {
            toolCallId: 'call_2',
            toolName: 'measurements.trend',
            args: { type: 'blood_pressure' },
            result: '{"count":6,"average":128,"averageSecondary":82,"min":120,"max":138}',
            isError: false,
          },
          {
            toolCallId: 'call_3',
            toolName: 'present_file',
            args: {
              filePath: '/workspace/outputs/appointment-2026-09-14.md',
              title: 'Cardiology follow-up sheet',
              description: 'One page to take with you on the 14th',
            },
            result: '{"presented":true}',
            isError: false,
          },
        ],
      },
    ],
  },
  {
    id: 'c_mock_2',
    title: 'How has my blood pressure been?',
    updatedAt: daysAgo(3, 19),
    todos: [],
    files: [],
    pendingApprovals: [],
    turns: [
      { id: 't3', role: 'user', content: 'How has my blood pressure been?', toolCalls: [] },
      {
        id: 't4',
        role: 'assistant',
        content:
          'Your last six readings averaged 128/82, down from 136/88 the month before. That is a real improvement, and the kind of trend worth showing your doctor.',
        toolCalls: [
          {
            toolCallId: 'call_4',
            toolName: 'measurements.trend',
            args: { type: 'blood_pressure', from: '2026-07-01' },
            result: '{"count":6,"average":128,"averageSecondary":82}',
            isError: false,
          },
        ],
      },
    ],
  },
  {
    id: 'c_mock_3',
    title: 'Stopping the evening tablet',
    updatedAt: daysAgo(11, 15),
    todos: [],
    files: [],
    pendingApprovals: [
      {
        index: 0,
        toolName: 'medicines.stop',
        args: { id: '6a8dad11ef36036d8005955b', reason: 'Doctor advised stopping' },
        description: 'Mark Metformin as stopped. Reminders stop; your history is kept.',
      },
    ],
    turns: [
      {
        id: 't5',
        role: 'user',
        content: 'My doctor said to stop the evening Metformin.',
        toolCalls: [],
      },
      {
        id: 't6',
        role: 'assistant',
        content: 'I can mark that as stopped. It will keep everything you have already recorded.',
        toolCalls: [],
      },
    ],
  },
];
