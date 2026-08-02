import React from 'react';
import { ObjectBucket } from '../types/daydesk';
import { cn } from '@/lib/utils';

interface TabBarProps {
  activeTab: ObjectBucket;
  onTabChange: (tab: ObjectBucket) => void;
  counts: Record<ObjectBucket, number>;
}

export function TabBar({ activeTab, onTabChange, counts }: TabBarProps) {
  const tabs: { id: ObjectBucket; label: string }[] = [
    { id: 'today',   label: 'Today'     },
    { id: 'week',    label: 'This Week' },
    { id: 'archive', label: 'Archive'   },
  ];

  return (
    <div className="w-full px-4 md:px-6 pt-3 md:pt-5 pb-0 border-b border-border/30">
      <div className="flex items-center gap-5 md:gap-6 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'relative pb-2.5 md:pb-3 text-[13px] md:text-sm transition-colors whitespace-nowrap',
                'min-h-[44px] flex items-end',
                isActive
                  ? 'text-foreground font-semibold'
                  : 'text-muted-foreground/70 font-medium hover:text-foreground/80',
              )}
            >
              <span className="flex items-center gap-1.5">
                {tab.label}
                {counts[tab.id] > 0 && (
                  <span className={cn(
                    'inline-flex items-center justify-center rounded-full',
                    'text-[10px] font-semibold px-1.5 min-w-[18px] h-[18px]',
                    isActive
                      ? 'bg-primary text-white'
                      : 'bg-muted text-muted-foreground',
                  )}>
                    {counts[tab.id]}
                  </span>
                )}
              </span>

              {/* Active indicator */}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-t-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
