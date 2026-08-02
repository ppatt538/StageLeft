import React, { useState, useRef, useEffect } from 'react';
import { DaydeskObject } from '../types/daydesk';
import { ChecklistCard } from './cards/ChecklistCard';
import { NoteCard } from './cards/NoteCard';
import { ReminderCard } from './cards/ReminderCard';
import { LinkCard } from './cards/LinkCard';
import { MediaCard } from './cards/MediaCard';
import {
  motion, AnimatePresence,
  useMotionValue, useTransform,
  animate as motionAnimate,
} from 'framer-motion';
import {
  CheckSquare, AlignLeft, Clock, Link as LinkIcon,
  Image as ImageIcon, ChevronRight,
  CalendarDays, Pin, Trash2, Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CardListProps {
  cards: DaydeskObject[];
  onUpdateCard: (card: DaydeskObject) => void;
  /** Called when a swipe action changes a card's bucket, status, or pin state. */
  onMoveCard?: (id: string, updates: { bucket?: string; status?: string; priority?: number }) => void;
  onDeleteCard?: (id: string) => void;
  onOpenCard?: (card: DaydeskObject) => void;
}

// ─── Per-type icon + colour config ───────────────────────────────────────────

const TYPE_CONFIG: Record<string, {
  Icon: React.ComponentType<{ className?: string }>;
  bg: string;
  fg: string;
}> = {
  checklist: { Icon: CheckSquare, bg: 'bg-[#edf4ee]', fg: 'text-[#3d6e50]' },
  note:      { Icon: AlignLeft,   bg: 'bg-[#f3f2ef]', fg: 'text-[#5e5a55]' },
  reminder:  { Icon: Clock,       bg: 'bg-[#f5f1e8]', fg: 'text-[#7a6030]' },
  event:     { Icon: Clock,       bg: 'bg-[#f5f1e8]', fg: 'text-[#7a6030]' },
  link:      { Icon: LinkIcon,    bg: 'bg-[#edf1f7]', fg: 'text-[#3a5272]' },
  media:     { Icon: ImageIcon,   bg: 'bg-[#f1eef7]', fg: 'text-[#5c4878]' },
  poster:    { Icon: ImageIcon,   bg: 'bg-[#f1eef7]', fg: 'text-[#5c4878]' },
};

// ─── Media title helper ───────────────────────────────────────────────────────

function getMediaDisplayTitle(title: string, payload: Record<string, unknown>): string {
  const isRawFilename =
    /\.(jpe?g|png|gif|webp|heic|avif|bmp|tiff?)$/i.test(title) ||
    /^(IMG|DSC|DCIM|image|photo|screenshot|file)[\s_.-]/i.test(title) ||
    /^\d{8}[_-]?\d{6}/i.test(title);

  if (!isRawFilename && title?.trim()) return title;
  const extracted = payload.extractedTitle as string | undefined;
  if (extracted?.trim()) return extracted.trim();
  return payload.imageUrl ? 'Captured image' : 'Photo';
}

// ─── Swipe geometry ───────────────────────────────────────────────────────────

const LEFT_STRIP_W  = 184; // 3 × ~58px buttons + gaps
const RIGHT_STRIP_W = 72;  // 1 × 64px edit button
const AUTO_DELETE_X = -(LEFT_STRIP_W * 1.7); // commit-to-delete threshold

// ─── Action button ────────────────────────────────────────────────────────────

function ActionBtn({
  icon: Icon, label, colorClass, onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  colorClass: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        'flex flex-col items-center justify-center gap-0.5 shrink-0',
        'w-14 h-14 rounded-xl text-[10px] font-semibold tracking-wide',
        colorClass,
      )}
      // Stop propagation so the card row's pointer handlers don't fire
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <Icon className="w-[17px] h-[17px]" />
      {label}
    </button>
  );
}

// ─── SwipeableCard ────────────────────────────────────────────────────────────

interface SwipeableCardProps {
  card: DaydeskObject;
  isExpanded: boolean;
  onToggleExpand: () => void;
  openSwipeId: string | null;
  onSetOpenSwipe: (id: string | null) => void;
  onUpdateCard: (card: DaydeskObject) => void;
  onMoveCard?: (id: string, updates: { bucket?: string; status?: string; priority?: number }) => void;
  onDeleteCard?: (id: string) => void;
  onOpenCard?: (card: DaydeskObject) => void;
}

