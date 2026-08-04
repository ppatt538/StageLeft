import React from 'react';
import { DaydeskObject } from '../../types/daydesk';
import { CardHeader } from './CardHeader';
import { Link as LinkIcon, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LinkCardProps {
  card: DaydeskObject;
  onClick?: () => void;
  onUpdate: (card: DaydeskObject) => void;
  onCardAction?: (action: string) => void;
  className?: string;
  isMobileExpanded?: boolean;
}

export function LinkCard({ card, onClick, onCardAction, className, isMobileExpanded }: LinkCardProps) {
  const url = card.payload.url as string;
  const summary = card.payload.summary as string;
  
  let hostname = url;
  try {
    hostname = new URL(url).hostname;
  } catch {}

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
          icon={<LinkIcon className="w-3.5 h-3.5" />}
          label="Link"
          bucket={card.bucket}
          onAction={(action) => onCardAction?.(action)}
        />
      )}
      
      <div className={cn("p-4 flex flex-col gap-3", isMobileExpanded ? "pt-2" : "pt-2")}>
        <a 
          href={url} 
          target="_blank" 
          rel="noreferrer"
          className="group flex items-center gap-2 text-sm text-primary hover:underline w-fit"
          onClick={e => e.stopPropagation()}
        >
          <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
            <ExternalLink className="w-3.5 h-3.5" />
          </div>
          <span className="font-medium truncate">{hostname}</span>
        </a>
        
        {summary && (
          <p className="text-[14px] text-muted-foreground leading-snug">
            {summary}
          </p>
        )}
      </div>
    </div>
  );
}
