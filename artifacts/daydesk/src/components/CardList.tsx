import React, { useState } from 'react';
import { DaydeskObject } from '../types/daydesk';
import { ChecklistCard } from './cards/ChecklistCard';
import { NoteCard } from './cards/NoteCard';
import { ReminderCard } from './cards/ReminderCard';
import { LinkCard } from './cards/LinkCard';
import { MediaCard } from './cards/MediaCard';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckSquare, AlignLeft, Clock, Link as LinkIcon, Image as ImageIcon, ChevronRight } from 'lucide-react';

interface CardListProps {
  cards: DaydeskObject[];
  onUpdateCard: (card: DaydeskObject) => void;
}

const TYPE_ICONS = {
  checklist: CheckSquare,
  note: AlignLeft,
  reminder: Clock,
  event: Clock,
  link: LinkIcon,
  media: ImageIcon,
  poster: ImageIcon,
};

export function CardList({ cards, onUpdateCard }: CardListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="flex flex-col space-y-3 pb-8">
      {cards.map(card => {
        const isExpanded = expandedId === card.id;
        const Icon = TYPE_ICONS[card.type] || AlignLeft;
        
        // Compute subtitle based on type
        let subtitle = '';
        if (card.type === 'checklist') {
          const items = (card.payload.items as any[]) || [];
          const open = items.filter(i => !i.done).length;
          subtitle = `${open} of ${items.length} open`;
        } else if (card.type === 'link') {
          try {
            const url = new URL(card.payload.url as string);
            subtitle = url.hostname;
          } catch {
            subtitle = 'Link';
          }
        } else if (card.type === 'reminder') {
          if (card.payload.when) {
            const d = new Date(card.payload.when as string);
            subtitle = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
          }
        }

        return (
          <div 
            key={card.id} 
            className="bg-card rounded-2xl shadow-sm border border-border/60 overflow-hidden transition-all"
          >
            <div 
              className="flex items-center p-4 min-h-[60px] cursor-pointer hover:bg-black/[0.02] active:bg-black/[0.04]"
              onClick={() => setExpandedId(isExpanded ? null : card.id)}
            >
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-muted-foreground mr-3">
                <Icon className="h-5 w-5" />
              </div>
              
              <div className="flex-1 min-w-0 pr-4">
                <h4 className="font-semibold text-[15px] truncate text-foreground">{card.title}</h4>
                {subtitle && (
                  <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
                )}
              </div>
              
              <motion.div 
                animate={{ rotate: isExpanded ? 90 : 0 }} 
                transition={{ duration: 0.2 }}
                className="text-muted-foreground/50"
              >
                <ChevronRight className="h-5 w-5" />
              </motion.div>
            </div>
            
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="border-t border-border/50"
                >
                  <div className="p-1 pb-4">
                    {(() => {
                      const props = {
                        card,
                        onUpdate: onUpdateCard,
                        className: "shadow-none border-none rounded-none",
                        isMobileExpanded: true
                      };
                      
                      switch (card.type) {
                        case 'checklist': return <ChecklistCard {...props} />;
                        case 'note': return <NoteCard {...props} />;
                        case 'reminder':
                        case 'event': return <ReminderCard {...props} />;
                        case 'link': return <LinkCard {...props} />;
                        case 'media':
                        case 'poster': return <MediaCard {...props} />;
                        default: return <NoteCard {...props} />;
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
