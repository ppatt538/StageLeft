import { useState, useMemo } from 'react';
import { TopBar } from '../components/TopBar';
import { TabBar } from '../components/TabBar';
import { ChatComposer } from '../components/ChatComposer';
import { CardGrid } from '../components/CardGrid';
import { CardList } from '../components/CardList';
import { CardDetail } from '../components/CardDetail';
import { SAMPLE_OBJECTS } from '../data/seed';
import { ObjectBucket, DaydeskObject } from '../types/daydesk';

export function DeskPage() {
  const [activeTab, setActiveTab] = useState<ObjectBucket>('today');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  
  // Hardcoded local state for cards so checkboxes work
  const [cards, setCards] = useState<DaydeskObject[]>(SAMPLE_OBJECTS);

  const filteredCards = useMemo(() => {
    return cards.filter(card => card.bucket === activeTab && card.status !== 'discarded');
  }, [cards, activeTab]);

  const counts = useMemo(() => {
    const c: Record<ObjectBucket, number> = { today: 0, week: 0, archive: 0, pinned: 0 };
    cards.forEach(card => {
      if (card.status !== 'discarded') {
        c[card.bucket] = (c[card.bucket] || 0) + 1;
      }
    });
    return c;
  }, [cards]);

  const handleUpdateCard = (updatedCard: DaydeskObject) => {
    setCards(prev => prev.map(c => c.id === updatedCard.id ? updatedCard : c));
  };

  const selectedCard = cards.find(c => c.id === selectedCardId) || null;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col font-sans">
      <TopBar />
      
      <main className="flex-1 flex flex-col w-full max-w-[1400px] mx-auto pb-32">
        <TabBar 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
          counts={counts}
        />
        
        <div className="flex-1 px-4 md:px-6 py-4">
          {filteredCards.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center mt-20 opacity-60">
              <div className="w-16 h-16 rounded-2xl bg-card border border-border shadow-sm flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-muted-foreground opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h3 className="font-medium text-lg text-foreground mb-1">Nothing on your desk</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Tell Daydesk what to capture, or drag something here.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Masonry Grid */}
              <div className="hidden md:block">
                <CardGrid 
                  cards={filteredCards} 
                  onCardClick={(id) => setSelectedCardId(id)} 
                  onUpdateCard={handleUpdateCard}
                />
              </div>
              
              {/* Mobile Stacked List */}
              <div className="block md:hidden">
                <CardList 
                  cards={filteredCards} 
                  onUpdateCard={handleUpdateCard} 
                />
              </div>
            </>
          )}
        </div>
      </main>

      <ChatComposer />
      
      <CardDetail 
        card={selectedCard}
        isOpen={!!selectedCard}
        onClose={() => setSelectedCardId(null)}
        onUpdateCard={handleUpdateCard}
      />
    </div>
  );
}
