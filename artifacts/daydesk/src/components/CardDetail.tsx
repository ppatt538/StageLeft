import { useState, useEffect, useRef, useCallback } from 'react';
import { DaydeskObject } from '../types/daydesk';
import { X, Archive, Pin, Trash2, Plus, GripVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CardDetailProps {
  card: DaydeskObject | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateCard: (card: DaydeskObject) => void;
  onDeleteCard?: (id: string) => void;
}

// ─── Inline editable text ─────────────────────────────────────────────────────

function InlineText({
  value,
  onChange,
  onBlur,
  className,
  placeholder,
  multiline = false,
  strikethrough = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
  strikethrough?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);

  const autoResize = () => {
    if (multiline && ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    }
  };

  useEffect(() => { autoResize(); }, [value]);

  const shared = {
    ref,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange(e.target.value);
      autoResize();
    },
    onBlur,
    placeholder,
    className: cn(
      'w-full bg-transparent outline-none resize-none border-none p-0 focus:ring-0',
      'placeholder:text-muted-foreground/40 transition-colors',
      strikethrough && 'line-through text-muted-foreground',
      className,
    ),
  };

  if (multiline) {
    return <textarea rows={1} {...shared} />;
  }
  return <input type="text" {...shared} />;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CardDetail({ card, isOpen, onClose, onUpdateCard, onDeleteCard }: CardDetailProps) {
  // Local draft — synced from prop when card identity changes
  const [draft, setDraft] = useState<DaydeskObject | null>(null);
  const pendingRef = useRef(false);

  useEffect(() => {
    if (card) {
      setDraft(JSON.parse(JSON.stringify(card))); // deep clone
      pendingRef.current = false;
    }
  }, [card?.id]);

  const save = useCallback(() => {
    if (draft && pendingRef.current) {
      onUpdateCard(draft);
      pendingRef.current = false;
    }
  }, [draft, onUpdateCard]);

  const patch = useCallback((updates: Partial<DaydeskObject>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      pendingRef.current = true;
      return { ...prev, ...updates };
    });
  }, []);

  const patchPayload = useCallback((payloadUpdates: Record<string, unknown>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      pendingRef.current = true;
      return { ...prev, payload: { ...prev.payload, ...payloadUpdates } };
    });
  }, []);

  if (!draft) return null;

  // ─── Checklist helpers ──────────────────────────────────────────────────────

  type CheckItem = { id: string; text: string; done: boolean };
  const items: CheckItem[] = (draft.payload.items as CheckItem[]) || [];

  const updateItem = (id: string, changes: Partial<CheckItem>) => {
    const newItems = items.map((it) => (it.id === id ? { ...it, ...changes } : it));
    patchPayload({ items: newItems });
    pendingRef.current = true;
  };

  const addItem = () => {
    const newId = `i${Date.now()}`;
    const newItems = [...items, { id: newId, text: '', done: false }];
    patchPayload({ items: newItems });
    pendingRef.current = true;
    // Focus new item after render
    setTimeout(() => {
      document.getElementById(`item-${newId}`)?.focus();
    }, 50);
  };

  const removeItem = (id: string) => {
    const newItems = items.filter((it) => it.id !== id);
    patchPayload({ items: newItems });
    pendingRef.current = true;
  };

  // ─── Actions ────────────────────────────────────────────────────────────────

  const handleArchive = () => {
    onUpdateCard({ ...draft, bucket: 'archive' });
    onClose();
  };

  const handlePin = () => {
    const nextPriority = draft.priority >= 1 ? 0 : 1;
    onUpdateCard({ ...draft, priority: nextPriority });
    onClose();
  };

  const handleDelete = () => {
    if (confirm('Delete this card?')) {
      if (onDeleteCard) onDeleteCard(draft.id);
      else onUpdateCard({ ...draft, status: 'discarded' });
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop — desktop only */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-50 hidden md:block"
            onClick={() => { save(); onClose(); }}
          />

          {/* Sheet */}
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="fixed top-0 right-0 bottom-0 w-full md:w-[460px] bg-background border-l border-border shadow-2xl z-50 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Toolbar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 flex-shrink-0">
              <div className="flex gap-1">
                <button
                  onClick={handleArchive}
                  title="Archive"
                  className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Archive className="w-4 h-4" />
                </button>
                <button
                  onClick={handlePin}
                  title={draft.priority >= 1 ? 'Unpin' : 'Pin to top'}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    draft.priority >= 1
                      ? 'text-amber-500 bg-amber-50 hover:bg-amber-100'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Pin className="w-4 h-4" />
                </button>
                <button
                  onClick={handleDelete}
                  title="Delete"
                  className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => { save(); onClose(); }}
                className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex flex-col gap-6">

                {/* Type badge + Title */}
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                    {draft.type}
                  </div>
                  <InlineText
                    value={draft.title}
                    onChange={(v) => patch({ title: v })}
                    onBlur={save}
                    className="text-2xl font-semibold leading-tight"
                    placeholder="Untitled card"
                  />
                </div>

                {/* ── Checklist ── */}
                {draft.type === 'checklist' && (
                  <div className="flex flex-col gap-1">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-start gap-2 group py-1">
                        <GripVertical className="w-4 h-4 text-muted-foreground/30 mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 cursor-grab transition-opacity" />
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() => { updateItem(item.id, { done: !item.done }); save(); }}
                          className="mt-1 flex-shrink-0 w-4 h-4 rounded border-border/80 text-primary cursor-pointer"
                        />
                        <InlineText
                          value={item.text}
                          onChange={(v) => updateItem(item.id, { text: v })}
                          onBlur={save}
                          className={cn('flex-1 text-sm leading-relaxed pt-0.5', item.done && 'line-through text-muted-foreground')}
                          placeholder="Item text"
                        />
                        <button
                          onClick={() => { removeItem(item.id); save(); }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground/50 hover:text-red-400 transition-all flex-shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={addItem}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mt-1 py-1 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add item
                    </button>
                  </div>
                )}

                {/* ── Note ── */}
                {draft.type === 'note' && (
                  <InlineText
                    value={(draft.payload.markdown as string) ?? ''}
                    onChange={(v) => patchPayload({ markdown: v })}
                    onBlur={save}
                    multiline
                    className="text-sm leading-relaxed text-foreground/90 min-h-[120px]"
                    placeholder="Write something..."
                  />
                )}

                {/* ── Reminder ── */}
                {draft.type === 'reminder' && (
                  <div className="space-y-3">
                    <FieldRow label="When">
                      <input
                        type="datetime-local"
                        value={toLocalDateTimeInput(draft.payload.when as string | undefined)}
                        onChange={(e) => {
                          patchPayload({ when: new Date(e.target.value).toISOString() });
                          pendingRef.current = true;
                        }}
                        onBlur={save}
                        className="w-full bg-transparent text-sm outline-none border-none p-0 text-foreground"
                      />
                    </FieldRow>
                    <FieldRow label="Where">
                      <InlineText
                        value={(draft.payload.location as string) ?? ''}
                        onChange={(v) => patchPayload({ location: v })}
                        onBlur={save}
                        className="text-sm"
                        placeholder="Location (optional)"
                      />
                    </FieldRow>
                  </div>
                )}

                {/* ── Event ── */}
                {draft.type === 'event' && (
                  <div className="space-y-3">
                    <FieldRow label="Start">
                      <input
                        type="datetime-local"
                        value={toLocalDateTimeInput(draft.payload.start as string | undefined)}
                        onChange={(e) => { patchPayload({ start: new Date(e.target.value).toISOString() }); pendingRef.current = true; }}
                        onBlur={save}
                        className="w-full bg-transparent text-sm outline-none border-none p-0"
                      />
                    </FieldRow>
                    <FieldRow label="End">
                      <input
                        type="datetime-local"
                        value={toLocalDateTimeInput(draft.payload.end as string | undefined)}
                        onChange={(e) => { patchPayload({ end: new Date(e.target.value).toISOString() }); pendingRef.current = true; }}
                        onBlur={save}
                        className="w-full bg-transparent text-sm outline-none border-none p-0"
                      />
                    </FieldRow>
                    <FieldRow label="Where">
                      <InlineText
                        value={(draft.payload.location as string) ?? ''}
                        onChange={(v) => patchPayload({ location: v })}
                        onBlur={save}
                        className="text-sm"
                        placeholder="Location (optional)"
                      />
                    </FieldRow>
                  </div>
                )}

                {/* ── Link ── */}
                {draft.type === 'link' && (
                  <div className="space-y-3">
                    <FieldRow label="URL">
                      <InlineText
                        value={(draft.payload.url as string) ?? ''}
                        onChange={(v) => patchPayload({ url: v })}
                        onBlur={save}
                        className="text-sm text-primary font-medium break-all"
                        placeholder="https://..."
                      />
                    </FieldRow>
                    <FieldRow label="Summary">
                      <InlineText
                        value={(draft.payload.summary as string) ?? ''}
                        onChange={(v) => patchPayload({ summary: v })}
                        onBlur={save}
                        multiline
                        className="text-sm text-foreground/80"
                        placeholder="What's this link about?"
                      />
                    </FieldRow>
                  </div>
                )}

                {/* ── Media ── */}
                {draft.type === 'media' && (
                  <div className="space-y-3">
                    <div className="w-full aspect-video bg-muted rounded-xl border border-border overflow-hidden">
                      {draft.payload.imageUrl ? (
                        <img src={draft.payload.imageUrl as string} className="w-full h-full object-cover" alt={draft.title} />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-indigo-50 to-rose-50 flex items-center justify-center text-muted-foreground text-sm">
                          No image
                        </div>
                      )}
                    </div>
                    <FieldRow label="Caption">
                      <InlineText
                        value={(draft.payload.ocrText as string) ?? ''}
                        onChange={(v) => patchPayload({ ocrText: v })}
                        onBlur={save}
                        multiline
                        className="text-sm italic text-foreground/80"
                        placeholder="Caption or extracted text..."
                      />
                    </FieldRow>
                  </div>
                )}

                {/* Tags */}
                {Array.isArray(draft.tags) && draft.tags.length > 0 && (
                  <div className="pt-4 border-t border-border/40">
                    <div className="flex gap-2 flex-wrap">
                      {(draft.tags as string[]).map((tag) => (
                        <span key={tag} className="px-2.5 py-1 bg-muted rounded-md text-xs font-medium text-muted-foreground">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metadata footer */}
                <div className="pt-4 border-t border-border/30">
                  <div className="text-xs text-muted-foreground/50 flex flex-col gap-1">
                    <span>Created {new Date(draft.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    <span>Updated {new Date(draft.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-muted/40 rounded-xl border border-border/40 px-4 py-3 space-y-1">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

function toLocalDateTimeInput(iso: string | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}
