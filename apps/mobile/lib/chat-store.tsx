import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Frontend-only chat state.
 *
 * There is no chatbot backend yet, so conversations live in memory and are
 * seeded with mock history. Everything a real implementation would need is
 * already shaped here -- conversations, messages, a pending flag -- so wiring
 * a service in later means replacing the bodies of `sendMessage` and the
 * initial load, not reworking the screens.
 */

export type ChatRole = 'user' | 'assistant' | 'notice';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: string;
}

interface ChatContextValue {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  /** True while the (not yet built) assistant would be composing a reply. */
  pending: boolean;
  /** Text in the composer. Lives here so a capability card can prefill it. */
  draft: string;
  setDraft: (value: string) => void;
  sendMessage: (text: string) => void;
  newChat: () => void;
  selectConversation: (id: string) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

/** The reply a message gets until the assistant is actually connected. */
const NOT_CONNECTED_NOTICE =
  "The health assistant isn't connected yet. Your message is kept on this device so the chat can be tried out — nothing is sent anywhere.";

export function ChatProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>(mockConversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A reply landing after the screen has gone would set state on nothing.
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

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }

      const now = new Date().toISOString();
      const message: ChatMessage = {
        id: nextId('m'),
        role: 'user',
        text: trimmed,
        createdAt: now,
      };

      // Sending from an empty chat is what brings a conversation into
      // existence, so the drawer never lists a thread with nothing in it.
      const conversationId = activeId ?? nextId('c');
      setConversations((current) => {
        const existing = current.find((conversation) => conversation.id === conversationId);
        if (!existing) {
          return [
            { id: conversationId, title: titleFrom(trimmed), messages: [message], updatedAt: now },
            ...current,
          ];
        }
        return current.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, messages: [...conversation.messages, message], updatedAt: now }
            : conversation,
        );
      });
      setActiveId(conversationId);
      setDraft('');
      setPending(true);

      // Stands in for the round trip, so the pending state is visible. It
      // appends an honest notice -- never invented assistant content.
      replyTimer.current = setTimeout(() => {
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  messages: [
                    ...conversation.messages,
                    {
                      id: nextId('m'),
                      role: 'notice',
                      text: NOT_CONNECTED_NOTICE,
                      createdAt: new Date().toISOString(),
                    },
                  ],
                }
              : conversation,
          ),
        );
        setPending(false);
      }, 700);
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
    }),
    [conversations, activeConversation, pending, draft, sendMessage, newChat, selectConversation],
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

  const sorted = [...conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  for (const conversation of sorted) {
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

/** A thread's name is its opening question, trimmed to fit the drawer. */
function titleFrom(text: string): string {
  const firstLine = text.split('\n')[0]!.trim();
  return firstLine.length > 44 ? `${firstLine.slice(0, 44).trimEnd()}…` : firstLine;
}

function daysAgo(days: number, hour = 9): string {
  const date = new Date(Date.now() - days * 86_400_000);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

/**
 * Placeholder history so the drawer can be designed and tried out.
 *
 * Assistant turns here are written as plausible product copy for layout
 * purposes only -- they are fixtures, not generated answers, and they go away
 * with the first real backend.
 */
const mockConversations: Conversation[] = [
  {
    id: 'c_mock_1',
    title: 'What do I take in the morning?',
    updatedAt: daysAgo(0, 8),
    messages: [
      {
        id: 'm_mock_1',
        role: 'user',
        text: 'What do I take in the morning?',
        createdAt: daysAgo(0, 8),
      },
      {
        id: 'm_mock_2',
        role: 'assistant',
        text: 'Metformin 500 mg, one tablet after breakfast. It was due at 08:00 and is still marked pending.',
        createdAt: daysAgo(0, 8),
      },
    ],
  },
  {
    id: 'c_mock_2',
    title: 'How has my blood pressure been?',
    updatedAt: daysAgo(3, 19),
    messages: [
      {
        id: 'm_mock_3',
        role: 'user',
        text: 'How has my blood pressure been?',
        createdAt: daysAgo(3, 19),
      },
      {
        id: 'm_mock_4',
        role: 'assistant',
        text: 'Your last six readings averaged 128/82, down from 136/88 the month before.',
        createdAt: daysAgo(3, 19),
      },
    ],
  },
  {
    id: 'c_mock_3',
    title: 'Preparing for the cardiology follow-up',
    updatedAt: daysAgo(11, 15),
    messages: [
      {
        id: 'm_mock_5',
        role: 'user',
        text: 'What should I bring to the cardiology follow-up?',
        createdAt: daysAgo(11, 15),
      },
      {
        id: 'm_mock_6',
        role: 'assistant',
        text: 'Your last lipid panel, the blood pressure log since March, and the list of what you are currently taking.',
        createdAt: daysAgo(11, 15),
      },
    ],
  },
];