function SwipeableCard({
  card, isExpanded, onToggleExpand,
  openSwipeId, onSetOpenSwipe,
  onUpdateCard, onMoveCard, onDeleteCard, onOpenCard,
}: SwipeableCardProps) {
  const x = useMotionValue(0);

  // Which strip is currently snapped open: 'left' | 'right' | null
  const [stripDir, setStripDir] = useState<'left' | 'right' | null>(null);

  const hasDragged     = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  const isThisOpen = openSwipeId === card.id;

  // ── Opacity transforms (visual feedback while dragging) ───────────────────

  const leftOpacity  = useTransform(x, [-LEFT_STRIP_W, -30, 0], [1, 0.7, 0]);
  const rightOpacity = useTransform(x, [0, 30, RIGHT_STRIP_W], [0, 0.7, 1]);

  // ── Close when another card opens ────────────────────────────────────────

  useEffect(() => {
    if (!isThisOpen && x.get() !== 0) {
      motionAnimate(x, 0, { type: 'spring', damping: 32, stiffness: 420 });
      setStripDir(null);
    }
  }, [openSwipeId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);

  // ── Snap helpers ─────────────────────────────────────────────────────────

  const snapBack = () => {
    motionAnimate(x, 0, { type: 'spring', damping: 32, stiffness: 420 });
    setStripDir(null);
    onSetOpenSwipe(null);
  };

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleMoveToWeek = () => {
    snapBack();
    if (onMoveCard) onMoveCard(card.id, { bucket: 'week' });
    else onUpdateCard({ ...card, bucket: 'week' });
  };

  const handlePin = () => {
    snapBack();
    const nextPriority = card.priority >= 1 ? 0 : 1;
    if (onMoveCard) onMoveCard(card.id, { priority: nextPriority });
    else onUpdateCard({ ...card, priority: nextPriority });
  };

  const handleDelete = () => {
    snapBack();
    setTimeout(() => {
      if (onDeleteCard) onDeleteCard(card.id);
      else onUpdateCard({ ...card, status: 'discarded' });
    }, 110);
  };

  const handleEdit = () => {
    snapBack();
    onOpenCard?.(card);
  };

  // ── Drag events ───────────────────────────────────────────────────────────

  const handleDragStart = () => {
    hasDragged.current = false;
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    onSetOpenSwipe(card.id);
  };

  const handleDrag = (_: unknown, info: { offset: { x: number } }) => {
    if (Math.abs(info.offset.x) > 6) hasDragged.current = true;
  };

  const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    const { offset, velocity } = info;
    const goLeft  = offset.x < -36 || velocity.x < -400;
    const goRight = offset.x >  36 || velocity.x >  400;

    if (goLeft && !goRight) {
      if (offset.x < AUTO_DELETE_X) {
        handleDelete();
      } else {
        motionAnimate(x, -LEFT_STRIP_W, { type: 'spring', damping: 30, stiffness: 360 });
        setStripDir('left');
      }
    } else if (goRight && !goLeft) {
      motionAnimate(x, RIGHT_STRIP_W, { type: 'spring', damping: 30, stiffness: 360 });
      setStripDir('right');
    } else {
      snapBack();
    }
  };

  // ── Long-press ────────────────────────────────────────────────────────────

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      onOpenCard?.(card);
    }, 520);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.movementX ** 2 + e.movementY ** 2 > 25) cancelLongPress();
  };

  // ── Row tap ───────────────────────────────────────────────────────────────

  const handleRowClick = () => {
    if (hasDragged.current || longPressFired.current) return;
    if (x.get() !== 0) { snapBack(); return; }
    onToggleExpand();
  };

  // ── Display helpers ───────────────────────────────────────────────────────

  const { Icon, bg, fg } = TYPE_CONFIG[card.type] ?? TYPE_CONFIG.note;

  const displayTitle =
    card.type === 'media' || card.type === 'poster'
      ? getMediaDisplayTitle(card.title, card.payload)
      : card.title;

  let subtitle = '';
  if (card.type === 'checklist') {
    const items = (card.payload.items as { done: boolean }[]) || [];
    const open = items.filter((i) => !i.done).length;
    subtitle = open === 0 ? `${items.length} items · all done` : `${open} of ${items.length} remaining`;
  } else if (card.type === 'link') {
    try { subtitle = new URL(card.payload.url as string).hostname.replace(/^www\./, ''); }
    catch { subtitle = 'Link'; }
  } else if (card.type === 'reminder' && card.payload.when) {
    const d = new Date(card.payload.when as string);
    subtitle = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } else if (card.type === 'event' && card.payload.start) {
    const d = new Date(card.payload.start as string);
    subtitle = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  } else if (card.type === 'note') {
    const body = (card.payload.body as string) ?? '';
    const first = body.split('\n')[0].trim();
    if (first) subtitle = first.length > 60 ? first.slice(0, 60) + '…' : first;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative overflow-hidden rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-border/50">

      {/* Left-swipe strip — sits on the right, visible when card slides left */}
      <motion.div
        style={{ opacity: leftOpacity }}
        className={cn(
          'absolute inset-y-0 right-0 flex items-center gap-1.5 pr-2',
          stripDir !== 'left' && 'pointer-events-none',
        )}
      >
        <ActionBtn icon={CalendarDays} label="Week"   colorClass="bg-blue-500 text-white"  onClick={handleMoveToWeek} />
        <ActionBtn icon={Pin}          label="Pin"    colorClass="bg-amber-400 text-white"  onClick={handlePin} />
        <ActionBtn icon={Trash2}       label="Delete" colorClass="bg-red-500 text-white"    onClick={handleDelete} />
      </motion.div>

      {/* Right-swipe strip — sits on the left, visible when card slides right */}
      <motion.div
        style={{ opacity: rightOpacity }}
        className={cn(
          'absolute inset-y-0 left-0 flex items-center pl-2',
          stripDir !== 'right' && 'pointer-events-none',
        )}
      >
        <ActionBtn icon={Pencil} label="Edit" colorClass="bg-slate-500 text-white" onClick={handleEdit} />
      </motion.div>

      {/* Draggable card surface */}
      <motion.div
        style={{ x }}
        drag={isExpanded ? false : 'x'}
        dragConstraints={{ left: -LEFT_STRIP_W, right: RIGHT_STRIP_W }}
        dragElastic={{ left: 0.04, right: 0.04 }}
        dragDirectionLock
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        whileTap={{ scale: 0.994 }}
        className="bg-card will-change-transform"
      >
        {/* Pin indicator — amber left border */}
        {card.priority >= 1 && (
          <div className="absolute left-0 inset-y-0 w-[3px] rounded-l-2xl bg-amber-400" />
        )}

        {/* Row */}
        <div
          className="flex items-center px-3.5 py-2.5 min-h-[52px] cursor-pointer active:bg-black/[0.04] transition-colors select-none"
          onClick={handleRowClick}
          onPointerDown={handlePointerDown}
          onPointerUp={cancelLongPress}
          onPointerLeave={cancelLongPress}
          onPointerMove={handlePointerMove}
        >
          <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mr-3', bg)}>
            <Icon className={cn('h-[15px] w-[15px]', fg)} />
          </div>

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

          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="text-muted-foreground/35 flex-shrink-0"
          >
            <ChevronRight className="h-4 w-4" />
          </motion.div>
        </div>

        {/* Inline expanded content */}
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
                    card, onUpdate: onUpdateCard,
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
      </motion.div>
    </div>
  );
}

// ─── CardList ─────────────────────────────────────────────────────────────────

export function CardList({ cards, onUpdateCard, onMoveCard, onDeleteCard, onOpenCard }: CardListProps) {
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null);

  return (
    <div
      className="flex flex-col space-y-2 pb-8"
      // Tapping the container background closes any open strip
      onClick={() => { if (openSwipeId) setOpenSwipeId(null); }}
    >
      {cards.map((card) => (
        <SwipeableCard
          key={card.id}
          card={card}
          isExpanded={expandedId === card.id}
          onToggleExpand={() => setExpandedId(expandedId === card.id ? null : card.id)}
          openSwipeId={openSwipeId}
          onSetOpenSwipe={setOpenSwipeId}
          onUpdateCard={onUpdateCard}
          onMoveCard={onMoveCard}
          onDeleteCard={onDeleteCard}
          onOpenCard={onOpenCard}
        />
      ))}
    </div>
  );
}
