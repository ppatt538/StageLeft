import { useState, useRef, useEffect } from 'react';
import { Paperclip, ArrowUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSendChat } from '@workspace/api-client-react';

interface ChatComposerProps {
  onCardCreated?: () => void;
}

export function ChatComposer({ onCardCreated }: ChatComposerProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const sendChat = useSendChat();

  // Undo: store last created object IDs for 30s
  const [lastCreatedIds, setLastCreatedIds] = useState<string[]>([]);
  const [undoVisible, setUndoVisible] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (!text.trim() || sendChat.isPending) return;

    const submittedText = text;
    setText('');

    sendChat.mutate(
      { data: { message: submittedText } },
      {
        onSuccess: (response) => {
          const created = (response.objectsChanged ?? [])
            .map((o: { id: string }) => o.id);

          if (created.length > 0) {
            setLastCreatedIds(created);
            setUndoVisible(true);
            if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
            undoTimerRef.current = setTimeout(() => {
              setUndoVisible(false);
              setLastCreatedIds([]);
            }, 30_000);
          }

          toast({
            description: response.message?.content ?? 'Card created.',
            duration: 3000,
          });

          onCardCreated?.();
        },
        onError: () => {
          toast({
            description: 'Something went wrong. Try again.',
            variant: 'destructive',
            duration: 3000,
          });
        },
      },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-xl border-t border-border/50 pb-safe">
      {/* Undo bar */}
      {undoVisible && lastCreatedIds.length > 0 && (
        <div className="flex items-center justify-center gap-3 py-2 text-sm text-muted-foreground border-b border-border/40">
          <span>Card created</span>
          <button
            className="text-primary font-medium hover:underline"
            onClick={() => {
              setUndoVisible(false);
              setLastCreatedIds([]);
              // Phase 3 will wire real undo; for now just dismiss
              toast({ description: 'Undo coming in Phase 3.', duration: 2000 });
            }}
            data-testid="button-undo"
          >
            Undo
          </button>
        </div>
      )}

      <div className="max-w-3xl mx-auto p-4 md:p-6 w-full flex items-end gap-2">
        <button
          className="p-3 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-black/5 flex-shrink-0"
          title="Attach file"
          data-testid="button-attach"
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
            data-testid="input-chat"
            disabled={sendChat.isPending}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sendChat.isPending}
            className="absolute right-2 bottom-2 p-2 rounded-full bg-primary text-white disabled:opacity-0 disabled:scale-90 opacity-100 scale-100 transition-all shadow-sm"
            data-testid="button-send"
          >
            <ArrowUp className="h-4 w-4" strokeWidth={3} />
          </button>
        </div>
      </div>
    </div>
  );
}
