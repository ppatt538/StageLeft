import React, { useState, useRef, useEffect } from 'react';
import { Paperclip, ArrowUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function ChatComposer() {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  useEffect(() => {
    adjustHeight();
  }, [text]);

  const handleSend = () => {
    if (!text.trim()) return;
    
    const submittedText = text;
    setText('');
    
    toast({
      description: "Sending to Daydesk...",
      duration: 2000,
    });
    
    setTimeout(() => {
      toast({
        description: "Got it. Creating your card...",
        duration: 2000,
      });
    }, 800);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-xl border-t border-border/50 pb-safe">
      <div className="max-w-3xl mx-auto p-4 md:p-6 w-full flex items-end gap-2">
        <button 
          className="p-3 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-black/5 flex-shrink-0"
          title="Attach file (not wired)"
        >
          <Paperclip className="h-5 w-5" />
        </button>
        
        <div className="flex-1 relative bg-card shadow-sm border border-border/60 rounded-[24px] overflow-hidden flex items-end focus-within:ring-1 focus-within:ring-primary/30 transition-all">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell Daydesk what to capture..."
            className="w-full bg-transparent resize-none outline-none max-h-[120px] py-3.5 pl-4 pr-12 text-sm text-foreground placeholder:text-muted-foreground/70"
            rows={1}
          />
          <button 
            onClick={handleSend}
            disabled={!text.trim()}
            className="absolute right-2 bottom-2 p-2 rounded-full bg-primary text-white disabled:opacity-0 disabled:scale-90 opacity-100 scale-100 transition-all shadow-sm"
          >
            <ArrowUp className="h-4 w-4" strokeWidth={3} />
          </button>
        </div>
      </div>
    </div>
  );
}
