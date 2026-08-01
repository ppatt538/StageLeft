export type ObjectType = 'checklist' | 'note' | 'reminder' | 'event' | 'link' | 'media' | 'poster';
export type ObjectBucket = 'today' | 'week' | 'archive' | 'pinned';
export type ObjectStatus = 'active' | 'done' | 'snoozed' | 'discarded';

export interface ObjectLayout { x: number; y: number; w: number; h: number; z: number; }
export interface ObjectSource { kind: 'chat' | 'image' | 'url' | 'voice' | 'seed'; messageId?: string | null; rawText?: string | null; mediaIds?: string[]; }
export interface ObjectAi { confidence?: number | null; rationale?: string | null; needsReview?: boolean | null; }

export interface DaydeskObject {
  id: string;
  type: ObjectType;
  title: string;
  bucket: ObjectBucket;
  status: ObjectStatus;
  priority: number;
  tags: string[];
  layout?: ObjectLayout | null;
  payload: Record<string, any>;
  source: ObjectSource;
  search_text: string;
  ai?: ObjectAi | null;
  links: Record<string, any>[];
  snooze_until?: string | null;
  created_at: string;
  updated_at: string;
  last_touched_at: string;
  completed_at?: string | null;
}
