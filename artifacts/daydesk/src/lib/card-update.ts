import type { ObjectUpdate } from '@workspace/api-client-react';
import { DaydeskObject } from '../types/daydesk';

/**
 * Keep every card editor save on the same API payload contract.
 *
 * In particular, notes live on the top level for every card type. Keeping
 * this mapping outside the page component makes it harder for a second save
 * path to accidentally omit an editable field.
 */
export function buildCardUpdateData(card: DaydeskObject): ObjectUpdate {
  return {
    title: card.title,
    bucket: card.bucket,
    status: card.status,
    priority: card.priority,
    tags: card.tags,
    payload: card.payload,
    notes: card.notes ?? null,
    snooze_until: card.snooze_until ?? null,
  };
}