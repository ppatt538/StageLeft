import { describe, expect, it } from 'vitest';
import { buildCardUpdateData } from './card-update';
import { DaydeskObject } from '../types/daydesk';

const card: DaydeskObject = {
  id: 'note-1',
  type: 'note',
  title: 'A title',
  bucket: 'today',
  status: 'active',
  priority: 0,
  tags: ['work'],
  payload: {},
  source: { kind: 'seed' },
  search_text: '',
  links: [],
  notes: 'The saved note',
  snooze_until: null,
  created_at: '2026-08-27T00:00:00.000Z',
  updated_at: '2026-08-27T00:00:00.000Z',
  last_touched_at: '2026-08-27T00:00:00.000Z',
};

describe('buildCardUpdateData', () => {
  it('includes top-level notes in the payload used by the detail editor', () => {
    expect(buildCardUpdateData(card)).toMatchObject({
      title: 'A title',
      notes: 'The saved note',
      payload: {},
    });
  });

  it('sends null when an editor clears notes', () => {
    expect(buildCardUpdateData({ ...card, notes: null }).notes).toBeNull();
  });
});