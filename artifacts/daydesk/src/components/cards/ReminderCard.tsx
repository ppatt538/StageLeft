import React from 'react';
import { DaydeskObject } from '../../types/daydesk';
import { CardHeader } from './CardHeader';
import { Clock, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReminderCardProps {
  card: DaydeskObject;
  onClick?: () => void;
  onUpdate: (card: DaydeskObject) => void;
  className?: string;
  isMobileExpanded?: boolean;
}

export function ReminderCard({ card, onClick, className, isMobileExpanded }: ReminderCardProps) {
  // Reminders use `when`; events use `start`/`end`
  const isEvent = card.type === 'event';
  const when = (isEvent ? card.payload.start : card.payload.when) as string | undefined;
  const whenEnd = (isEvent ? card.payload.end : undefined) as string | undefined;
  const location = card.payload.location as string;

  const date = when ? new Date(when) : null;
  const now = new Date();
  const isOverdue = date ? (isEvent ? (whenEnd ? new Date(whenEnd) < now : date < now) : date < now) : false;

  const formattedDate = date ? new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date) : '';

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
          icon={<Clock className="w-3.5 h-3.5" />}
          label="Reminder"
          onAction={(action) => console.log('Action:', action)}
        />
      )}
      
      <div className={cn("p-4 flex flex-col gap-3", isMobileExpanded ? "pt-2" : "pt-2")}>
        {formattedDate && (
          <div className={cn(
            "inline-flex items-center gap-1.5 self-start px-2.5 py-1 rounded-md text-xs font-medium",
            isOverdue 
              ? "bg-red-50 text-destructive border border-red-100" 
              : "bg-muted text-muted-foreground border border-border/50"
          )}>
            <Clock className="w-3.5 h-3.5" />
            {formattedDate}
          </div>
        )}
        
        {location && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground mt-1">
            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{location}</span>
          </div>
        )}
      </div>
    </div>
  );
}
