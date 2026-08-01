import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, CheckSquare, FileText, Link2, Image, Calendar, Loader2, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DaydeskObject } from '../types/daydesk';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  meta?: { objectIds?: string[] };
}

interface ChatHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  allObjects: DaydeskObject[];
  onOpenCard?: (id: string) => void;
}

// ─── Card type → icon ─────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, React.ReactNode> = {
  checklist: <CheckSquare className="w-3 h-3" />,
  note: <FileText className="w-3 h-3" />,
  reminder: <Clock className="w-3 h-3" />,
  event: <Calendar className="w-3 h-3" />,
  link: <Link2 className="w-3 h-3" />,
  media: <Image className="w-3 h-3" />,
  poster: <Image className="w-3 h-3" />,
};

const PAGE_SIZE = 20;

// ─── ChatHistory panel ────────────────────────────────────────────────────────

export function ChatHistory({ isOpen, onClose, allObjects, onOpenCard }: ChatHistoryProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const objectsById = useRef<Map<string, DaydeskObject>>(new Map());

  // Keep a fast ID → object lookup current
  useEffect(() => {
    const m = new Map<string, DaydeskObject>();
    for (const obj of allObjects) m.set(obj.id, obj);
    objectsById.current = m;
  }, [allObjects]);

  // Load the most recent page when the panel opens
  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/messages?limit=${PAGE_SIZE}`);
      if (!res.ok) throw new Error('fetch failed');
      const data: ChatMessage[] = await res.json();
      setMessages(data);
      setHasMore(data.length === PAGE_SIZE);
    } catch {
      // silent — panel shows empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) loadInitial();
  }, [isOpen, loadInitial]);

  // Scroll to bottom after initial load
  useEffect(() => {
    if (!loading && messages.length > 0) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    }
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load earlier (cursor = oldest message's created_at)
  const loadEarlier = async () => {
    if (!hasMore || loadingEarlier || messages.length === 0) return;
    const oldest = messages[0].created_at;
    setLoadingEarlier(true);
    try {
      const res = await fetch(`/api/messages?limit=${PAGE_SIZE}&before=${encodeURIComponent(oldest)}`);
      if (!res.ok) throw new Error('fetch failed');
      const data: ChatMessage[] = await res.json();
      setMessages((prev) => [...data, ...prev]);
      setHasMore(data.length === PAGE_SIZE);
    } catch {
      // silent
    } finally {
      setLoadingEarlier(false);
    }
  };

  // Group consecutive messages by date for date separators
  const withDates = groupByDate(messages);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-50 hidden md:block"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="fixed top-0 right-0 bottom-0 w-full md:w-[420px] bg-background border-l border-border shadow-2xl z-50 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="font-semibold text-sm">Conversation history</span>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-1">
              {loading ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 mt-20 select-none">
                  <Clock className="w-8 h-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No messages yet.<br />Start chatting below.</p>
                </div>
              ) : (
                <>
                  {/* Load earlier button */}
                  {hasMore && (
                    <button
                      onClick={loadEarlier}
                      disabled={loadingEarlier}
                      className="self-center flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-full border border-border/50 hover:border-border transition-colors mb-2"
                    >
                      {loadingEarlier ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <ChevronUp className="w-3 h-3" />
                      )}
                      Load earlier
                    </button>
                  )}

                  {withDates.map((item) =>
                    item.type === 'date' ? (
                      <div key={item.key} className="flex items-center gap-3 my-3">
                        <div className="flex-1 h-px bg-border/40" />
                        <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest whitespace-nowrap">
                          {item.label}
                        </span>
                        <div className="flex-1 h-px bg-border/40" />
                      </div>
                    ) : (
                      <MessageBubble
                        key={item.message.id}
                        message={item.message}
                        objectsById={objectsById.current}
                        onOpenCard={(id) => { onClose(); onOpenCard?.(id); }}
                      />
                    ),
                  )}
                  <div ref={bottomRef} />
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Single message bubble ────────────────────────────────────────────────────

function MessageBubble({
  message,
  objectsById,
  onOpenCard,
}: {
  message: ChatMessage;
  objectsById: Map<string, DaydeskObject>;
  onOpenCard: (id: string) => void;
}) {
  const isUser = message.role === 'user';
  const cardIds: string[] = message.meta?.objectIds ?? [];
  const cards = cardIds.map((id) => objectsById.get(id)).filter(Boolean) as DaydeskObject[];

  return (
    <div className={cn('flex flex-col gap-1 mb-2', isUser ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-muted text-foreground rounded-bl-sm',
        )}
      >
        {message.content}
      </div>

      {/* Card chips — only on assistant messages with objectIds */}
      {!isUser && cards.length > 0 && (
        <div className="flex flex-wrap gap-1.5 max-w-[85%]">
          {cards.map((card) => (
            <button
              key={card.id}
              onClick={() => onOpenCard(card.id)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-card border border-border/60 rounded-lg text-xs text-foreground hover:bg-muted hover:border-border transition-colors shadow-sm"
            >
              <span className="text-muted-foreground">{TYPE_ICON[card.type] ?? <FileText className="w-3 h-3" />}</span>
              <span className="truncate max-w-[140px]">{card.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Date grouping ────────────────────────────────────────────────────────────

type DateItem = { type: 'date'; key: string; label: string };
type MessageItem = { type: 'message'; key: string; message: ChatMessage };

function groupByDate(messages: ChatMessage[]): (DateItem | MessageItem)[] {
  const result: (DateItem | MessageItem)[] = [];
  let lastDate = '';

  for (const msg of messages) {
    const dateKey = msg.created_at.slice(0, 10); // YYYY-MM-DD
    if (dateKey !== lastDate) {
      lastDate = dateKey;
      result.push({
        type: 'date',
        key: `date-${dateKey}`,
        label: formatDate(msg.created_at),
      });
    }
    result.push({ type: 'message', key: msg.id, message: msg });
  }

  return result;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
