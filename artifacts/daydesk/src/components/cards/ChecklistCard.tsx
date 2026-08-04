import React from 'react';
import { DaydeskObject } from '../../types/daydesk';
import { CardHeader } from './CardHeader';
import { CheckSquare } from 'lucide-react';
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
  
  const handleToggle = (e: React.MouseEvent, id: string) => {
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
      
      <div className={cn("p-4 flex flex-col gap-2", isMobileExpanded ? "pt-2" : "pt-2")}>
        {items.map((item) => (
          <div 
            key={item.id} 
            className="flex items-start gap-3 group"
            onClick={(e) => handleToggle(e, item.id)}
          >
            <div className="mt-0.5 flex-shrink-0 relative flex items-center justify-center w-5 h-5">
              <input 
                type="checkbox" 
                checked={item.done}
                readOnly
                className="w-4.5 h-4.5 rounded border-border/80 text-primary focus:ring-primary/30 transition-colors cursor-pointer"
              />
            </div>
            <span className={cn(
              "text-[14px] leading-snug transition-colors", 
              item.done ? "text-muted-foreground line-through" : "text-foreground"
            )}>
              {item.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
