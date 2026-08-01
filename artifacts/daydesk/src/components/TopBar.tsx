import React, { useState, useEffect } from 'react';
import { Search, SearchIcon } from 'lucide-react';

export function TopBar() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(currentTime);

  return (
    <header className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur-md border-b border-border h-14">
      <div className="flex h-14 items-center px-4 md:px-6 gap-4">
        {!searchOpen && (
          <div className="font-semibold text-lg text-foreground tracking-tight whitespace-nowrap">
            Daydesk
          </div>
        )}

        <div className={`flex-1 flex items-center justify-end md:justify-center transition-all ${searchOpen ? 'w-full' : ''}`}>
          <div className="hidden md:flex relative w-full max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input 
              type="text"
              placeholder="Search everything..."
              className="w-full h-10 pl-9 pr-4 rounded-full bg-card/50 border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-card transition-all placeholder:text-muted-foreground shadow-sm"
            />
          </div>
          
          {/* Mobile search toggle */}
          <div className="flex md:hidden flex-1 justify-end">
            {searchOpen ? (
              <div className="relative w-full flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input 
                    autoFocus
                    type="text"
                    placeholder="Search..."
                    className="w-full h-9 pl-9 pr-4 rounded-full bg-card border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
                    onBlur={() => setSearchOpen(false)}
                  />
                </div>
                <button 
                  onClick={() => setSearchOpen(false)}
                  className="text-sm font-medium text-muted-foreground p-2"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setSearchOpen(true)}
                className="p-2 -mr-2 text-muted-foreground hover:text-foreground"
              >
                <SearchIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {!searchOpen && (
          <div className="text-xs font-medium text-muted-foreground shrink-0 hidden md:block">
            America/New_York • {formattedTime}
          </div>
        )}
      </div>
    </header>
  );
}
