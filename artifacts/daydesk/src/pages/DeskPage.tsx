import { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListObjects,
  getListObjectsQueryKey,
  useUpdateObject,
} from '@workspace/api-client-react';
import { TopBar } from '../components/TopBar';
import { TabBar } from '../components/TabBar';
import { ChatComposer } from '../components/ChatComposer';
import { CardGrid } from '../components/CardGrid';
import { CardList } from '../components/CardList';
import { CardDetail } from '../components/CardDetail';
import { ObjectBucket, DaydeskObject } from '../types/daydesk';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Per-bucket empty states ──────────────────────────────────────────────────

const EMPTY_STATES: Record<ObjectBucket, { emoji: string; heading: string; sub: string }> = {
  today: {
    emoji: '☀️',
    heading: 'Your day is a blank slate',
    sub: 'Tell Daydesk what to capture — a task, note, reminder, or link.',
  },
  week: {
    emoji: '📅',
    heading: 'Nothing planned this week',
    sub: 'Add cards to your week to keep longer-horizon items in view.',
  },
  archive: {
    emoji: '🗂️',
    heading: 'Archive is empty',
    sub: 'Older cards roll here automatically each day.',
  },
  pinned: {
    emoji: '📌',
    heading: 'Nothing pinned yet',
    sub: 'Pin important cards to keep them always in reach.',
  },
};

function BucketEmptyState({ bucket }: { bucket: ObjectBucket }) {
  const state = EMPTY_STATES[bucket];
  return (
    <div className="h-full flex flex-col items-center justify-center text-center mt-20 select-none">
      <div className="text-5xl mb-4 leading-none">{state.emoji}</div>
      <h3 className="font-semibold text-lg text-foreground mb-1.5">{state.heading}</h3>
      <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">{state.sub}</p>
    </div>
  );
}

// ─── DeskPage ─────────────────────────────────────────────────────────────────

export function DeskPage() {
  const [activeTab, setActiveTab] = useState<ObjectBucket>('today');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  // Fetch all (for counts)
  const { data: allObjects = [] } = useListObjects(
    { bucket: 'all' },
    { query: { queryKey: getListObjectsQueryKey({ bucket: 'all' }) } },
  );

  // Fetch current tab (with optional search)
  const listParams = searchQuery
    ? { bucket: activeTab, q: searchQuery }
    : { bucket: activeTab };

  const { data: tabObjects = [], isLoading } = useListObjects(listParams, {
    query: { queryKey: getListObjectsQueryKey(listParams) },
  });

  const updateObject = useUpdateObject();

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getListObjectsQueryKey({ bucket: 'all' }) });
    queryClient.invalidateQueries({ queryKey: getListObjectsQueryKey(listParams) });
  }, [queryClient, listParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const c: Record<ObjectBucket, number> = { today: 0, week: 0, archive: 0, pinned: 0 };
    (allObjects as DaydeskObject[]).forEach((card) => {
      if (card.status !== 'discarded' && card.bucket in c) {
        c[card.bucket as ObjectBucket]++;
      }
    });
    return c;
  }, [allObjects]);

  // Used by card components: receives updated card with new payload (e.g. checklist toggle)
  const handleUpdateCard = useCallback(
    (updatedCard: DaydeskObject) => {
      updateObject.mutate(
        {
          id: updatedCard.id,
          data: { payload: updatedCard.payload as Record<string, unknown> },
        },
        { onSuccess: invalidateAll },
      );
    },
    [updateObject, invalidateAll],
  );

  // Clear search when the user switches tabs
  const handleTabChange = useCallback((tab: ObjectBucket) => {
    setActiveTab(tab);
    setSearchQuery('');
  }, []);

  const filteredCards = tabObjects as DaydeskObject[];
  const selectedCard = filteredCards.find((c) => c.id === selectedCardId) ?? null;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col font-sans">
      <TopBar searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      <main className="flex-1 flex flex-col w-full max-w-[1400px] mx-auto pb-32">
        <TabBar activeTab={activeTab} onTabChange={handleTabChange} counts={counts} />

        <div className="flex-1 px-4 md:px-6 py-4">
          {isLoading ? (
            <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-40 w-full rounded-2xl break-inside-avoid mb-4" />
              ))}
            </div>
          ) : filteredCards.length === 0 ? (
            <BucketEmptyState bucket={activeTab} />
          ) : (
            <>
              <div className="hidden md:block">
                <CardGrid
                  cards={filteredCards}
                  onCardClick={(id) => setSelectedCardId(id)}
                  onUpdateCard={handleUpdateCard}
                />
              </div>
              <div className="block md:hidden">
                <CardList cards={filteredCards} onUpdateCard={handleUpdateCard} />
              </div>
            </>
          )}
        </div>
      </main>

      <ChatComposer onCardCreated={invalidateAll} />

      <CardDetail
        card={selectedCard}
        isOpen={!!selectedCard}
        onClose={() => setSelectedCardId(null)}
        onUpdateCard={(card) => {
          updateObject.mutate(
            {
              id: card.id,
              data: {
                title: card.title,
                bucket: card.bucket as 'today' | 'week' | 'archive' | 'pinned',
                status: card.status as 'active' | 'done' | 'snoozed' | 'discarded',
                tags: card.tags as string[],
                payload: card.payload as Record<string, unknown>,
              },
            },
            { onSuccess: invalidateAll },
          );
        }}
      onDeleteCard={(id) => {
          updateObject.mutate(
            { id, data: { status: 'discarded' } },
            { onSuccess: () => { invalidateAll(); setSelectedCardId(null); } },
          );
        }}
      />
    </div>
  );
}
