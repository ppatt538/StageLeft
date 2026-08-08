import { useMemo } from 'react';
import { DaydeskObject } from '../types/daydesk';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgendaItem {
  card: DaydeskObject;
  date: Date;
  isOverdue: boolean;
  hasTimed: boolean;
}

export interface AgendaSections {
  overdue: AgendaItem[];
  today: AgendaItem[];
  week: AgendaItem[];
  month: AgendaItem[];
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function getCardDate(card: DaydeskObject): Date | null {
  const iso =
    (card.type === 'event' ? card.payload.start : card.payload.when) as string | undefined;
  if (!iso) return null;
  try {
    return new Date(iso);
  } catch {
    return null;
  }
}

export function startOfDay(d: Date): Date {
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

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAgendaItems(allObjects: DaydeskObject[]): AgendaSections {
  return useMemo(() => {
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
}
