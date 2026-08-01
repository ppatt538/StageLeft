import { useState, useRef, useEffect, useCallback } from 'react';
import { Paperclip, ArrowUp, X, ImageIcon, Loader2, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSendChat } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';

interface UploadedFile {
  id: string;
  url: string;
  filename: string;
  mime: string;
}

interface ChatComposerProps {
  onCardCreated?: () => void;
}

export function ChatComposer({ onCardCreated }: ChatComposerProps) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [undoVisible, setUndoVisible] = useState(false);
  const [undoMessageId, setUndoMessageId] = useState<string | null>(null);
  const [undoing, setUndoing] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { toast } = useToast();
  const sendChat = useSendChat();

  // ─── Auto-resize textarea ──────────────────────────────────────────────────

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  useEffect(() => { adjustHeight(); }, [text, adjustHeight]);

  // ─── File upload ───────────────────────────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = '';

    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length < files.length) {
      toast({ description: 'Only image files are supported.', duration: 3000 });
    }
    if (!images.length) return;

    setUploading(true);

    const uploaded: UploadedFile[] = [];
    for (const file of images) {
      try {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch('/api/upload', { method: 'POST', body: form });
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
        const data: UploadedFile = await res.json();
        uploaded.push(data);
      } catch {
        toast({ description: `Failed to upload "${file.name}".`, variant: 'destructive', duration: 3000 });
      }
    }

    setAttachments((prev) => [...prev, ...uploaded]);
    setUploading(false);
    textareaRef.current?.focus();
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // ─── Send ──────────────────────────────────────────────────────────────────

  const canSend = (text.trim().length > 0 || attachments.length > 0) && !sendChat.isPending && !uploading;

  const handleSend = () => {
    if (!canSend) return;

    const submittedText = text.trim() || (attachments.length > 0
      ? `Attach image: ${attachments.map((a) => a.filename).join(', ')}`
      : '');
    const mediaIds = attachments.map((a) => a.id);

    setText('');
    setAttachments([]);

    sendChat.mutate(
      { data: { message: submittedText, mediaIds: mediaIds.length ? mediaIds : undefined } },
      {
        onSuccess: (response) => {
          const changed = response.objectsChanged ?? [];

          if (changed.length > 0 && response.undoMessageId) {
            // Dismiss any previous undo bar first
            if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
            setUndoMessageId(response.undoMessageId);
            setUndoVisible(true);
            undoTimerRef.current = setTimeout(() => {
              setUndoVisible(false);
              setUndoMessageId(null);
            }, 30_000);
          }

          toast({ description: response.message?.content ?? 'Done.', duration: 3000 });
          onCardCreated?.();
        },
        onError: () => {
          toast({ description: 'Something went wrong. Try again.', variant: 'destructive', duration: 3000 });
        },
      },
    );
  };

  // ─── Undo ──────────────────────────────────────────────────────────────────

  const handleUndo = async () => {
    if (!undoMessageId || undoing) return;
    setUndoing(true);
    try {
      const res = await fetch(`/api/undo/${encodeURIComponent(undoMessageId)}`, { method: 'POST' });
      if (!res.ok) throw new Error(`Undo failed: ${res.status}`);
      toast({ description: 'Changes reversed.', duration: 3000 });
      setUndoVisible(false);
      setUndoMessageId(null);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      onCardCreated?.(); // Refresh the card list
    } catch {
      toast({ description: 'Could not undo. Try again.', variant: 'destructive', duration: 3000 });
    } finally {
      setUndoing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ─── Drag-and-drop onto the composer ──────────────────────────────────────

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    const fakeInput = document.createElement('input');
    fakeInput.type = 'file';
    fakeInput.multiple = true;
    Object.defineProperty(fakeInput, 'files', { value: dt.files });
    handleFileChange({ target: fakeInput } as unknown as React.ChangeEvent<HTMLInputElement>);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-xl border-t border-border/50 pb-safe"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Undo bar */}
      {undoVisible && (
        <div className="flex items-center justify-center gap-3 py-2 text-sm text-muted-foreground border-b border-border/40 bg-muted/30">
          <span className="text-foreground/70">Card created</span>
          <button
            className={cn(
              "inline-flex items-center gap-1.5 font-medium text-primary hover:underline transition-opacity",
              undoing && "opacity-50 pointer-events-none"
            )}
            onClick={handleUndo}
            data-testid="button-undo"
          >
            {undoing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
            Undo
          </button>
          <button
            className="text-muted-foreground/60 hover:text-muted-foreground ml-1"
            onClick={() => setUndoVisible(false)}
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 md:px-6 pt-3 pb-4 w-full flex flex-col gap-2">
        {/* Attachment preview strip */}
        {(attachments.length > 0 || uploading) && (
          <div className="flex gap-2 flex-wrap px-1">
            {attachments.map((att) => (
              <div key={att.id} className="relative group flex-shrink-0">
                <div className="w-16 h-16 rounded-xl overflow-hidden border border-border shadow-sm bg-muted">
                  {att.mime.startsWith('image/') ? (
                    <img src={att.url} alt={att.filename} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-foreground text-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                  title="Remove"
                >
                  <X className="w-3 h-3" />
                </button>
                <p className="text-[10px] text-muted-foreground mt-1 max-w-[64px] truncate text-center">{att.filename}</p>
              </div>
            ))}
            {uploading && (
              <div className="w-16 h-16 rounded-xl border border-border bg-muted flex items-center justify-center flex-shrink-0">
                <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
              </div>
            )}
          </div>
        )}

        {/* Composer row */}
        <div className="flex items-end gap-2">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            className="hidden"
            onChange={handleFileChange}
            data-testid="input-file"
          />

          {/* Paperclip */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className={cn(
              'p-3 rounded-full transition-colors flex-shrink-0',
              uploading
                ? 'text-muted-foreground/40 cursor-not-allowed'
                : 'text-muted-foreground hover:text-foreground hover:bg-black/5',
            )}
            title="Attach image"
            data-testid="button-attach"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Paperclip className="h-5 w-5" />
            )}
          </button>

          {/* Textarea + send */}
          <div className="flex-1 relative bg-card shadow-sm border border-border/60 rounded-[24px] overflow-hidden flex items-end focus-within:ring-1 focus-within:ring-primary/30 transition-all">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={attachments.length > 0 ? 'Add a note about this image...' : 'Tell Daydesk what to capture...'}
              className="w-full bg-transparent resize-none outline-none max-h-[120px] py-3.5 pl-4 pr-12 text-sm text-foreground placeholder:text-muted-foreground/70"
              rows={1}
              data-testid="input-chat"
              disabled={sendChat.isPending}
            />
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="absolute right-2 bottom-2 p-2 rounded-full bg-primary text-white disabled:opacity-0 disabled:scale-90 scale-100 transition-all shadow-sm"
              data-testid="button-send"
            >
              <ArrowUp className="h-4 w-4" strokeWidth={3} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
