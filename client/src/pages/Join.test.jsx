import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Join from './Join.jsx';

vi.mock('../lib/api.js', () => ({
  createSession: vi.fn(),
  joinSession: vi.fn(),
}));

const { createSession } = await import('../lib/api.js');

function fill(labelRe, value) {
  fireEvent.change(screen.getByLabelText(labelRe), { target: { value } });
}

describe('Join — create', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a story backlog session by default', async () => {
    createSession.mockResolvedValue({
      session: { code: 'ABC123' },
      participant: { id: 1, displayName: 'Brad' },
      facilitatorToken: 'tok',
    });
    render(<Join onJoined={vi.fn()} />);

    fill(/your name/i, 'Brad');
    fill(/session name/i, 'Sprint 42');
    fireEvent.click(screen.getByRole('button', { name: /create session/i }));

    await waitFor(() =>
      expect(createSession).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Sprint 42', displayName: 'Brad', kind: 'stories' })
      )
    );
  });

  it('creates a quick session when that type is chosen', async () => {
    createSession.mockResolvedValue({
      session: { code: 'ABC123' },
      participant: { id: 1, displayName: 'Brad' },
      facilitatorToken: 'tok',
    });
    const onJoined = vi.fn();
    render(<Join onJoined={onJoined} />);

    fill(/your name/i, 'Brad');
    fill(/session name/i, 'Ad-hoc');
    fireEvent.click(screen.getByRole('radio', { name: /quick estimate/i }));
    fireEvent.click(screen.getByRole('button', { name: /create session/i }));

    await waitFor(() =>
      expect(createSession).toHaveBeenCalledWith(expect.objectContaining({ kind: 'quick' }))
    );
    await waitFor(() =>
      expect(onJoined).toHaveBeenCalledWith(expect.objectContaining({ isFacilitator: true }))
    );
  });
});
