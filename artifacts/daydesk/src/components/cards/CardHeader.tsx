import React from 'react';
import { MoreHorizontal, Sun } from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

interface CardHeaderProps {
  title: string;
  icon: React.ReactNode;
  label: string;
  bucket?: string;
  onAction: (action: 'archive' | 'pin' | 'delete' | 'move-today') => void;
}

export function CardHeader({ title, icon, label, bucket, onAction }: CardHeaderProps) {
  const showMoveToToday = bucket === 'week' || bucket === 'archive';

  return (
    <div className="flex items-start justify-between p-4 pb-2">
      <div className="flex flex-col gap-1.5 min-w-0 pr-2">
        <div className="flex items-center gap-1.5">
          <div className="text-muted-foreground flex items-center justify-center bg-muted rounded w-5 h-5 shrink-0">
            {icon}
          </div>
          <span className="text-[11px] font-semibold tracking-wide uppercase text-muted-foreground">
            {label}
          </span>
        </div>
        <h3 className="font-semibold text-[16px] leading-tight text-foreground truncate">
          {title}
        </h3>
      </div>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
          <button className="p-1.5 -mr-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors shrink-0 outline-none">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44 rounded-xl">
          {showMoveToToday && (
            <>
              <DropdownMenuItem
                className="gap-2"
                onClick={(e) => { e.stopPropagation(); onAction('move-today'); }}
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                Move to Today
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAction('pin'); }}>
            Pin to top
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAction('archive'); }}>
            Archive
          </DropdownMenuItem>
          <DropdownMenuItem 
            className="text-destructive focus:text-destructive focus:bg-destructive/10"
            onClick={(e) => { e.stopPropagation(); onAction('delete'); }}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
