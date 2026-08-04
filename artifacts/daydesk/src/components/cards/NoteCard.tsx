import React from 'react';
import { DaydeskObject } from '../../types/daydesk';
import { CardHeader } from './CardHeader';
import { AlignLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NoteCardProps {
  card: DaydeskObject;
  onClick?: () => void;
  onUpdate: (card: DaydeskObject) => void;
  onCardAction?: (action: string) => void;
  className?: string;
  isMobileExpanded?: boolean;
}

export function NoteCard({ card, onClick, onCardAction, className, isMobileExpanded }: NoteCardProps) {
  const markdown = (card.payload.markdown as string) || '';
  
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
          icon={<AlignLeft className="w-3.5 h-3.5" />}
          label="Note"
          bucket={card.bucket}
          onAction={(action) => onCardAction?.(action)}
        />
      )}
      
      <div className={cn("p-4 text-[14px] text-foreground/90 leading-relaxed whitespace-pre-wrap", isMobileExpanded ? "pt-2" : "pt-2")}>
        {!isMobileExpanded ? (
          <div className="line-clamp-4">{markdown}</div>
        ) : (
          <div>{markdown}</div>
        )}
      </div>
    </div>
  );
}
