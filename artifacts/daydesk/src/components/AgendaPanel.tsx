import { X, CalendarDays } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMemo } from 'react';
import { DaydeskObject } from '../types/daydesk';
import { cn } from '@/lib/utils';

interface AgendaPanelProps {
  isOpen: boolean;
  onClose: () => void;
  allObjects: DaydeskObject[];
  onSelect: (card: DaydeskObject) => void;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getCardDate(card: DaydeskObject): Date | null {
  const iso =
    (card.type === 'event' ? card.payload.start : card.payload.when) as string | undefined;
  if (!iso) return null;
  try {
    return new Date(iso);
  } catch {
    return null;
  }
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function startOfWeek(d: Date): Date {
  const r = startOfDay(d);
  const day = r.getDay(); // 0=Sun
  r.setDate(r.getDate() - day + (day === 0 ? -6 : 1)); // Mon
  return r;
}

function endOfWeek(d: Date): Date {
  const r = startOfWeek(d);
  r.setDate(r.getDate() + 6); // Sun
  r.setHours(23, 59, 59, 999);
  return r;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

// ─── Section component ────────────────────────────────────────────────────────

interface AgendaItem {
  card: DaydeskObject;
  date: Date;
  isOverdue: boolean;
  hasTimed: boolean;
}

function AgendaSection({
  label,
  items,
  onSelect,
  displayMode = 'time',
  dateFormat = 'weekday',
}: {
  label: string;
  items: AgendaItem[];
  onSelect: (card: DaydeskObject) => void;
  displayMode?: 'time' | 'date';
  dateFormat?: 'weekday' | 'month';
}) {
  if (items.length === 0) return null;

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
          {label}
        </span>
        <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
          {items.length}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        {items.map(({ card, date, isOverdue, hasTimed }) => {
          let labelStr: string;
          if (displayMode === 'date') {
            labelStr =
              dateFormat === 'weekday'
                ? new Intl.DateTimeFormat('en-US', {
                    weekday: 'short',
                    day: 'numeric',
                  }).format(date)
                : new Intl.DateTimeFormat('en-US', {
                    month: 'short',
                    day: 'numeric',
                  }).format(date);
          } else {
            labelStr = hasTimed
              ? new Intl.DateTimeFormat('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                }).format(date)
              : '—';
          }

          return (
            <button
              key={card.id}
              onClick={() => onSelect(card)}
              className={cn(
                'w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl transition-colors group',
                isOverdue
                  ? 'border-l-2 border-destructive bg-red-50/60 hover:bg-red-50'
                  : 'hover:bg-muted/60',
              )}
            >
              {/* Dot */}
              <span
                className={cn(
                  'flex-shrink-0 w-2 h-2 rounded-full',
                  isOverdue
                    ? 'bg-destructive'
                    : hasTimed
                      ? 'bg-primary'
                      : 'border border-muted-foreground/40 bg-transparent',
                )}
              />

              {/* Time or Date */}
              <span
                className={cn(
                  'flex-shrink-0 text-[11px] font-medium tabular-nums w-[60px]',
                  isOverdue ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                {labelStr}
              </span>

              {/* Title */}
              <span
                className={cn(
                  'flex-1 text-sm font-medium leading-snug truncate',
                  isOverdue ? 'text-destructive' : 'text-foreground',
                )}
              >
                {card.title}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function AgendaPanel({ isOpen, onClose, allObjects, onSelect }: AgendaPanelProps) {
  const sections = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);

    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);

    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const overdue: AgendaItem[] = [];
    const today: AgendaItem[] = [];
    const week: AgendaItem[] = [];
    const month: AgendaItem[] = [];

    for (const card of allObjects) {
      // Only reminders and events
      if (card.type !== 'reminder' && card.type !== 'event') continue;
      // Exclude done/discarded/snoozed
      if (card.status === 'done' || card.status === 'discarded' || card.status === 'snoozed') continue;

      const date = getCardDate(card);
      if (!date) continue;

      // Detect if there's a specific time (not midnight)
      const hasTimed = date.getHours() !== 0 || date.getMinutes() !== 0;

      const isOverdue = date < todayStart;

      const item: AgendaItem = { card, date, isOverdue, hasTimed };

      if (isOverdue) {
        overdue.push(item);
      } else if (date >= todayStart && date <= todayEnd) {
        today.push(item);
      } else if (date > todayEnd && date >= weekStart && date <= weekEnd) {
        week.push(item);
      } else if (date > weekEnd && date >= monthStart && date <= monthEnd) {
        month.push(item);
      }
    }

    // Sort each bucket chronologically
    const byDate = (a: AgendaItem, b: AgendaItem) => a.date.getTime() - b.date.getTime();
    overdue.sort(byDate);
    today.sort(byDate);
    week.sort(byDate);
    month.sort(byDate);

    return { overdue, today, week, month };
  }, [allObjects]);

  const isEmpty =
    sections.overdue.length === 0 &&
    sections.today.length === 0 &&
    sections.week.length === 0 &&
    sections.month.length === 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 240 }}
          className="hidden md:flex fixed top-0 right-0 bottom-0 w-[300px] bg-background border-l border-border shadow-xl z-30 flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 h-14 flex-shrink-0">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold text-sm text-foreground">Agenda</span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-muted transition-colors text-muted-foreground"
              aria-label="Close agenda"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {isEmpty ? (
              <div className="flex flex-col items-center justify-center h-full text-center gap-3 pb-16 select-none">
                <CalendarDays className="w-8 h-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No upcoming reminders</p>
                <p className="text-xs text-muted-foreground/60">
                  Create a reminder or event and it will appear here.
                </p>
              </div>
            ) : (
              <>
                {sections.overdue.length > 0 && (
                  <AgendaSection
                    label="Overdue"
                    items={sections.overdue}
                    onSelect={onSelect}
                  />
                )}
                <AgendaSection label="Today" items={sections.today} onSelect={onSelect} displayMode="time" />
                <AgendaSection label="This Week" items={sections.week} onSelect={onSelect} displayMode="date" dateFormat="weekday" />
                <AgendaSection label="This Month" items={sections.month} onSelect={onSelect} displayMode="date" dateFormat="month" />
              </>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

// ─── Exported helper for badge count ─────────────────────────────────────────

export function countOverdueAgendaItems(allObjects: DaydeskObject[]): number {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  return allObjects.filter((card) => {
    if (card.type !== 'reminder' && card.type !== 'event') return false;
    if (card.status === 'done' || card.status === 'discarded' || card.status === 'snoozed') return false;
    const date = getCardDate(card);
    return date !== null && date < todayStart;
  }).length;
}
