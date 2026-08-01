import React from 'react';
import { ObjectBucket } from '../types/daydesk';

interface TabBarProps {
  activeTab: ObjectBucket;
  onTabChange: (tab: ObjectBucket) => void;
  counts: Record<ObjectBucket, number>;
}

export function TabBar({ activeTab, onTabChange, counts }: TabBarProps) {
  const tabs: { id: ObjectBucket; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This Week' },
    { id: 'archive', label: 'Archive' },
    { id: 'pinned', label: 'Pinned' },
  ];

  return (
    <div className="w-full px-4 md:px-6 pt-6 pb-2">
      <div className="flex items-center gap-6 overflow-x-auto no-scrollbar mask-edges">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative pb-3 text-sm font-medium transition-colors whitespace-nowrap ${
                isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'
              }`}
            >
              <div className="flex items-center gap-2">
                {tab.label}
                {counts[tab.id] > 0 && (
                  <span className={`inline-flex items-center justify-center text-[10px] rounded-full px-1.5 min-w-4 h-4 ${
                    isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  }`}>
                    {counts[tab.id]}
                  </span>
                )}
              </div>
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-t-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
