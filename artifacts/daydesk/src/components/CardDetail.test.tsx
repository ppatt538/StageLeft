import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CardDetail } from './CardDetail';
import { DaydeskObject } from '../types/daydesk';

const baseCard: DaydeskObject = {
  id: 'card-1',
  type: 'note',
  title: 'Original title',
  bucket: 'today',
  status: 'active',
  priority: 0,
  tags: [],
  payload: {},
  source: { kind: 'seed' },
  search_text: '',
  links: [],
  notes: 'Original note',
  created_at: '2026-08-27T00:00:00.000Z',
  updated_at: '2026-08-27T00:00:00.000Z',
  last_touched_at: '2026-08-27T00:00:00.000Z',
};

function cloneCard(card: DaydeskObject): DaydeskObject {
  return JSON.parse(JSON.stringify(card)) as DaydeskObject;
}

function renderEditor(card = baseCard) {
  let persistedCard = cloneCard(card);
  const onUpdateCard = vi.fn((updatedCard: DaydeskObject) => {
    persistedCard = cloneCard(updatedCard);
  });
  const onClose = vi.fn();

  const view = render(
    <CardDetail
      card={persistedCard}
      isOpen
      onClose={onClose}
      onUpdateCard={onUpdateCard}
    />,
  );

  return {
    ...view,
    onClose,
    onUpdateCard,
    get persistedCard() {
      return persistedCard;
    },
  };
}

async function expectPersistedAfterReload(
  view: ReturnType<typeof renderEditor>,
  expectedValue: string,
) {
  view.unmount();
  const reloaded = renderEditor(view.persistedCard);
  await waitFor(() => {
    expect(screen.getByPlaceholderText('Write something…')).toHaveProperty('value', expectedValue);
  });
  reloaded.unmount();
}

afterEach(() => {
  cleanup();
});

describe('CardDetail saves', () => {
  it('persists note edits when the field is left, then keeps them after reload', async () => {
    const user = userEvent.setup();
    const view = renderEditor();
    const notes = screen.getByPlaceholderText('Write something…');

    await user.clear(notes);
    await user.type(notes, 'Saved after leaving the field');
    await user.tab();

    await waitFor(() => {
      expect(view.onUpdateCard).toHaveBeenCalledTimes(1);
      expect(view.persistedCard.notes).toBe('Saved after leaving the field');
    });
    await expectPersistedAfterReload(view, 'Saved after leaving the field');
  });

  it('persists note edits when the card is closed immediately, then keeps them after reopening', async () => {
    const view = renderEditor();
    const notes = screen.getByPlaceholderText('Write something…');

    fireEvent.change(notes, { target: { value: 'Saved on immediate close' } });
    fireEvent.click(screen.getByRole('button', { name: 'Close card' }));

    expect(view.onClose).toHaveBeenCalledTimes(1);
    expect(view.onUpdateCard).toHaveBeenCalledTimes(1);
    expect(view.persistedCard.notes).toBe('Saved on immediate close');
    await expectPersistedAfterReload(view, 'Saved on immediate close');
  });

  it('keeps title and checklist item editing saves intact', async () => {
    const user = userEvent.setup();
    const titleView = renderEditor();
    const title = screen.getByDisplayValue('Original title');

    await user.clear(title);
    await user.type(title, 'Updated title');
    await user.tab();

    await waitFor(() => {
      expect(titleView.persistedCard.title).toBe('Updated title');
    });
    titleView.unmount();

    const checklist: DaydeskObject = {
      ...cloneCard(baseCard),
      id: 'checklist-1',
      type: 'checklist',
      payload: {
        items: [
          { id: 'item-1', text: 'First item', done: false },
          { id: 'item-2', text: 'Second item', done: false },
        ],
      },
      notes: null,
    };
    const checklistView = renderEditor(checklist);
    const item = screen.getByDisplayValue('First item');

    await user.clear(item);
    await user.type(item, 'Updated item');
    await user.tab();

    await waitFor(() => {
      expect(checklistView.persistedCard.payload.items).toEqual([
        { id: 'item-1', text: 'Updated item', done: false },
        { id: 'item-2', text: 'Second item', done: false },
      ]);
    });
    checklistView.unmount();
  });
});