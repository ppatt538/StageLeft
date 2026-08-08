import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DaydeskObject } from '../types/daydesk';
import { useAgendaItems, AgendaItem } from '../hooks/use-agenda-items';
import { cn } from '@/lib/utils';

interface AgendaRibbonProps {
  allObjects: DaydeskObject[];
  onSelect: (card: DaydeskObject) => void;
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

function Chip({
  item,
  dateLabel,
  onSelect,
}: {
  item: AgendaItem;
  dateLabel: string;
  onSelect: (card: DaydeskObject) => void;
}) {
  const { card, isOverdue, hasTimed } = item;

  return (
    <button
      onClick={() => onSelect(card)}
      className={cn(
        'inline-flex items-center gap-1.5 flex-shrink-0 rounded-full px-2.5 py-1 border',
        'text-left transition-colors active:scale-[0.97]',
        isOverdue
          ? 'bg-red-50 border-red-200 text-destructive'
          : 'bg-muted/60 border-border/40 text-foreground',
      )}
    >
      {/* Dot */}
      <span
        className={cn(
          'flex-shrink-0 w-1.5 h-1.5 rounded-full',
          isOverdue
            ? 'bg-destructive'
            : hasTimed
              ? 'bg-primary'
              : 'border border-muted-foreground/50 bg-transparent',
        )}
      />
      {/* Time/date label */}
      <span
        className={cn(
          'text-[10px] font-medium tabular-nums flex-shrink-0',
          isOverdue ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        {dateLabel}
      </span>
      {/* Title */}
      <span
        className={cn(
          'text-[11px] font-semibold truncate max-w-[80px]',
          isOverdue ? 'text-destructive' : 'text-foreground',
        )}
      >
        {card.title}
      </span>
    </button>
  );
}

// ─── Section divider ──────────────────────────────────────────────────────────

function Divider({ label, overdue = false }: { label: string; overdue?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center flex-shrink-0 text-[9px] font-bold tracking-widest uppercase px-1',
        overdue ? 'text-destructive' : 'text-muted-foreground/60',
      )}
    >
      {label}
    </span>
  );
}

// ─── AgendaRibbon ─────────────────────────────────────────────────────────────

export function AgendaRibbon({ allObjects, onSelect }: AgendaRibbonProps) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('daydesk:ribbon-collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const sections = useAgendaItems(allObjects);
  const { overdue, today, week, month } = sections;

  const isEmpty =
    overdue.length === 0 &&
    today.length === 0 &&
    week.length === 0 &&
    month.length === 0;

  // Don't render anything when empty
  if (isEmpty) return null;

  const overdueCount = overdue.length;

  const handleToggle = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem('daydesk:ribbon-collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Build date label for a chip
  const makeLabel = (item: AgendaItem, mode: 'time' | 'weekday' | 'month'): string => {
    const { date, hasTimed, isOverdue } = item;
    if (isOverdue || mode === 'time') {
      return hasTimed
        ? new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          }).format(date)
        : '—';
    }
    if (mode === 'weekday') {
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        day: 'numeric',
      }).format(date);
    }
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  return (
    <div className="block md:hidden relative border-b border-border/30 bg-background">
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="ribbon-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 48, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {/* Scrollable chip row */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-3 h-12 pr-10">
              {overdue.length > 0 && (
                <>
                  <Divider label="Overdue" overdue />
                  {overdue.map((item) => (
                    <Chip
                      key={item.card.id}
                      item={item}
                      dateLabel={makeLabel(item, 'time')}
                      onSelect={onSelect}
                    />
                  ))}
                </>
              )}

              {today.length > 0 && (
                <>
                  <Divider label="Today" />
                  {today.map((item) => (
                    <Chip
                      key={item.card.id}
                      item={item}
                      dateLabel={makeLabel(item, 'time')}
                      onSelect={onSelect}
                    />
                  ))}
                </>
              )}

              {week.length > 0 && (
                <>
                  <Divider label="Week" />
                  {week.map((item) => (
                    <Chip
                      key={item.card.id}
                      item={item}
                      dateLabel={makeLabel(item, 'weekday')}
                      onSelect={onSelect}
                    />
                  ))}
                </>
              )}

              {month.length > 0 && (
                <>
                  <Divider label="Month" />
                  {month.map((item) => (
                    <Chip
                      key={item.card.id}
                      item={item}
                      dateLabel={makeLabel(item, 'month')}
                      onSelect={onSelect}
                    />
                  ))}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed state: 2px accent line */}
      {collapsed && <div className="h-[2px] bg-primary/20" />}

      {/* Chevron toggle — fixed on the right edge */}
      <button
        onClick={handleToggle}
        aria-label={collapsed ? 'Expand agenda ribbon' : 'Collapse agenda ribbon'}
        className={cn(
          'absolute right-0 top-0 flex items-center justify-center',
          'w-9 transition-colors z-10',
          collapsed ? 'h-[2px] translate-y-0' : 'h-12',
        )}
      >
        <span className="relative flex items-center justify-center w-7 h-7 rounded-full bg-background border border-border/40 shadow-sm">
          <motion.span
            animate={{ rotate: collapsed ? 90 : -90 }}
            transition={{ duration: 0.2 }}
            className="flex"
          >
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          </motion.span>
          {/* Overdue badge when collapsed */}
          {collapsed && overdueCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] bg-destructive text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
              {overdueCount}
            </span>
          )}
        </span>
      </button>
    </div>
  );
}
