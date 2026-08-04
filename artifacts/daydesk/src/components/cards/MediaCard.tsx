import React from 'react';
import { DaydeskObject } from '../../types/daydesk';
import { CardHeader } from './CardHeader';
import { Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MediaCardProps {
  card: DaydeskObject;
  onClick?: () => void;
  onUpdate: (card: DaydeskObject) => void;
  onCardAction?: (action: string) => void;
  className?: string;
  isMobileExpanded?: boolean;
}

export function MediaCard({ card, onClick, onCardAction, className, isMobileExpanded }: MediaCardProps) {
  const imageUrl = card.payload.imageUrl as string | null;
  const ocrText = card.payload.ocrText as string;

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
          icon={<ImageIcon className="w-3.5 h-3.5" />}
          label="Media"
          bucket={card.bucket}
          onAction={(action) => onCardAction?.(action)}
        />
      )}
      
      <div className="w-full aspect-[4/3] bg-muted relative overflow-hidden flex items-center justify-center">
        {imageUrl ? (
          <img src={imageUrl} alt={card.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-indigo-100 to-rose-100 dark:from-indigo-900/40 dark:to-rose-900/40 flex items-center justify-center">
            <ImageIcon className="w-12 h-12 text-black/10 dark:text-white/10" />
          </div>
        )}
      </div>

      {ocrText && (
        <div className="p-4 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 italic">
            "{ocrText}"
          </p>
        </div>
      )}
    </div>
  );
}
