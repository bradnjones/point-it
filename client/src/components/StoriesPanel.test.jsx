import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import StoriesPanel from './StoriesPanel.jsx';

const stories = [
  { id: 1, title: 'First', description: 'desc one' },
  { id: 2, title: 'Second', description: null },
  { id: 3, title: 'Third', description: null },
];

const noopActions = {
  onAdd: vi.fn(),
  onUpdate: vi.fn(),
  onDelete: vi.fn(),
  onReorder: vi.fn(),
  onSetActive: vi.fn(),
};

function renderPanel(props = {}) {
  const actions = { ...noopActions, ...props.actions };
  render(
    <StoriesPanel
      stories={props.stories ?? stories}
      activeStoryId={props.activeStoryId ?? null}
      isFacilitator={props.isFacilitator ?? true}
      {...actions}
    />
  );
  return actions;
}

describe('StoriesPanel', () => {
  it('is read-only for non-facilitators and highlights the active story', () => {
    renderPanel({ isFacilitator: false, activeStoryId: 2 });

    expect(screen.queryByLabelText('Story title')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.getByText('estimating')).toBeInTheDocument();
  });

  it('adds a story via the form', () => {
    const onAdd = vi.fn().mockResolvedValue({});
    renderPanel({ actions: { onAdd } });

    fireEvent.change(screen.getByLabelText('Story title'), { target: { value: 'New story' } });
    fireEvent.change(screen.getByLabelText('Story description'), { target: { value: 'the details' } });
    fireEvent.click(screen.getByRole('button', { name: /add story/i }));

    expect(onAdd).toHaveBeenCalledWith('New story', 'the details');
  });

  it('marks a story active', () => {
    const onSetActive = vi.fn().mockResolvedValue({});
    renderPanel({ actions: { onSetActive } });

    fireEvent.click(screen.getAllByRole('button', { name: 'Estimate' })[1]);

    expect(onSetActive).toHaveBeenCalledWith(2);
  });

  it('reorders by moving a story up, sending the full new order', () => {
    const onReorder = vi.fn().mockResolvedValue({});
    renderPanel({ actions: { onReorder } });

    fireEvent.click(screen.getByRole('button', { name: /move second up/i }));

    expect(onReorder).toHaveBeenCalledWith([2, 1, 3]);
  });

  it('deletes a story', () => {
    const onDelete = vi.fn().mockResolvedValue({});
    renderPanel({ actions: { onDelete } });

    fireEvent.click(screen.getAllByRole('button', { name: /delete/i })[0]);

    expect(onDelete).toHaveBeenCalledWith(1);
  });
});
