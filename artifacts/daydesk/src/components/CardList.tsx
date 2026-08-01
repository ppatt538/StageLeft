import React, { useState } from 'react';
import { DaydeskObject } from '../types/daydesk';
import { ChecklistCard } from './cards/ChecklistCard';
import { NoteCard } from './cards/NoteCard';
import { ReminderCard } from './cards/ReminderCard';
import { LinkCard } from './cards/LinkCard';
import { MediaCard } from './cards/MediaCard';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckSquare, AlignLeft, Clock, Link as LinkIcon,
  Image as ImageIcon, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CardListProps {
  cards: DaydeskObject[];
  onUpdateCard: (card: DaydeskObject) => void;
}

// ─── Per-type icon + colour config ────────────────────────────────────────────
const TYPE_CONFIG: Record<string, {
  Icon: React.ComponentType<{ className?: string }>;
  bg: string;
  fg: string;
}> = {
  checklist: { Icon: CheckSquare,  bg: 'bg-emerald-50', fg: 'text-emerald-600' },
  note:      { Icon: AlignLeft,    bg: 'bg-stone-100',  fg: 'text-stone-500'   },
  reminder:  { Icon: Clock,        bg: 'bg-amber-50',   fg: 'text-amber-500'   },
  event:     { Icon: Clock,        bg: 'bg-amber-50',   fg: 'text-amber-500'   },
  link:      { Icon: LinkIcon,     bg: 'bg-sky-50',     fg: 'text-sky-500'     },
  media:     { Icon: ImageIcon,    bg: 'bg-violet-50',  fg: 'text-violet-500'  },
  poster:    { Icon: ImageIcon,    bg: 'bg-violet-50',  fg: 'text-violet-500'  },
};

// ─── Media title helper — replaces raw filenames ───────────────────────────
function getMediaDisplayTitle(
  title: string,
  payload: Record<string, unknown>,
): string {
  const isRawFilename =
    /\.(jpe?g|png|gif|webp|heic|avif|bmp|tiff?)$/i.test(title) ||
    /^(IMG|DSC|DCIM|image|photo|screenshot|file)[\s_.-]/i.test(title) ||
    /^\d{8}[_-]?\d{6}/i.test(title);   // 20240101_123456 camera convention

  if (!isRawFilename && title?.trim()) return title;

  const extracted = payload.extractedTitle as string | undefined;
  if (extracted?.trim()) return extracted.trim();

  return payload.imageUrl ? 'Captured image' : 'Photo';
}

// ─── Component ────────────────────────────────────────────────────────────────
export function CardList({ cards, onUpdateCard }: CardListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="flex flex-col space-y-2 pb-8">
      {cards.map(card => {
        const isExpanded = expandedId === card.id;
        const config = TYPE_CONFIG[card.type] ?? TYPE_CONFIG.note;
        const { Icon, bg, fg } = config;

        // ── Display title ─────────────────────────────────────────────────
        const displayTitle =
          card.type === 'media' || card.type === 'poster'
            ? getMediaDisplayTitle(card.title, card.payload)
            : card.title;

        // ── Subtitle ──────────────────────────────────────────────────────
        let subtitle = '';
        if (card.type === 'checklist') {
          const items = (card.payload.items as { done: boolean }[]) || [];
          const open = items.filter(i => !i.done).length;
          subtitle = open === 0
            ? `${items.length} items · all done`
            : `${open} of ${items.length} remaining`;
        } else if (card.type === 'link') {
          try {
            subtitle = new URL(card.payload.url as string).hostname.replace(/^www\./, '');
          } catch {
            subtitle = 'Link';
          }
        } else if (card.type === 'reminder') {
          if (card.payload.when) {
            const d = new Date(card.payload.when as string);
            subtitle = d.toLocaleDateString(undefined, {
              month: 'short', day: 'numeric',
              hour: 'numeric', minute: '2-digit',
            });
          }
        } else if (card.type === 'event') {
          if (card.payload.start) {
            const d = new Date(card.payload.start as string);
            subtitle = d.toLocaleDateString(undefined, {
              weekday: 'short', month: 'short', day: 'numeric',
            });
          }
        } else if (card.type === 'note') {
          const body = (card.payload.body as string) ?? '';
          const first = body.split('\n')[0].trim();
          if (first) subtitle = first.length > 60 ? first.slice(0, 60) + '…' : first;
        }

        return (
          <div
            key={card.id}
            className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-border/50 overflow-hidden transition-all"
          >
            {/* ── Row ──────────────────────────────────────────────────── */}
            <div
              className={cn(
                'flex items-center px-3.5 py-2.5 min-h-[52px] cursor-pointer',
                'hover:bg-black/[0.02] active:bg-black/[0.05] transition-colors',
              )}
              onClick={() => setExpandedId(isExpanded ? null : card.id)}
            >
              {/* Icon pill */}
              <div className={cn(
                'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mr-3',
                bg,
              )}>
                <Icon className={cn('h-[15px] w-[15px]', fg)} />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0 pr-2">
                <h4 className="font-semibold text-[13.5px] leading-snug tracking-[-0.1px] truncate text-foreground">
                  {displayTitle}
                </h4>
                {subtitle && (
                  <p className="text-[11.5px] font-medium text-muted-foreground/75 truncate mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>

              {/* Chevron */}
              <motion.div
                animate={{ rotate: isExpanded ? 90 : 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="text-muted-foreground/35 flex-shrink-0"
              >
                <ChevronRight className="h-4 w-4" />
              </motion.div>
            </div>

            {/* ── Expanded detail ───────────────────────────────────────── */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="border-t border-border/40"
                >
                  <div className="p-1 pb-3">
                    {(() => {
                      const props = {
                        card,
                        onUpdate: onUpdateCard,
                        className: 'shadow-none border-none rounded-none',
                        isMobileExpanded: true,
                      };
                      switch (card.type) {
                        case 'checklist': return <ChecklistCard {...props} />;
                        case 'note':      return <NoteCard {...props} />;
                        case 'reminder':
                        case 'event':     return <ReminderCard {...props} />;
                        case 'link':      return <LinkCard {...props} />;
                        case 'media':
                        case 'poster':    return <MediaCard {...props} />;
                        default:          return <NoteCard {...props} />;
                      }
                    })()}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
