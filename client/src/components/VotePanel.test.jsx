import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import VotePanel from './VotePanel.jsx';

const scale = ['1', '2', '3', '5', '8', '?'];

function renderPanel(props = {}) {
  const onCast = props.onCast ?? vi.fn().mockResolvedValue({});
  render(
    <VotePanel
      activeStory={'activeStory' in props ? props.activeStory : { id: 1, title: 'Login flow' }}
      scale={props.scale ?? scale}
      yourVote={props.yourVote ?? null}
      onCast={onCast}
    />
  );
  return onCast;
}

describe('VotePanel', () => {
  it('prompts to wait when there is no active story', () => {
    renderPanel({ activeStory: null });
    expect(screen.getByText(/waiting for the facilitator/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '5' })).not.toBeInTheDocument();
  });

  it('casts the selected value with the reason', () => {
    const onCast = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: '5' }));
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'medium' } });
    fireEvent.click(screen.getByRole('button', { name: /cast vote/i }));

    expect(onCast).toHaveBeenCalledWith('5', 'medium');
  });

  it('cannot submit without a value', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: /cast vote/i })).toBeDisabled();
  });

  it('seeds the current vote and labels the button as an update', () => {
    renderPanel({ yourVote: { value: '8', reason: 'gut feel' } });

    expect(screen.getByRole('button', { name: '8' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText(/reason/i)).toHaveValue('gut feel');
    expect(screen.getByRole('button', { name: /update vote/i })).toBeInTheDocument();
  });
});
