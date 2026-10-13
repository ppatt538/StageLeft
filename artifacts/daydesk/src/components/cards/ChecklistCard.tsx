import React from 'react';
import { DaydeskObject } from '../../types/daydesk';
import { CardHeader } from './CardHeader';
import { Check, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChecklistCardProps {
  card: DaydeskObject;
  onClick?: () => void;
  onUpdate: (card: DaydeskObject) => void;
  onCardAction?: (action: string) => void;
  className?: string;
  isMobileExpanded?: boolean;
}

export function ChecklistCard({ card, onClick, onUpdate, onCardAction, className, isMobileExpanded }: ChecklistCardProps) {
  const items = (card.payload.items as any[]) || [];
  
  const handleToggle = (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    e.stopPropagation();
    const newItems = items.map(item => 
      item.id === id ? { ...item, done: !item.done } : item
    );
    onUpdate({ ...card, payload: { ...card.payload, items: newItems } });
  };

  return (
    <div 
      className={cn(
        "bg-card rounded-2xl shadow-sm border border-border overflow-hidden flex flex-col transition-all hover:shadow-md cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {!isMobileExpanded && (
        <CardHeader 
          title={card.title} 
          icon={<CheckSquare className="w-3.5 h-3.5" />}
          label="Checklist"
          bucket={card.bucket}
          onAction={(action) => onCardAction?.(action)}
        />
      )}
      
      <div className={cn("p-3 md:p-4 flex flex-col gap-1.5", isMobileExpanded ? "pt-2" : "pt-2")}>
        {items.map((item) => (
          <label
            key={item.id} 
            htmlFor={`checklist-${card.id}-${item.id}`}
            className={cn(
              "group flex items-start gap-3 min-h-12 px-2 rounded-xl cursor-pointer touch-manipulation",
              "active:bg-muted/60 transition-colors select-none",
              "md:min-h-0 md:py-1 md:px-1",
            )}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <span className="relative mt-1 md:mt-0.5 flex-shrink-0 flex items-center justify-center w-6 h-6 md:w-[18px] md:h-[18px]">
              <input
                id={`checklist-${card.id}-${item.id}`}
                type="checkbox"
                checked={item.done}
                onChange={(e) => handleToggle(e, item.id)}
                aria-label={`${item.done ? 'Mark incomplete' : 'Mark complete'}: ${item.text || 'Untitled item'}`}
                className="peer absolute inset-0 z-10 w-6 h-6 md:w-[18px] md:h-[18px] opacity-0 cursor-pointer"
              />
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-0 rounded-[8px] border-2 transition-all duration-200",
                  "bg-background shadow-sm",
                  "peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30 peer-focus-visible:ring-offset-1",
                  item.done
                    ? "border-primary bg-primary scale-100"
                    : "border-border/90 group-hover:border-primary/60",
                )}
              />
              <Check
                aria-hidden="true"
                className={cn(
                  "relative z-[1] w-4 h-4 md:w-3 md:h-3 text-primary-foreground stroke-[3] transition-all duration-200",
                  item.done ? "opacity-100 scale-100" : "opacity-0 scale-75",
                )}
              />
            </span>
            <span className={cn(
              "flex-1 min-w-0 py-1 text-[15px] leading-6 break-words transition-colors md:text-[14px] md:leading-snug",
              item.done ? "text-muted-foreground line-through" : "text-foreground"
            )}>
              {item.text}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
