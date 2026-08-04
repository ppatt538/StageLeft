import React from 'react';
import { DaydeskObject } from '../types/daydesk';
import { ChecklistCard } from './cards/ChecklistCard';
import { NoteCard } from './cards/NoteCard';
import { ReminderCard } from './cards/ReminderCard';
import { LinkCard } from './cards/LinkCard';
import { MediaCard } from './cards/MediaCard';

interface CardGridProps {
  cards: DaydeskObject[];
  onCardClick: (id: string) => void;
  onUpdateCard: (card: DaydeskObject) => void;
  onCardAction?: (cardId: string, action: string) => void;
}

export function CardGrid({ cards, onCardClick, onUpdateCard, onCardAction }: CardGridProps) {
  return (
    <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
      {cards.map(card => {
        const props = {
          card,
          onClick: () => onCardClick(card.id),
          onUpdate: onUpdateCard,
          onCardAction: (action: string) => onCardAction?.(card.id, action),
          className: "break-inside-avoid mb-4"
        };
        
        switch (card.type) {
          case 'checklist':
            return <ChecklistCard key={card.id} {...props} />;
          case 'note':
            return <NoteCard key={card.id} {...props} />;
          case 'reminder':
          case 'event':
            return <ReminderCard key={card.id} {...props} />;
          case 'link':
            return <LinkCard key={card.id} {...props} />;
          case 'media':
          case 'poster':
            return <MediaCard key={card.id} {...props} />;
          default:
            return <NoteCard key={card.id} {...props} />;
        }
      })}
    </div>
  );
}
