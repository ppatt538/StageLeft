import React from 'react';
import { DaydeskObject } from '../types/daydesk';
import { X, Archive, Pin, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CardDetailProps {
  card: DaydeskObject | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateCard: (card: DaydeskObject) => void;
}

export function CardDetail({ card, isOpen, onClose, onUpdateCard }: CardDetailProps) {
  // Prevent closing when clicking inside the sheet
  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <AnimatePresence>
      {isOpen && card && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-50 md:block hidden"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 bottom-0 w-full md:w-[450px] bg-background border-l border-border shadow-2xl z-50 flex flex-col md:block hidden"
            onClick={handleContentClick}
          >
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <div className="flex gap-2">
                <button 
                  className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                  title="Archive"
                >
                  <Archive className="w-4 h-4" />
                </button>
                <button 
                  className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                  title="Pin"
                >
                  <Pin className="w-4 h-4" />
                </button>
                <button 
                  className="p-2 rounded-lg text-red-500/70 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <button 
                onClick={onClose}
                className="p-2 rounded-full hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto">
              <div className="flex flex-col gap-6">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    {card.type}
                  </div>
                  <input
                    type="text"
                    value={card.title}
                    onChange={(e) => onUpdateCard({ ...card, title: e.target.value })}
                    className="w-full bg-transparent text-2xl font-semibold outline-none border-none p-0 focus:ring-0 placeholder:text-muted-foreground/30"
                    placeholder="Untitled card"
                  />
                </div>
                
                <div className="space-y-4">
                  <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                    {card.type === 'checklist' && (
                      <div className="flex flex-col gap-3">
                        {((card.payload.items as any[]) || []).map(item => (
                          <div key={item.id} className="flex items-start gap-3">
                            <input 
                              type="checkbox" 
                              checked={item.done}
                              onChange={() => {
                                const newItems = (card.payload.items as any[]).map(i => 
                                  i.id === item.id ? { ...i, done: !i.done } : i
                                );
                                onUpdateCard({ ...card, payload: { ...card.payload, items: newItems } });
                              }}
                              className="mt-0.5 w-4.5 h-4.5 rounded border-border/80 text-primary cursor-pointer"
                            />
                            <span className={item.done ? "text-muted-foreground line-through" : ""}>
                              {item.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {card.type === 'note' && (
                      <div className="prose prose-sm max-w-none">
                        {card.payload.markdown as string}
                      </div>
                    )}
                    
                    {card.type === 'reminder' && (
                      <div className="bg-muted/50 p-4 rounded-xl space-y-2 border border-border/50">
                        {card.payload.when && (
                          <div className="flex gap-4">
                            <span className="text-muted-foreground w-16">When</span>
                            <span className="font-medium">{new Date(card.payload.when as string).toLocaleString()}</span>
                          </div>
                        )}
                        {card.payload.location && (
                          <div className="flex gap-4">
                            <span className="text-muted-foreground w-16">Where</span>
                            <span className="font-medium">{card.payload.location as string}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {card.type === 'link' && (
                      <div className="space-y-4">
                        <a href={card.payload.url as string} target="_blank" rel="noreferrer" className="text-primary hover:underline font-medium break-all">
                          {card.payload.url as string}
                        </a>
                        <p>{card.payload.summary as string}</p>
                      </div>
                    )}

                    {card.type === 'media' && (
                      <div className="space-y-4">
                        <div className="w-full aspect-video bg-muted rounded-xl border border-border overflow-hidden">
                          {card.payload.imageUrl ? (
                            <img src={card.payload.imageUrl as string} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-indigo-50 to-rose-50 flex items-center justify-center">
                              <span className="text-muted-foreground">Image placeholder</span>
                            </div>
                          )}
                        </div>
                        {card.payload.ocrText && (
                          <div className="p-4 bg-muted/50 rounded-xl text-sm italic">
                            {card.payload.ocrText as string}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {card.tags && card.tags.length > 0 && (
                  <div className="pt-4 border-t border-border/50">
                    <div className="flex gap-2 flex-wrap">
                      {card.tags.map(tag => (
                        <span key={tag} className="px-2.5 py-1 bg-muted rounded-md text-xs font-medium text-muted-foreground">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="pt-4 mt-auto">
                  <div className="text-xs text-muted-foreground/60 flex flex-col gap-1">
                    <span>Created {new Date(card.created_at).toLocaleDateString()}</span>
                    <span>ID: {card.id}</span>
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
