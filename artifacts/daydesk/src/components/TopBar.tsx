import { useState, useEffect, useRef } from 'react';
import { Search, SearchIcon, X, Clock, Key, CalendarDays, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Theme } from '../hooks/use-theme';

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onHistoryOpen?: () => void;
  onApiTokensOpen?: () => void;
  onAgendaOpen?: () => void;
  overdueCount?: number;
  onThemeToggle?: () => void;
  currentTheme?: Theme;
}

export function TopBar({ searchQuery, onSearchChange, onHistoryOpen, onApiTokensOpen, onAgendaOpen, overdueCount = 0, onThemeToggle, currentTheme = 'default' }: TopBarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!searchQuery) setSearchOpen(false);
  }, [searchQuery]);

  const formattedTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(currentTime);

  const handleChange = (value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSearchChange(value), 200);
  };

  const handleClear = () => { onSearchChange(''); };

  return (
    <header className="sticky top-0 z-40 w-full bg-background/95 backdrop-blur-md border-b border-border/60 h-12 md:h-14">
      <div className="flex h-12 md:h-14 items-center px-4 md:px-6 gap-3 md:gap-4">
        {!searchOpen && (
          <div className="font-bold text-[17px] md:text-lg text-foreground tracking-[-0.4px] whitespace-nowrap">
            Daydesk
          </div>
        )}

        <div className={`flex-1 flex items-center justify-end md:justify-center transition-all ${searchOpen ? 'w-full' : ''}`}>
          {/* Desktop search */}
          <div className="hidden md:flex relative w-full max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              placeholder="Search everything..."
              value={searchQuery}
              onChange={(e) => handleChange(e.target.value)}
              className="w-full h-10 pl-9 pr-9 rounded-full bg-card/50 border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-card transition-all placeholder:text-muted-foreground shadow-sm"
              data-testid="input-search"
            />
            {searchQuery && (
              <button onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" aria-label="Clear search">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Mobile search toggle */}
          <div className="flex md:hidden flex-1 justify-end items-center gap-1">
            {searchOpen ? (
              <div className="relative w-full flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <input
                    autoFocus
                    type="search"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => handleChange(e.target.value)}
                    className="w-full h-9 pl-9 pr-4 rounded-full bg-card border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
                    data-testid="input-search-mobile"
                  />
                </div>
                <button onClick={() => { setSearchOpen(false); handleClear(); }} className="text-sm font-medium text-muted-foreground p-2" data-testid="button-cancel-search">
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <button onClick={() => setSearchOpen(true)} className="p-2 text-muted-foreground hover:text-foreground" data-testid="button-open-search">
                  <SearchIcon className="h-5 w-5" />
                </button>
                {onHistoryOpen && (
                  <button onClick={onHistoryOpen} className="p-2 text-muted-foreground hover:text-foreground" title="Conversation history" data-testid="button-history">
                    <Clock className="h-5 w-5" />
                  </button>
                )}
                {onApiTokensOpen && (
                  <button onClick={onApiTokensOpen} className="p-2 text-muted-foreground hover:text-foreground" title="API access tokens" data-testid="button-api-tokens">
                    <Key className="h-5 w-5" />
                  </button>
                )}
                {onThemeToggle && (
                  <button
                    onClick={onThemeToggle}
                    className={cn(
                      'p-2 transition-colors',
                      currentTheme === 'warm'
                        ? 'text-amber-600'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                    title={currentTheme === 'warm' ? 'Switch to Default theme' : 'Switch to Warm Tactile theme'}
                  >
                    <Palette className="h-5 w-5" />
                  </button>
                )}
                {/* Agenda is desktop-only — hidden on mobile */}
              </>
            )}
          </div>
        </div>

        {!searchOpen && (
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <span className="text-xs font-medium text-muted-foreground">
              America/New_York • {formattedTime}
            </span>
            {onHistoryOpen && (
              <button onClick={onHistoryOpen} className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Conversation history" data-testid="button-history">
                <Clock className="h-4 w-4" />
              </button>
            )}
            {onApiTokensOpen && (
              <button onClick={onApiTokensOpen} className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="API access tokens" data-testid="button-api-tokens">
                <Key className="h-4 w-4" />
              </button>
            )}
            {onAgendaOpen && (
              <button
                onClick={onAgendaOpen}
                className={cn(
                  'relative p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors',
                )}
                title="Agenda"
                data-testid="button-agenda"
              >
                <CalendarDays className="h-4 w-4" />
                {overdueCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-destructive" />
                )}
              </button>
            )}
            {onThemeToggle && (
              <button
                onClick={onThemeToggle}
                className={cn(
                  'p-1.5 rounded-full transition-colors',
                  currentTheme === 'warm'
                    ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
                title={currentTheme === 'warm' ? 'Switch to Default theme' : 'Switch to Warm Tactile theme'}
                data-testid="button-theme-toggle"
              >
                <Palette className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
